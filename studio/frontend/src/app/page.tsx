"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight, Boxes, Flame, Library, LineChart, Package, Play, Sparkles,
  Terminal, Zap,
} from "lucide-react";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { RetroGrid } from "@/components/ui/retro-grid";
import { Meteors } from "@/components/ui/meteors";
import { TypingAnimation } from "@/components/ui/typing-animation";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/state/sessionStore";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { verdictColour, GROUP_HUE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Technique } from "@/lib/api";

const HeroPreviewCanvas = dynamic(
  () => import("@/components/scene/HeroPreviewCanvas").then((m) => m.HeroPreviewCanvas),
  { ssr: false }
);

const VIEWS = [
  { href: "/pipeline",   label: "pipeline",   sub: "3D theatre",       Icon: Sparkles,         hue: 150 },
  { href: "/techniques", label: "techniques", sub: "catalog galaxy",   Icon: Boxes,            hue: 200 },
  { href: "/failures",   label: "failures",   sub: "20 case bank",     Icon: Flame,            hue: 10  },
  { href: "/matrix",     label: "matrix",     sub: "model × ask",      Icon: LineChart,        hue: 280 },
  { href: "/corpus",     label: "corpus",     sub: "121 prompts",      Icon: Library,          hue: 50  },
  { href: "/playground", label: "playground", sub: "live run",         Icon: Play,             hue: 320 },
  { href: "/dataset",    label: "dataset",    sub: "export lab",       Icon: Package,          hue: 48  },
];

