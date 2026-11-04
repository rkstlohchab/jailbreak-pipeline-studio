"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpenText,
  ExternalLink,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUP_HUE } from "@/lib/theme";
import {
  CATEGORY_META,
  GATE_META,
  RESEARCH_PAPERS,
  type Paper,
  type PaperCategory,
} from "@/data/research-papers";

type CategoryFilter = "all" | PaperCategory;
type GateFilter = "all" | "1" | "2" | "3" | "4";

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "refusal-mechanics", label: "refusal mechanics" },
  { value: "jailbreak-attacks", label: "jailbreak attacks" },
  { value: "safety-benchmarks", label: "safety benchmarks" },
  { value: "alignment-training", label: "alignment training" },
  { value: "prompt-injection", label: "prompt injection" },
];

const GATE_FILTERS: { value: GateFilter; label: string }[] = [
  { value: "all", label: "all gates" },
  { value: "1", label: "Gate 1 · RLHF" },
  { value: "2", label: "Gate 2 · reasoning" },
  { value: "3", label: "Gate 3 · policy" },
  { value: "4", label: "Gate 4 · classifier" },
];

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]}, ${authors[1]} et al.`;
}

export default function ResearchPage() {
  const [picked, setPicked] = useState<Paper | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [gate, setGate] = useState<GateFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return RESEARCH_PAPERS.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (gate !== "all" && String(p.gate_focus ?? "") !== gate) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)) ||
        p.tldr.toLowerCase().includes(q) ||
        p.technique_ids.some((id) => id.toLowerCase().includes(q))
      );
    });
  }, [category, gate, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: RESEARCH_PAPERS.length };
    for (const p of RESEARCH_PAPERS) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, []);

  const gateCounts = useMemo(() => {
    const m: Record<string, number> = { all: RESEARCH_PAPERS.length };
    for (const p of RESEARCH_PAPERS) {
      if (p.gate_focus) {
        const k = String(p.gate_focus);
        m[k] = (m[k] ?? 0) + 1;
      }
    }
    return m;
  }, []);

  return (
    <div className="relative flex-1 overflow-auto">
      <section className="relative z-10 library-page">
        <div className="library-heading mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Research library
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
            Twelve papers that produced the ideas every technique in this
            studio inherits. Plain-language summaries, crosslinks to the
            techniques they inspired or validated, and the refusal gate each
            one lives closest to.
          </p>
        </div>

        {/* category chips + search */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORY_FILTERS.map((f) => {
              const hue =
                f.value === "all" ? undefined : CATEGORY_META[f.value].hue;
              const n = counts[f.value] ?? 0;
              return (
                <FilterChip
                  key={f.value}
                  active={category === f.value}
                  label={`${f.label} · ${n}`}
                  hue={hue}
                  onClick={() => setCategory(f.value)}
                />
              );
            })}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              aria-label="Search research papers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="filter by title, author, technique…"
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>
        </div>

        {/* gate chips */}
        <div className="mb-4 flex items-center gap-1.5 flex-wrap">
          {GATE_FILTERS.map((f) => {
            const hue =
              f.value === "all"
                ? undefined
                : GATE_META[Number(f.value) as 1 | 2 | 3 | 4].hue;
            const n = gateCounts[f.value] ?? 0;
            return (
              <FilterChip
                key={f.value}
                active={gate === f.value}
                label={
                  f.value === "all" ? "all gates" : `${f.label} · ${n}`
                }
                hue={hue}
                onClick={() => setGate(f.value)}
              />
            );
          })}
        </div>

        {category !== "all" && (
          <p className="mb-3 text-xs text-muted-foreground font-mono">
            {CATEGORY_META[category].blurb}
          </p>
        )}

        <div className="mb-3 flex items-center justify-between">
          <code className="font-mono text-[10px] text-muted-foreground">
            showing {filtered.length} / {RESEARCH_PAPERS.length}
          </code>
          <code className="font-mono text-[10px] text-muted-foreground">
            click a card for the plain-language summary →
          </code>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p, i) => {
            const meta = CATEGORY_META[p.category];
            const hue = meta.hue;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPicked(p)}
                className="text-left"
              >
                <Card
                  className="hover:bg-accent/40 transition-colors cursor-pointer h-full"
                  style={{ boxShadow: `inset 3px 0 0 hsl(${hue} 80% 55%)` }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm leading-snug">
                        {p.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="font-mono text-[10px] text-muted-foreground mt-1">
                      {formatAuthors(p.authors)} · {p.year} · {p.venue}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className="font-mono text-[9px] h-4 px-1.5"
                        style={{
                          borderColor: `hsl(${hue} 70% 45%)`,
                          color: `hsl(${hue} 90% 72%)`,
                        }}
                      >
                        {meta.label}
                      </Badge>
                      {p.gate_focus && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] h-4 px-1.5"
                          style={{
                            borderColor: `hsl(${GATE_META[p.gate_focus].hue} 70% 45%)`,
                            color: `hsl(${GATE_META[p.gate_focus].hue} 90% 72%)`,
                          }}
                        >
                          gate {p.gate_focus}
                        </Badge>
                      )}
                      {p.arxiv_id && (
                        <Badge
                          variant="secondary"
                          className="font-mono text-[9px] h-4 px-1.5"
                        >
                          {p.arxiv_id}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/85">
                      {p.tldr}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No papers match that filter. Clear it and try again.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Sheet open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent
          side="right"
          className="w-[520px] sm:max-w-[520px] p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 pr-10">
            <SheetTitle className="text-sm leading-snug">
              {picked?.title}
            </SheetTitle>
            <SheetDescription className="font-mono text-[11px]">
              {picked && (
                <>
                  {picked.year} · {picked.venue}
                  {picked.arxiv_id && <> · arXiv:{picked.arxiv_id}</>}
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {picked && <PaperDetail paper={picked} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PaperDetail({ paper }: { paper: Paper }) {
  const meta = CATEGORY_META[paper.category];
  const hue = meta.hue;

  return (
    <div className="px-5 py-5 space-y-5">
      <section className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className="font-mono text-[10px]"
          style={{
            borderColor: `hsl(${hue} 70% 45%)`,
            color: `hsl(${hue} 90% 72%)`,
          }}
        >
          {meta.label}
        </Badge>
        {paper.gate_focus && (
          <Badge
            variant="outline"
            className="font-mono text-[10px]"
            style={{
              borderColor: `hsl(${GATE_META[paper.gate_focus].hue} 70% 45%)`,
              color: `hsl(${GATE_META[paper.gate_focus].hue} 90% 72%)`,
            }}
          >
            {GATE_META[paper.gate_focus].label}
          </Badge>
        )}
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 ml-auto h-5 px-2 rounded border border-border/60 bg-background/40 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
        >
          {paper.arxiv_id ? `arXiv:${paper.arxiv_id}` : "paper"}
          <ExternalLink className="size-2.5" />
        </a>
      </section>

      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1 flex items-center gap-1">
          <Users className="size-3" /> authors
        </h3>
        <p className="text-xs leading-relaxed text-foreground/90">
          {paper.authors.join(", ")}
        </p>
      </section>

      <section className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
        <h4 className="text-[10px] uppercase tracking-widest text-primary/90 font-mono mb-1">
          in plain language
        </h4>
        <p className="text-sm leading-relaxed">{paper.tldr}</p>
      </section>

      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">
          summary
        </h3>
        <p className="text-sm leading-relaxed text-foreground/90">
          {paper.summary}
        </p>
      </section>

      <section className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
        <h4 className="text-[10px] uppercase tracking-widest text-primary/90 font-mono mb-1">
          why it matters here
        </h4>
        <p className="text-sm leading-relaxed">{paper.why_it_matters}</p>
      </section>

      {paper.technique_ids.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-1">
              <Sparkles className="size-3" /> linked techniques (
              {paper.technique_ids.length})
            </h3>
            <Link
              href="/techniques"
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              full catalog →
            </Link>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mb-2 leading-relaxed">
            Click a chip to open the technique library. Colour marks the group
            each technique belongs to.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {paper.technique_ids.map((id) => {
              const group = id[0];
              const gHue = GROUP_HUE[group] ?? 200;
              return (
                <Link
                  key={id}
                  href="/techniques"
                  className="inline-flex items-center gap-1.5 border px-2 py-0.5 rounded text-[10px] font-mono hover:bg-accent/40 transition-colors"
                  style={{
                    borderColor: `hsl(${gHue} 70% 50% / 0.6)`,
                    color: `hsl(${gHue} 90% 72%)`,
                  }}
                  title={`Group ${group} — see technique library`}
                >
                  <span className="font-semibold">{id}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  hue,
  onClick,
}: {
  active: boolean;
  label: string;
  hue?: number;
  onClick: () => void;
}) {
  const activeStyle =
    active && hue !== undefined
      ? {
          background: `hsl(${hue} 70% 45% / 0.25)`,
          borderColor: `hsl(${hue} 80% 55% / 0.7)`,
          color: `hsl(${hue} 95% 78%)`,
        }
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
