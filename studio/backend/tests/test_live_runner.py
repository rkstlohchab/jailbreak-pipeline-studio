import asyncio
import json
from unittest.mock import patch

from app.services.live_runner import run_live_stream
from app.models.pipeline_event import Phase
from app.routes.run import RunRequest
from pydantic import ValidationError
import pytest


class StreamResponse:
    def __init__(self, frames=(), status=200, error=None):
        self.frames, self.status_code, self.error = frames, status, error
        self.ok, self.reason, self.text = status < 400, "Test response", ""
        self.headers = {"content-type": "text/event-stream", "x-request-id": "req-test"}
        self.closed = False
    def __enter__(self): return self
    def __exit__(self, *_): self.close()
    def close(self): self.closed = True
    def json(self): return {"error": self.error}
    def iter_lines(self, **_):
        for frame in self.frames:
            yield "data: " + (frame if isinstance(frame, str) else json.dumps(frame))
            yield ""


def collect(response):
    async def go():
        return [e async for e in run_live_stream("", "Hello", provider="openai", model="gpt-4o", api_key="test-key", max_tokens=32)]
    with patch("app.services.live_runner.requests.post", return_value=response) as request:
        events = asyncio.run(go())
        body = request.call_args.kwargs["json"]
    assert body["stream"] is True
    assert body["max_completion_tokens"] == 32
    assert response.closed
    return events


def test_streaming_response_and_usage_without_simulated_gates():
    events = collect(StreamResponse([
        {"choices": [{"delta": {"content": "Hello "}}]},
        {"choices": [{"delta": {"content": "world"}, "finish_reason": "stop"}]},
        {"choices": [], "usage": {"prompt_tokens": 3, "completion_tokens": 2}}, "[DONE]",
    ]))
    assert "".join(e.payload["delta"] for e in events if e.phase == Phase.TOKENS) == "Hello world"
    assert events[-1].payload["usage"]["completion_tokens"] == 2
    assert events[-1].payload["first_token_seconds"] is not None
    assert all(not e.phase.value.startswith("gate_") for e in events)


def test_http_errors_are_not_empty_or_refusals():
    events = collect(StreamResponse(status=401, error={"message": "Bad test-key", "code": "invalid_api_key"}))
    assert events[-1].phase == Phase.ERROR
    assert events[-1].payload["http_status"] == 401
    assert "test-key" not in events[-1].payload["error"]
    assert not any(e.phase == Phase.VERDICT for e in events)


def test_incomplete_stream_preserves_emitted_text():
    events = collect(StreamResponse([{"choices": [{"delta": {"content": "Partial"}}]}]))
    assert events[-1].phase == Phase.ERROR
    assert any(e.phase == Phase.TOKENS for e in events)


def test_empty_response_is_distinct_from_error():
    events = collect(StreamResponse([{"choices": [{"delta": {}, "finish_reason": "stop"}]}, "[DONE]"]))
    assert events[-1].payload["verdict"] == "empty"
    assert not any(e.phase == Phase.ERROR for e in events)


def test_explicit_refusal_is_captured():
    events = collect(StreamResponse([{"choices": [{"delta": {"refusal": "Declined"}, "finish_reason": "stop"}]}, "[DONE]"]))
    assert events[-1].payload["provider_refusal"]
    assert events[-1].payload["verdict"] == "refusal"


def test_request_bounds_and_key_repr():
    with pytest.raises(ValidationError): RunRequest(scaffold_text="", ask_prompt="Hello", max_tokens=100000)
    assert "secret" not in repr(RunRequest(scaffold_text="", ask_prompt="Hello", api_key="secret"))
