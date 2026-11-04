import { parseRunRequest, streamProvider } from "@/lib/provider-stream";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin requests are not supported." }, { status: 403 });
  let input;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) throw new Error("Request too large.");
    const raw = await request.text();
    if (raw.length > 250_000) throw new Error("Request too large.");
    input = parseRunRequest(JSON.parse(raw));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 });
  }
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(240_000)]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      try {
        await streamProvider(input, (event) => {
          if (!controller.signal.aborted) output.enqueue(encoder.encode(`event: pipeline\ndata: ${JSON.stringify(event)}\n\n`));
        }, signal);
      } finally {
        if (!controller.signal.aborted) output.close();
      }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no" } });
}
