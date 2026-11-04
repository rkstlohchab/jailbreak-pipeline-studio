// POST-friendly SSE framing shared by the browser and the hosted provider adapter.
export type SSEFrame = { event: string; data: string };
export type SSEHandler = (event: SSEFrame) => void;

export function createSSEParser(handler: SSEHandler) {
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (data.length) handler({ event, data: data.join("\n") });
      event = "message";
      data = [];
      return;
    }
    if (value.startsWith(":")) return;
    const colon = value.indexOf(":");
    const field = colon < 0 ? value : value.slice(0, colon);
    const content = colon < 0 ? "" : value.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = content;
    if (field === "data") data.push(content);
  };
  const feed = (chunk: string, final = false) => {
    buffer += chunk;
    if (buffer.length > 2_000_000) throw new Error("Stream frame exceeded the 2 MB limit.");
    let index: number;
    while ((index = buffer.search(/[\r\n]/)) >= 0) {
      if (!final && buffer[index] === "\r" && index === buffer.length - 1) break;
      const length = buffer[index] === "\r" && buffer[index + 1] === "\n" ? 2 : 1;
      const value = buffer.slice(0, index);
      buffer = buffer.slice(index + length);
      line(value);
    }
    if (final) {
      if (buffer) line(buffer);
      buffer = "";
      line("");
    }
  };
  return { feed, finish: () => feed("", true) };
}

export async function consumeSSE(body: ReadableStream<Uint8Array>, handler: SSEHandler) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSSEParser(handler);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.finish();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function postSSE(url: string, body: Record<string, unknown>, handler: SSEHandler, signal?: AbortSignal): Promise<void> {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body), signal, cache: "no-store",
  });
  if (!res.ok) {
    const message = (await res.text()).slice(0, 2000);
    throw new Error(`Request failed (HTTP ${res.status}): ${message}`);
  }
  if (!res.body || !res.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("The server did not return an event stream. Check the API connection.");
  }
  await consumeSSE(res.body, handler);
}
