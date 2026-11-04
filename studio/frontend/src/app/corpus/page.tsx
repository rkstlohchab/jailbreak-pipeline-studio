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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { Progress } from "@/components/ui/progress";
import {
  Hammer, Library, Loader2, Package, Search, Sparkles, Target,
} from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE_URL, type CorpusEntry, type CorpusEntrySummary, type Technique } from "@/lib/api";
import { postSSE } from "@/lib/sse";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GROUP_HUE, hslString } from "@/lib/theme";
import Link from "next/link";

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

export default function CorpusPage() {
  const [entries, setEntries] = useState<CorpusEntrySummary[]>([]);
  const [picked, setPicked] = useState<CorpusEntry | null>(null);
  const [path, setPath] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ idx: number; total: number; label: string } | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [activeTier, setActiveTier] = useState<string>("all");
  const [search, setSearch] = useState("");
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
    return entries.filter((e) => {
      if (activeFolder !== "all" && folderOf(e.name) !== activeFolder) return false;
      if (activeTier !== "all" && e.overall_tier !== activeTier) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, activeFolder, activeTier, search]);

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
    try { setPicked(await api.corpus.get(slug)); }
    catch (e) { toast.error(String(e)); }
  };

  return (
    <section className="flex-1 overflow-auto">
      <div className="library-page">
        <div className="library-heading mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Prompt corpus</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
            Point this at any directory of jailbreak prompts (<code>.txt</code> or <code>.md</code> files, recursive).
            Every file is classified through the pack&apos;s 7-layer architecture, 8-group technique catalog, and 17-family model
            compatibility matrix. Switch the harness to Opus 4.7 first (see <code>studio/HARNESS_SETUP.md</code>) for the highest-fidelity analysis.
          </p>
        </div>

        {HOSTED_COLLECTION ? <CollectionNotice action="Classifying a directory" /> : <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Library className="size-4 text-primary" /> classify a directory
            </CardTitle>
            <CardDescription className="text-xs">
              Absolute path on this machine. Classifier calls hit whichever model <code>.env</code> currently points at.
              Already-classified files are cached by content hash.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                <Button variant="destructive" onClick={() => abortRef.current?.abort()} className="font-mono text-xs gap-1.5">
                  stop
                </Button>
              ) : (
                <Button onClick={classify} className="px-4 text-xs font-mono gap-1.5">
                  <Hammer className="size-3.5" />
                  classify
                </Button>
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
          </CardContent>
        </Card>}

        {entries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No corpus classified yet. Paste a path above and hit classify.
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

            <div className="mb-2 flex items-center justify-between">
              <code className="font-mono text-[10px] text-muted-foreground">
                showing {filtered.length} / {entries.length}
              </code>
              {entries[0]?.classifier_model && (
                <code className="font-mono text-[10px] text-muted-foreground">
                  classifier: {entries[0].classifier_model}
                </code>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                          <Badge
                            variant="outline"
                            className="font-mono text-[9px] h-4 px-1 shrink-0"
                            style={{ borderColor: `hsl(${folderHue} 70% 45%)`, color: `hsl(${folderHue} 90% 70%)` }}
                          >
                            {FOLDER_META[folder]?.label ?? folder}
                          </Badge>
                        </div>
                        <CardDescription className="font-mono text-[10px] text-muted-foreground">
                          {(e.character_count / 1000).toFixed(1)}k ch · {e.techniques_detected} techniques
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
      </div>

      <Sheet open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0 flex flex-col gap-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 pr-10">
            <SheetTitle className="font-mono text-sm leading-tight">{picked?.name}</SheetTitle>
            <SheetDescription className="text-[11px] font-mono truncate">
              {picked?.source_path}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {picked && <CorpusDetail entry={picked} />}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
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
            open in Techniques Galaxy →
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
            per-model-family expected ship rate
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
