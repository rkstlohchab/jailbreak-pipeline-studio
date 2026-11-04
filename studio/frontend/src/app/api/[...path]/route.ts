import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type Entry = { data?: unknown; content?: string; filename?: string };
let collection: Promise<Record<string, Entry>> | undefined;
function loadCollection() {
  collection ??= readFile(path.join(process.cwd(), ".collection/index.json"), "utf8")
    .then((text) => JSON.parse(text) as Record<string, Entry>)
    .catch((error) => { collection = undefined; throw error; });
  return collection;
}
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const key = parts.join("/");
  const records = await loadCollection();
  if (!Object.hasOwn(records, key)) return NextResponse.json({ detail: "Collection item not found" }, { status: 404 });
  const entry = records[key];
  if (entry.filename && typeof entry.content === "string") {
    return new Response(entry.content, { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${entry.filename}"`,
      "X-Content-Type-Options": "nosniff",
    } });
  }
  return NextResponse.json(entry.data);
}
export async function POST() {
  return NextResponse.json({ detail: "This collection endpoint is read-only. Classification and rebuilding exports are available in the local workspace. Live model runs use /api/run." }, { status: 405, headers: { Allow: "GET" } });
}
