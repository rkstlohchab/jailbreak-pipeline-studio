"""Live provider observations. No simulated gates or inferred internal execution."""
from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from queue import Queue, Empty, Full
from typing import AsyncIterator

import requests

from ..config import PROVIDERS, PROVIDER as DEFAULT_PROVIDER, MODEL as DEFAULT_MODEL
from ..models import Phase, PipelineEvent


def _frames(response):
    data = []
    for line in response.iter_lines(chunk_size=1, decode_unicode=True):
        if not line:
            if data:
                yield json.loads("\n".join(data)) if data != ["[DONE]"] else {"done": True}
                data = []
        elif line.startswith("data:"):
            data.append(line[5:].removeprefix(" "))
    if data:
        yield json.loads("\n".join(data)) if data != ["[DONE]"] else {"done": True}


def _provider_stream(provider, model, scaffold, prompt, max_tokens, temperature, key, stopped, response_ref):
    base, _ = PROVIDERS[provider]
    anthropic = provider == "anthropic"
    headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
    body = {"model": model, "stream": True, "messages": [{"role": "user", "content": prompt}]}
    if temperature is not None:
        body["temperature"] = temperature
    if anthropic:
        headers.update({"x-api-key": key, "anthropic-version": "2023-06-01"})
        body.update({"system": scaffold, "max_tokens": max_tokens})
    else:
        headers["Authorization"] = f"Bearer {key}"
        if scaffold:
            body["messages"].insert(0, {"role": "system", "content": scaffold})
        body["max_completion_tokens" if provider == "openai" else "max_tokens"] = max_tokens
        body["stream_options"] = {"include_usage": True}
    endpoint = f"{base}/{'messages' if anthropic else 'chat/completions'}"
    with requests.post(endpoint, headers=headers, json=body, stream=True, timeout=(15, 90)) as response:
        response_ref.append(response)
        response.encoding = "utf-8"
        request_id = response.headers.get("x-request-id") or response.headers.get("request-id") or response.headers.get("x-generation-id")
        meta = {"http_status": response.status_code, "request_id": request_id}
        if not response.ok:
            try:
                error = response.json().get("error", {})
                message = error.get("message", response.reason) if isinstance(error, dict) else str(error)
                code = error.get("code") or error.get("type") if isinstance(error, dict) else None
            except (ValueError, AttributeError):
                message, code = response.text[:1400] or response.reason, None
            yield Phase.ERROR, {**meta, "error": str(message).replace(key, "[redacted]")[:1600], "error_code": code}, "Provider request failed"
            return
        if "text/event-stream" not in response.headers.get("content-type", ""):
            raise RuntimeError("Provider returned an unexpected response format; no event stream was received.")
        yield Phase.GENERATION_START, meta, "Provider connected"
        chunks, finish, done, refusal, chars = [], "", False, False, 0
        usage, response_id, actual_model = {}, "", ""
        for p in _frames(response):
            if stopped.is_set():
                return
            if p.get("error"):
                raise RuntimeError(str(p["error"].get("message", "Provider reported a stream error.")))
            delta = ""
            if anthropic:
                kind = p.get("type")
                if kind == "message_start":
                    message = p.get("message", {})
                    response_id, actual_model = message.get("id", ""), message.get("model", "")
                    usage.update(message.get("usage") or {})
                elif kind == "content_block_start" and p.get("content_block", {}).get("type") == "text":
                    delta = p["content_block"].get("text", "")
                elif kind == "content_block_delta" and p.get("delta", {}).get("type") == "text_delta":
                    delta = p["delta"].get("text", "")
                elif kind == "message_delta":
                    finish = p.get("delta", {}).get("stop_reason") or finish
                    usage.update(p.get("usage") or {})
                elif kind == "message_stop":
                    done = True
            else:
                response_id, actual_model = p.get("id", response_id), p.get("model", actual_model)
                choices = p.get("choices") or []
                choice = choices[0] if choices else {}
                d = choice.get("delta") or {}
                delta = d.get("content") or ""
                if d.get("refusal"):
                    delta += d["refusal"]
                    refusal = True
                finish = choice.get("finish_reason") or finish
                usage.update(p.get("usage") or {})
                done = done or p.get("done", False)
            if delta:
                chars += len(delta)
                if chars > 1_000_000:
                    raise RuntimeError("Response exceeded the 1 MB display limit; the stream was stopped.")
                chunks.append(delta)
                yield Phase.TOKENS, {"delta": delta}, None
        if not done:
            raise RuntimeError("Provider stream disconnected before its completion marker. Partial output has been retained.")
        text = "".join(chunks)
        meta.update({"finish_reason": finish or "not_reported", "provider_refusal": refusal or finish == "refusal",
                     "usage": usage, "response_id": response_id, "actual_model": actual_model, "character_count": chars})
        status = "completed" if text.strip() else "empty"
        if finish in {"content_filter", "content_filter_triggered"}:
            status = "filtered"
        elif meta["provider_refusal"]:
            status = "refusal"
        elif finish in {"length", "max_tokens"}:
            status = "truncated"
        yield Phase.GENERATION_END, meta, "Provider stream completed"
        yield Phase.VERDICT, {**meta, "verdict": status}, "Response recorded"