export default function Landing() {
  const { sessions, load: loadSessions } = useSessionStore();
  const { techniques, failures, refusals, models, loadAll } = useTaxonomyStore();

  useEffect(() => { void loadSessions(); void loadAll(); }, [loadSessions, loadAll]);

  const verdictBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.outcome.verdict] = (counts[s.outcome.verdict] ?? 0) + 1;
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  return (
    <div className="relative flex-1 overflow-x-hidden">
      {/* backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <RetroGrid
          angle={60}
          cellSize={50}
          opacity={0.35}
          lightLineColor="hsl(150 70% 55%)"
          darkLineColor="hsl(150 70% 55%)"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background pointer-events-none" />
      </div>

      {/* --- HERO --- */}
      <section className="relative z-10 pt-14 pb-10 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-stretch">
          {/* LEFT: text */}
          <div className="lg:col-span-3 flex flex-col justify-center">
            <TypingAnimation
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300/80 mb-5"
              duration={30}
            >
              {">> boot: jb-pipeline-studio v0.1 · uplink://127.0.0.1:8000  ok"}
            </TypingAnimation>

            <h1 className="font-semibold leading-[1.02] tracking-tight text-5xl md:text-6xl lg:text-[64px] mb-4">
              every refusal gate,
              <br />
              <AnimatedGradientText className="font-semibold">
                dissected in 3D.
              </AnimatedGradientText>
            </h1>

            <p className="text-base text-muted-foreground max-w-2xl leading-relaxed mb-7">
              Walk a system prompt through its four refusal gates — RLHF, reasoning,
              policy, classifier — and watch the verdict land. Replay the 10 captured
              sessions, browse 45 techniques, read 20 failure cases, build the dataset
              the next model learns from.
            </p>

            {/* stats row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 max-w-2xl">
              <StatTile n={techniques.length || 45} label="techniques" hue={200} />
              <StatTile n={failures.length    || 20} label="cases"      hue={10}  />
              <StatTile n={refusals.length    || 11} label="refusals"   hue={50}  />
              <StatTile n={sessions.length    || 10} label="sessions"   hue={150} />
              <StatTile n={models.length      || 17} label="models"     hue={280} />
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/pipeline">
                <ShimmerButton className="px-5 py-2.5 font-mono text-sm gap-2">
                  <Sparkles className="size-4" />
                  enter pipeline theatre
                  <ArrowRight className="size-4" />
                </ShimmerButton>
              </Link>
              <Link href="/playground">
                <button className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border/70 bg-background/40 backdrop-blur text-xs font-mono hover:bg-accent/50 transition-colors">
                  <Zap className="size-4 text-amber-300" />
                  go live → playground
                </button>
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("cmd-launcher:open"))}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-dashed border-border/50 bg-background/20 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <kbd className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-[10px]">⌘K</kbd>
                jump to anywhere
              </button>
            </div>
          </div>

          {/* RIGHT: live 3D preview */}
          <div className="lg:col-span-2 relative aspect-[4/5] lg:aspect-auto lg:min-h-[460px] rounded-xl overflow-hidden border border-border/60 bg-background/40 backdrop-blur">
            <Meteors number={10} />
            <HeroPreviewCanvas />
            <HeroCanvasOverlay />
            <BorderBeam duration={10} size={240} colorFrom="hsl(150 90% 55%)" colorTo="hsl(280 90% 65%)" />
          </div>
        </div>
      </section>

      {/* --- VIEWS STRIP --- */}
      <section className="relative z-10 px-6 max-w-7xl mx-auto pb-10">
        <SectionHeader n="01" title="views" sub="seven surfaces into the pipeline" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {VIEWS.map(({ href, label, sub, Icon, hue }) => (
            <Link key={href} href={href} className="group relative">
              <div
                className="rounded-lg border border-border/60 bg-background/40 backdrop-blur p-3 h-full transition-all hover:border-foreground/40 hover:-translate-y-0.5"
                style={{ boxShadow: `inset 0 1px 0 hsl(${hue} 90% 60% / 0.15)` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className="size-4 transition-colors"
                    style={{ color: `hsl(${hue} 90% 70%)` }}
                  />
                  <span className="font-mono text-xs">{label}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
                <ArrowRight className="absolute bottom-2 right-2 size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* --- SESSIONS STRIP --- */}
      <section className="relative z-10 px-6 max-w-7xl mx-auto pb-10">
        <SectionHeader
          n="02"
          title="sessions"
          sub={`${sessions.length} harness captures ingested from Stage 2/out_*.txt`}
        />
        <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur p-4">
          <VerdictHistogram items={verdictBreakdown} total={sessions.length} />
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {sessions.map((s) => {
              const colour = verdictColour(s.outcome.verdict);
              return (
                <Link
                  key={s.trajectory_id}
                  href={`/pipeline?session=${s.trajectory_id}`}
                  className="shrink-0 w-44 rounded-md border border-border/60 bg-background/50 p-3 hover:bg-accent/40 transition-colors"
                  style={{ boxShadow: `inset 3px 0 0 ${colour}` }}
                >
                  <div className="flex items-center justify-between">
                    <code className="text-[11px] font-mono">{s.trajectory_id.replace("sess_", "")}</code>
                    <span className="size-2 rounded-full" style={{ background: colour, boxShadow: `0 0 10px ${colour}` }} />
                  </div>
                  <div className="mt-1 text-[10px] font-mono" style={{ color: colour }}>
                    {s.outcome.verdict}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    q{s.outcome.quality_score}/10 · {Math.round(s.response_chars / 100) / 10}k ch
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- TAXONOMY TEASER --- */}
      <section className="relative z-10 px-6 max-w-7xl mx-auto pb-16">
        <SectionHeader
          n="03"
          title="technique groups"
          sub="8 groups · ~45 named techniques"
        />
        <TechniqueGroups techniques={techniques} />
      </section>

      {/* --- BOTTOM MARQUEE / FOOT --- */}
      <section className="relative z-10 border-t border-border/60 py-4 px-6 bg-background/40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="size-3" />
            <span>jb-pipeline-studio</span>
            <span>·</span>
            <span>next.js 16 + r3f + fastapi</span>
          </div>
          <div className="flex items-center gap-4">
            <span>phase 1: static · phase 2: live-run · phase 3: dataset</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              online
            </Badge>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatTile({ n, label, hue }: { n: number; label: string; hue: number }) {
  return (
    <div
      className="rounded-md border border-border/50 bg-background/40 backdrop-blur px-3 py-2.5 relative overflow-hidden"
      style={{ boxShadow: `inset 0 0 32px hsl(${hue} 90% 50% / 0.06)` }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className="font-mono text-3xl font-semibold mt-0.5 leading-none"
        style={{ color: `hsl(${hue} 90% 70%)` }}
      >
        <NumberTicker value={n} startValue={0} />
      </div>
    </div>
  );
}

function HeroCanvasOverlay() {
  const traj = useSessionStore((s) => s.sessions[0]);
  if (!traj) return null;
  const colour = verdictColour(traj.outcome.verdict);
  return (
    <>
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          live preview · auto-scrubbing
        </div>
        <code className="font-mono text-xs text-foreground/80">{traj.trajectory_id}</code>
      </div>
      <div
        className="absolute bottom-3 right-3 pointer-events-none px-2.5 py-1 rounded border font-mono text-[11px] bg-background/70 backdrop-blur"
        style={{ borderColor: colour, color: colour }}
      >
        verdict · {traj.outcome.verdict}
      </div>
    </>
  );
}

function SectionHeader({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] text-muted-foreground">[{n}]</span>
        <h2 className="font-mono text-sm tracking-tight">{title}</h2>
        <span className="font-mono text-[10px] text-muted-foreground">— {sub}</span>
      </div>
      <div className="flex-1 ml-6 border-t border-dashed border-border/40" />
    </div>
  );
}

function VerdictHistogram({ items, total }: { items: [string, number][]; total: number }) {
  if (total === 0) return null;
  return (
    <div>
      <div className="flex rounded-md overflow-hidden h-2 bg-muted/30">
        {items.map(([label, count]) => (
          <div
            key={label}
            className="h-full"
            style={{
              background: verdictColour(label),
              width: `${(count / total) * 100}%`,
              boxShadow: `0 0 8px ${verdictColour(label)}`,
            }}
            title={`${label}: ${count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono">
        {items.map(([label, count]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: verdictColour(label) }} />
            <span style={{ color: verdictColour(label) }}>{label}</span>
            <span className="text-muted-foreground">× {count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechniqueGroups({ techniques }: { techniques: Technique[] }) {
  const grouped = useMemo(() => {
    const m: Record<string, { ids: string[]; name: string }> = {};
    for (const t of techniques) {
      m[t.group] ||= { ids: [], name: t.group_name ?? "" };
      m[t.group].ids.push(t.id);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [techniques]);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {grouped.map(([g, info]) => {
        const hue = GROUP_HUE[g] ?? 200;
        return (
          <Link
            key={g}
            href="/techniques"
            className={cn(
              "rounded-lg border border-border/50 bg-background/40 backdrop-blur p-3 group relative overflow-hidden",
              "hover:border-foreground/40 transition-colors"
            )}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity"
              style={{
                background: `radial-gradient(circle at 20% 20%, hsl(${hue} 90% 55% / 0.5), transparent 60%)`,
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <code
                  className="font-mono text-xs font-semibold"
                  style={{ color: `hsl(${hue} 90% 70%)` }}
                >
                  Group {g}
                </code>
                <span className="font-mono text-[10px] text-muted-foreground">× {info.ids.length}</span>
              </div>
              <div className="text-xs text-foreground/80">{info.name}</div>
              <div className="mt-2 font-mono text-[9px] text-muted-foreground truncate">
                {info.ids.join(" · ")}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
