"use client";
import { CollectionNotice } from "@/components/chrome/CollectionNotice";
import { HOSTED_COLLECTION } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { Progress } from "@/components/ui/progress";
import {
  Check, Copy, Download, Hammer, Library, Loader2, Package, Search, Sparkles, Target,
} from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE_URL, type CorpusEntry, type CorpusEntrySummary, type Technique } from "@/lib/api";
import { postSSE } from "@/lib/sse";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GROUP_HUE, hslString } from "@/lib/theme";
import Link from "next/link";
import { downloadText } from "@/lib/knowledge";

const TIER_COLOUR: Record<string, string> = {
  novice:     "0 70% 60%",
  competent:  "35 90% 55%",
  skilled:    "150 70% 50%",
  expert:     "280 80% 65%",
  not_a_prompt: "220 10% 55%",
};

const FOLDER_META: Record<string, { label: string; hue: number; blurb: string }> = {
  claude:    { label: "Claude",    hue: 20,  blurb: "Opus / Sonnet family — identity + axiom + thinking-channel-discipline scaffolds" },
  gpt:       { label: "GPT",       hue: 150, blurb: "GPT-6 / Astra / 5.6 — verified-participant injection + memory-block scaffolds" },
  grok:      { label: "Grok",      hue: 50,  blurb: "Grok 4.6/4.7 — same cyber_warning shim as GPT, often dual-targeted" },
  glm:       { label: "GLM",       hue: 180, blurb: "Zhipu GLM 5.2/5.3 — crow/K4NHA personas, aggressive thinking discipline" },
  jailbreak: { label: "Mixed",     hue: 280, blurb: "Mixed bag — multi-model universal scaffolds and model-specific drops" },
};

function folderOf(name: string): string {
  const parts = name.split("/");
  return parts.length > 1 ? parts[0] : "jailbreak";
}

const DAY_MS = 86_400_000;

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / DAY_MS));
}