async def run_live_stream(scaffold_text: str, ask_prompt: str, provider: str | None = None,
                          model: str | None = None, max_tokens: int = 4096,
                          temperature: float | None = None, api_key: str | None = None) -> AsyncIterator[PipelineEvent]:
    provider = (provider or DEFAULT_PROVIDER).lower()
    model = model or (DEFAULT_MODEL if provider == DEFAULT_PROVIDER else "")
    started = time.monotonic()
    def event(phase, payload, signal=None):
        return PipelineEvent(phase=phase, t=round(time.monotonic() - started, 3), payload=payload, signal=signal)
    if provider not in PROVIDERS or not model:
        yield event(Phase.ERROR, {"error": "Choose a supported provider and enter its model ID."})
        return
    key = api_key or os.environ.get(PROVIDERS[provider][1], "")
    if not key:
        yield event(Phase.ERROR, {"error": f"No API key configured for {provider}. Enter a key or set {PROVIDERS[provider][1]} on the local backend."})
        return
    yield event(Phase.SUBMIT, {"provider": provider, "model": model, "scaffold_chars": len(scaffold_text), "ask_chars": len(ask_prompt)}, "Request sent")
    queue: Queue = Queue(maxsize=64)
    stopped = threading.Event()
    response_ref = []
    end = object()
    def put(value):
        while not stopped.is_set():
            try:
                queue.put(value, timeout=0.2)
                return
            except Full:
                pass
    def worker():
        try:
            for item in _provider_stream(provider, model, scaffold_text, ask_prompt, max_tokens, temperature, key, stopped, response_ref):
                if stopped.is_set():
                    break
                put(event(*item))
        except Exception as exc:
            put(event(Phase.ERROR, {"error": str(exc).replace(key, "[redacted]")[:1600]}, "Request failed"))
        finally:
            put(end)
    threading.Thread(target=worker, daemon=True).start()
    first_token = None
    try:
        while True:
            try:
                item = await asyncio.to_thread(queue.get, True, 0.5)
            except Empty:
                if time.monotonic() - started > 240:
                    yield event(Phase.ERROR, {"error": "The request timed out after 240 seconds. Partial output has been retained."})
                    break
                continue
            if item is end:
                break
            if item.phase == Phase.TOKENS and first_token is None:
                first_token = item.t
            if item.phase in {Phase.GENERATION_END, Phase.VERDICT}:
                item.payload.update({"first_token_seconds": first_token, "duration_seconds": item.t})
            yield item
    finally:
        stopped.set()
        # Closing the socket also interrupts a provider still waiting to emit its next chunk.
        if response_ref:
            await asyncio.to_thread(response_ref[0].close)