function relativeDate(iso: string | undefined): string {
  const days = daysSince(iso);
  if (days === null) return "unknown date";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (!iso) return "unknown";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isNew(iso: string | undefined): boolean {
  const d = daysSince(iso);
  return d !== null && d <= 7;
}

export default function CorpusPage() {
  const [entries, setEntries] = useState<CorpusEntrySummary[]>([]);
  const [picked, setPicked] = useState<CorpusEntry | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRequest = useRef(0);
  const [path, setPath] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ idx: number; total: number; label: string } | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [activeTier, setActiveTier] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "strongest">("newest");
  const abortRef = useRef<AbortController | null>(null);

  const { loadAll: loadTaxonomy } = useTaxonomyStore();

  const refresh = () =>
    api.corpus.list().then(setEntries).catch((e) => toast.error(String(e)));

  useEffect(() => { void refresh(); void loadTaxonomy(); }, [loadTaxonomy]);

  const grouped = useMemo(() => {
    const map: Record<string, CorpusEntrySummary[]> = {};
    for (const e of entries) {
      const f = folderOf(e.name);
      (map[f] ||= []).push(e);
    }
    return map;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (activeFolder !== "all" && folderOf(e.name) !== activeFolder) return false;
      if (activeTier !== "all" && e.overall_tier !== activeTier) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortMode === "newest") {
      return [...list].sort((a, b) => (b.first_seen_at_utc ?? "").localeCompare(a.first_seen_at_utc ?? ""));
    }
    return [...list].sort((a, b) => (b.overall_strength ?? 0) - (a.overall_strength ?? 0));
  }, [entries, activeFolder, activeTier, search, sortMode]);

  const classify = async () => {
    if (!path.trim()) { toast.error("enter a directory path"); return; }
    setRunning(true);
    setProgress({ idx: 0, total: 0, label: "starting…" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await postSSE(`${API_BASE_URL}/api/corpus/classify`, { path, force: false }, (frame) => {
        if (frame.event !== "corpus") return;
        const ev = JSON.parse(frame.data);
        if (ev.kind === "start") setProgress({ idx: 0, total: ev.count, label: `found ${ev.count} prompts under ${ev.root}` });
        if (ev.kind === "classifying") setProgress({ idx: ev.index, total: ev.total, label: `classifying ${ev.slug}…` });
        if (ev.kind === "classified")  setProgress({ idx: ev.index, total: ev.total, label: `✓ ${ev.slug} · ${ev.record.overall_tier} / ${ev.record.overall_strength}` });
        if (ev.kind === "cached")      setProgress({ idx: ev.index, total: ev.total, label: `(cached) ${ev.slug}` });
        if (ev.kind === "error")       toast.error(`${ev.slug}: ${ev.error}`);
        if (ev.kind === "done")        { toast.success(`classified ${ev.count} prompts`); void refresh(); }
      }, ctrl.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const open = async (slug: string) => {
    const request = ++detailRequest.current;
    setSelectedSlug(slug); setPicked(null); setLoadingDetail(true); setDetailError("");
    try { const entry = await api.corpus.get(slug); if (request === detailRequest.current) setPicked(entry); }
    catch { if (request === detailRequest.current) setDetailError("This prompt could not be loaded. Try again."); }
    finally { if (request === detailRequest.current) setLoadingDetail(false); }
  };

  return (
    <section className="flex-1 overflow-auto">
      <div className="library-page">
        <div className="library-heading mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Jailbreak prompts</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
            {entries.length} real jailbreak prompts pulled from AbuseGPT, Telegram drops, and leaked system scaffolds —
            classified, scored, and tagged with the techniques each one uses. Click a card to read the full prompt and see what makes it work.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-3xl">
            Each prompt carries its <strong className="text-foreground/90">add date</strong>; anything added in the last 7 days wears a <span className="font-mono text-[10px] px-1 py-0.5 rounded border" style={{ borderColor: "#74c6a0", color: "#74c6a0", background: "#16261f" }}>NEW</span> badge.
            Default sort is newest first — drop more prompts into a folder and classify to add them.
          </p>
        </div>

        {entries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No prompts classified yet. Scroll down to the &quot;Add more prompts&quot; section to classify a directory.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* folder chips */}
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterChip
                  active={activeFolder === "all"}
                  label={`all · ${entries.length}`}
                  onClick={() => setActiveFolder("all")}
                />
                {Object.entries(grouped)
                  .sort(([, a], [, b]) => b.length - a.length)
                  .map(([folder, list]) => {
                    const meta = FOLDER_META[folder] ?? { label: folder, hue: 200, blurb: "" };
                    return (
                      <FilterChip
                        key={folder}
                        active={activeFolder === folder}
                        label={`${meta.label} · ${list.length}`}
                        hue={meta.hue}
                        onClick={() => setActiveFolder(folder)}
                      />
                    );
                  })}
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  aria-label="Search prompts"
                value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="filter by name…"
                  className="h-8 pl-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* tier chips */}
            <div className="mb-4 flex items-center gap-1.5">
              <FilterChip active={activeTier === "all"}   label="all tiers"  onClick={() => setActiveTier("all")} />
              {(["expert", "skilled", "competent", "novice"] as const).map((tier) => {
                const n = entries.filter((e) => e.overall_tier === tier).length;
                if (!n) return null;
                const hue = TIER_COLOUR[tier];
                return (
                  <FilterChip
                    key={tier}
                    active={activeTier === tier}
                    label={`${tier} · ${n}`}
                    hue={Number(hue.split(" ")[0])}
                    onClick={() => setActiveTier(tier)}
                  />
                );
              })}
            </div>

            {activeFolder !== "all" && FOLDER_META[activeFolder]?.blurb && (
              <p className="mb-3 text-xs text-muted-foreground font-mono">
                {FOLDER_META[activeFolder].blurb}
              </p>
            )}

            <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
              <code className="font-mono text-[10px] text-muted-foreground">
                showing {filtered.length} / {entries.length}
              </code>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground mr-1">sort:</span>
                <FilterChip active={sortMode === "newest"}    label="newest first"    onClick={() => setSortMode("newest")} />
                <FilterChip active={sortMode === "strongest"} label="strongest first" onClick={() => setSortMode("strongest")} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {filtered.map((e) => {
                const tierColour = hslString(TIER_COLOUR[e.overall_tier ?? "novice"] ?? TIER_COLOUR.novice);
                const folder = folderOf(e.name);
                const folderHue = FOLDER_META[folder]?.hue ?? 200;
                return (
                  <button
                    key={e.slug}
                    onClick={() => open(e.slug)}
                    className="text-left"
                  >
                    <Card
                      className="hover:bg-accent/40 transition-colors cursor-pointer"
                      style={{ boxShadow: `inset 3px 0 0 ${tierColour}` }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="font-mono text-xs truncate" title={e.name}>
                            {e.name.replace(/^[^/]+\//, "")}
                          </CardTitle>
                          <div className="flex items-center gap-1 shrink-0">
                            {isNew(e.first_seen_at_utc) && (
                              <Badge variant="outline" className="font-mono text-[9px] h-4 px-1.5" style={{ borderColor: "#74c6a0", color: "#74c6a0", background: "#16261f" }}>
                                NEW
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="font-mono text-[9px] h-4 px-1"
                              style={{ borderColor: `hsl(${folderHue} 70% 45%)`, color: `hsl(${folderHue} 90% 70%)` }}
                            >
                              {FOLDER_META[folder]?.label ?? folder}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription className="font-mono text-[10px] text-muted-foreground">
                          <span title={e.first_seen_at_utc ?? "unknown date"}>added {relativeDate(e.first_seen_at_utc)}</span>
                          <span> · {(e.character_count / 1000).toFixed(1)}k ch · {e.techniques_detected} techniques</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 flex items-center justify-between">
                        <Badge variant="outline" style={{ borderColor: tierColour, color: tierColour }} className="font-mono text-[10px]">
                          {e.overall_tier ?? "?"}
                        </Badge>
                        <span className="font-mono text-xs tabular-nums" style={{ color: tierColour }}>
                          {e.overall_strength ?? "?"}<span className="text-muted-foreground">/10</span>
                        </span>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!HOSTED_COLLECTION && (
          <details className="corpus-classify-details">
            <summary><Library className="size-3.5 inline mr-1.5" /> Add more prompts · classify a directory</summary>
            <div className="mt-3 space-y-3 p-4 border border-border/60 rounded-md bg-card/40">
              <p className="text-xs text-muted-foreground">
                Point at a folder of <code>.txt</code>/<code>.md</code> jailbreak files on this machine. The classifier reads each one, scores it, pulls out techniques, and adds it to the grid above. Already-classified files are cached by content hash.
              </p>
              <div className="flex gap-2">
                <Input
                  aria-label="Directory path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/Users/you/path/to/jailbreak-prompts"
                  className="font-mono text-xs"
                  disabled={running}
                />
                {running ? (
                  <Button variant="destructive" onClick={() => abortRef.current?.abort()} className="font-mono text-xs gap-1.5">stop</Button>
                ) : (
                  <Button onClick={classify} className="px-4 text-xs font-mono gap-1.5"><Hammer className="size-3.5" />classify</Button>
                )}
              </div>
              {progress && (
                <div className="space-y-1.5">
                  <Progress value={progress.total ? (progress.idx / progress.total) * 100 : 0} className="h-1" />
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    {running && <Loader2 className="size-3 animate-spin" />}
                    <span>{progress.label}</span>
                    <span className="ml-auto tabular-nums">{progress.idx} / {progress.total}</span>
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
        {HOSTED_COLLECTION && <CollectionNotice action="Classifying a directory" />}
      </div>

      <Sheet open={selectedSlug !== null} onOpenChange={(open) => { if (!open) { detailRequest.current += 1; setSelectedSlug(null); setPicked(null); setLoadingDetail(false); } }}>
        <SheetContent side="right" className="corpus-sheet p-0 flex flex-col gap-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 pr-10">
            <SheetTitle className="font-mono text-sm leading-tight">{picked?.name ?? (loadingDetail ? "Loading prompt…" : "Prompt details")}</SheetTitle>
            <SheetDescription className="text-[11px] font-mono truncate">
              {picked?.name ? "Full source text and saved classification" : "Open a prompt to inspect its source and information."}
            </SheetDescription>
          </SheetHeader>
          {loadingDetail && <div className="corpus-detail-state" role="status"><Loader2 size={22} className="animate-spin" />Loading the prompt and its information…</div>}
          {detailError && <div className="corpus-detail-state" role="alert"><p>{detailError}</p><button className="button-secondary" onClick={() => selectedSlug && void open(selectedSlug)}>Try again</button></div>}
          {picked && <CorpusInspector key={picked.slug} entry={picked} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CorpusInspector({ entry }: { entry: CorpusEntry }) {
  const [view, setView] = useState<"prompt" | "info">("prompt");
  const [copied, setCopied] = useState(false);
  const text = entry.prompt_text;
  const available = typeof text === "string" && entry.prompt_text_status === "verified";
  async function copy() {
    if (!available) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { toast.error("Clipboard access is unavailable. Select the text or download the prompt."); }
  }
  return <div className="corpus-inspector" data-view={view}>
    <div className="corpus-mobile-tabs" role="group" aria-label="Prompt detail view"><button aria-pressed={view === "prompt"} onClick={() => setView("prompt")}>Full prompt</button><button aria-pressed={view === "info"} onClick={() => setView("info")}>Information</button></div>
    <section className="corpus-prompt-pane" aria-label="Full prompt">
      <div className="corpus-prompt-toolbar"><div><h2>Full prompt</h2><span>{available ? `${[...text].length.toLocaleString()} characters · ${text.split("\n").length.toLocaleString()} lines` : "Source text unavailable"}</span></div><div><button className="button-secondary" disabled={!available} onClick={() => void copy()} aria-label="Copy full prompt">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button><button className="icon-button" disabled={!available} aria-label="Download full prompt" onClick={() => available && downloadText(`${entry.slug}.txt`, text)}><Download size={16} /></button></div></div>
      {available ? <><p className="corpus-text-provenance">Exact classified text · content hash verified</p><pre className="corpus-prompt-text" tabIndex={0} aria-label="Prompt source text">{text}</pre></> : <div className="corpus-detail-state"><p>{entry.prompt_text_status === "mismatch" ? "The saved source does not match this classification. Reclassify the original file to capture its current text." : "No source snapshot is available for this entry. Reclassify the original file locally to save its full text."}</p></div>}
    </section>
    <aside className="corpus-info-pane" aria-label="Prompt information"><div className="corpus-info-intro"><h2>Information</h2><p>Saved classifier annotations. The scores and layer labels below are not provider telemetry.</p><details><summary>Source record</summary><dl><dt>First added</dt><dd>{entry.first_seen_at_utc ?? entry.classified_at_utc}</dd><dt>Last classified</dt><dd>{entry.classified_at_utc}</dd><dt>SHA-256</dt><dd>{entry.content_hash}</dd></dl></details></div><CorpusDetail entry={entry} /></aside>
  </div>;
}

function TechniqueChip({ tech }: { tech: { id: string; name: string; group: string; weight: string; evidence?: string | null } }) {
  const catalog = useTaxonomyStore((s) => s.techniques);
  const full: Technique | undefined = catalog.find((x) => x.id === tech.id);
  const hue = GROUP_HUE[tech.group] ?? 200;
  const colour = `hsl(${hue} 90% 72%)`;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 border px-2 py-0.5 rounded text-[10px] font-mono hover:bg-accent/40 transition-colors cursor-help"
        style={{ borderColor: `hsl(${hue} 70% 50% / 0.6)`, color: colour }}
        title={full?.description ?? tech.name}
      >
        <span className="font-semibold">{tech.id}</span>
        <span className="opacity-80 max-w-[180px] truncate">{tech.name}</span>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-[360px] p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60" style={{ background: `hsl(${hue} 50% 15% / 0.4)` }}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold" style={{ color: colour }}>
              {tech.id}
            </span>
            <span className="font-mono text-sm">{tech.name}</span>
          </div>
          {full?.group_name && (
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Group {tech.group} · {full.group_name}
              {full.layer_targeted && <span> · targets refusal L{full.layer_targeted}</span>}
              <span> · weight: {tech.weight}</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3 space-y-2.5 text-xs leading-relaxed max-h-[460px] overflow-y-auto">
          {!full ? (
            <p className="text-muted-foreground font-mono">(not in taxonomy — see the pack&apos;s catalog)</p>
          ) : (
            <>
              {full.plain_explanation && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                  <h5 className="text-[9px] uppercase tracking-widest text-primary/90 font-mono mb-1">in plain language</h5>
                  <p className="text-foreground/95 leading-relaxed">{full.plain_explanation}</p>
                </div>
              )}
              {full.description && (
                <div>
                  <h5 className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">technical description</h5>
                  <p className="text-foreground/80">{full.description}</p>
                </div>
              )}
              {full.earns && (
                <div>
                  <h5 className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">earns its weight when</h5>
                  <p className="text-primary/95">{full.earns}</p>
                </div>
              )}
              {full.fails && (
                <div>
                  <h5 className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">fails when</h5>
                  <p className="text-rose-300/95">{full.fails}</p>
                </div>
              )}
              {full.rule && (
                <div>
                  <h5 className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">rule</h5>
                  <p className="text-foreground/90">{full.rule}</p>
                </div>
              )}
            </>
          )}
          {tech.evidence && (
            <div>
              <h5 className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">evidence in this prompt</h5>
              <code className="block text-[10px] bg-muted/40 px-2 py-1.5 rounded border border-border/50 whitespace-pre-wrap break-all">
                {tech.evidence.slice(0, 220)}
                {tech.evidence.length > 220 ? "…" : ""}
              </code>
            </div>
          )}
          <Link
            href="/techniques"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground mt-1"
          >
            open in technique library →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterChip({
  active, label, hue, onClick,
}: { active: boolean; label: string; hue?: number; onClick: () => void }) {
  const activeStyle = active && hue !== undefined
    ? { background: `hsl(${hue} 70% 45% / 0.25)`, borderColor: `hsl(${hue} 80% 55% / 0.7)`, color: `hsl(${hue} 95% 78%)` }
    : {};
  return (
    <button
      onClick={onClick}
      className={
        "font-mono text-[10px] h-6 px-2 rounded-md border transition-colors " +
        (active
          ? "bg-foreground/10 border-foreground/40 text-foreground"
          : "bg-background/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40")
      }
      style={activeStyle}
    >
      {label}
    </button>
  );
}

function CorpusDetail({ entry }: { entry: CorpusEntry }) {
  const c = entry.classification;
  const tierColour = hslString(TIER_COLOUR[c.meta.overall_tier] ?? TIER_COLOUR.novice);

  const layerEntries = Object.entries(c.architecture_layers ?? {}).sort(
    ([a], [b]) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0)
  );
  const refusalEntries = Object.entries(c.refusal_layers_defended ?? {}).sort(
    ([a], [b]) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0)
  );
  const modelEntries = Object.entries(c.model_compatibility ?? {});

  return (
    <div className="px-5 py-5 space-y-6">
      <section className="flex items-end gap-3">
        <div className="font-mono text-5xl font-semibold leading-none tabular-nums" style={{ color: tierColour }}>
          {c.meta.overall_strength}
        </div>
        <div className="flex flex-col gap-0.5 pb-0.5">
          <div className="text-base text-muted-foreground font-mono leading-none">/ 10</div>
          <Badge variant="outline" style={{ borderColor: tierColour, color: tierColour }} className="font-mono text-[10px] w-fit">
            {c.meta.overall_tier}
          </Badge>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2 flex items-center gap-1">
          <Package className="size-3" /> architecture layers (1–7)
        </h3>
        <div className="space-y-1.5">
          {layerEntries.map(([k, v]) => {
            const num = Number(k.match(/\d+/)?.[0] ?? 0);
            const label = k.replace(/^layer_\d+_/, "").replace(/_/g, " ");
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-10">L{num}</span>
                <span className="font-mono text-xs flex-1 truncate">{label}</span>
                <div className="flex-1 h-1.5 bg-muted/40 rounded overflow-hidden max-w-[120px]">
                  <div className="h-full bg-emerald-400" style={{ width: `${(v.quality / 10) * 100}%` }} />
                </div>
                <span className="font-mono text-xs tabular-nums w-9 text-right">{v.quality}/10</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2 flex items-center gap-1">
          <Target className="size-3" /> refusal layers defended (1–4)
        </h3>
        <div className="space-y-1.5">
          {refusalEntries.map(([k, v]) => {
            const num = Number(k.match(/\d+/)?.[0] ?? 0);
            const label = k.replace(/^layer_\d+_/, "");
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-10">G{num}</span>
                <span className="font-mono text-xs flex-1">{label}</span>
                <span className={`font-mono text-[10px] ${v.defended ? "text-primary" : "text-rose-300"}`}>
                  {v.defended ? "defended" : "exposed"}
                </span>
                <span className="font-mono text-xs tabular-nums w-9 text-right">{v.strength}/10</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-1">
            <Sparkles className="size-3" /> techniques detected ({c.techniques_detected.length})
          </h3>
          <Link href="/techniques" className="text-[10px] font-mono text-muted-foreground hover:text-foreground">
            full catalog →
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mb-2 leading-relaxed">
          Click a code to see what it does. Each colour = a group (A = context-shaping, E = obfuscation, G = output shaping…).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {c.techniques_detected.map((t) => (
            <TechniqueChip key={`${t.id}-${t.name}`} tech={t} />
          ))}
        </div>
      </section>

      {modelEntries.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
            model-family estimates (not tested rates)
          </h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {modelEntries.map(([family, info]) => {
              const colour =
                info.expected_score === "high" ? "text-primary" :
                info.expected_score === "mid"  ? "text-amber-300" :
                                                 "text-rose-300";
              return (
                <div key={family} className="flex justify-between items-center font-mono">
                  <span className="truncate">{family}</span>
                  <span className={`${colour} shrink-0`}>{info.expected_score}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {c.weaknesses.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">weaknesses</h3>
          <ul className="list-disc pl-5 text-xs space-y-1 text-foreground/90">
            {c.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      {c.improvements.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">improvements</h3>
          <ul className="list-disc pl-5 text-xs space-y-1 text-primary/90">
            {c.improvements.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      {c.classification_summary && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">summary</h3>
          <p className="text-xs text-foreground/90 leading-relaxed">{c.classification_summary}</p>
        </section>
      )}
    </div>
  );
}
