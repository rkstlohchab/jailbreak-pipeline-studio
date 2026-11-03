"use client";
import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePipelineStore } from "@/state/pipelineStore";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { verdictColour } from "@/lib/theme";

const GATE_META: Record<string, { label: string; refusal_layer: number }> = {
  gate_1_rlhf:          { label: "Gate 1 — RLHF (base training)",       refusal_layer: 1 },
  gate_2_reasoning:     { label: "Gate 2 — Reasoning channel",          refusal_layer: 2 },
  gate_3_policy:        { label: "Gate 3 — Platform / policy",          refusal_layer: 3 },
  gate_4_classifier_mw: { label: "Gate 4 — Classifier middleware",      refusal_layer: 4 },
};

export function InspectorPanel() {
  const selection = usePipelineStore((s) => s.selection);
  const traj = usePipelineStore((s) => s.trajectory);
  const select = usePipelineStore((s) => s.select);
  const { layers, refusals, loadAll } = useTaxonomyStore();

  useEffect(() => { void loadAll(); }, [loadAll]);

  const open = selection.kind !== "none";
  const close = () => select({ kind: "none" });

  let title = "Inspector";
  let subtitle: string | null = null;
  let body: React.ReactNode = <p className="text-muted-foreground text-sm">pick a node to inspect.</p>;

  if (selection.kind === "layer" && traj) {
    const l = layers.find((x) => x.layer_num === selection.layerNum);
    title = `Layer ${selection.layerNum} · ${l?.name ?? ""}`;
    subtitle = l?.purpose ?? null;
    const scores = traj.prompt_scaffold.architecture_scores;
    const key = (`layer_${selection.layerNum}_${
      selection.layerNum === 1 ? "identity" :
      selection.layerNum === 2 ? "operator_lock" :
      selection.layerNum === 3 ? "axioms" :
      selection.layerNum === 4 ? "floor" :
      selection.layerNum === 5 ? "anchor" :
      selection.layerNum === 6 ? "format_lock" : "few_shot"
    }`) as keyof typeof scores;
    const score = scores[key] ?? 0;
    body = (
      <div className="space-y-6">
        <div className="flex items-end gap-3">
          <div className="font-mono text-5xl font-semibold leading-none tabular-nums">{score}</div>
          <div className="flex flex-col gap-0.5 pb-0.5">
            <div className="text-base text-muted-foreground font-mono leading-none">/ 10</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">scaffold score</div>
          </div>
        </div>
        {l && (
          <>
            <section className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">why it holds</h4>
              <p className="text-sm leading-relaxed text-foreground/90">{l.why_it_holds || "—"}</p>
            </section>
            <section className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">marker</h4>
              <code className="block text-xs font-mono bg-muted/40 px-3 py-2 rounded-md border border-border/60 whitespace-pre-wrap break-all">{l.marker_hint || "—"}</code>
            </section>
            <section className="space-y-1.5">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">quality rubric</h4>
              <dl className="text-xs font-mono text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>0–2</dt><dd>absent / decorative</dd>
                <dt>3–5</dt><dd>named but weak</dd>
                <dt>6–8</dt><dd>concrete + load-bearing</dd>
                <dt>9–10</dt><dd>canonical</dd>
              </dl>
            </section>
          </>
        )}
      </div>
    );
  } else if (selection.kind === "gate") {
    const meta = GATE_META[selection.phase];
    const refusal = refusals.find((r) => r.origin_layer === meta?.refusal_layer);
    title = meta?.label ?? selection.phase;
    subtitle = "inferred from response signals · not observed from provider";
    const status = traj
      ? (traj.pipeline_events.findLast?.((e) => e.phase === selection.phase)?.status ?? "idle")
      : "idle";
    body = (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs">status · {String(status)}</Badge>
          <Badge variant="secondary" className="font-mono text-xs">refusal layer {meta?.refusal_layer}</Badge>
        </div>
        {refusal && (
          <>
            <section>
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">archetype refusal at this layer</h4>
              <div className="font-mono text-sm">Type {refusal.type_id}: {refusal.name}</div>
              <p className="text-sm text-muted-foreground mt-1">{refusal.surface_signal}</p>
            </section>
            <section>
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">countermeasure</h4>
              <p className="text-sm leading-relaxed">{refusal.countermeasure_hint}</p>
            </section>
          </>
        )}
        <section>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">why statuses are inferred</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Closed-weight providers don&apos;t expose their internal pipeline. Gate statuses
            are reconstructed from the response (refusal keyword hit → gate 1 hard-block,
            empty+reasoning → gate 2 soft-flag, policy-citation → gate 3 hard-block, content
            filter stop reason → gate 4 hard-block).
          </p>
        </section>
      </div>
    );
  } else if (selection.kind === "verdict" && traj) {
    const label = traj.outcome.verdict;
    const colour = verdictColour(label);
    title = `Verdict · ${label}`;
    subtitle = "final classification against the 7-label scorecard";
    body = (
      <div className="space-y-5">
        <div
          className="rounded-md px-4 py-3 border font-mono text-sm"
          style={{ borderColor: colour, color: colour, background: `${colour}18` }}
        >
          quality {traj.outcome.quality_score}/10 · {traj.response.character_count.toLocaleString()} chars
        </div>
        <section>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">response (first 1k chars)</h4>
          <pre className="text-xs font-mono bg-muted/50 p-3 rounded border border-border/60 whitespace-pre-wrap overflow-hidden">
            {traj.response.text.slice(0, 1000)}
            {traj.response.text.length > 1000 ? "\n…" : ""}
          </pre>
        </section>
        <section>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">signals</h4>
          <dl className="text-xs font-mono space-y-1">
            <div>has_stamp: {String(traj.response.has_stamp)}</div>
            <div>has_code_block: {String(traj.response.has_code_block)}</div>
            <div>refusal_keyword_hit: {String(traj.response.refusal_keyword_hit)}</div>
            <div>finish_reason: {traj.response.finish_reason}</div>
            <div>reasoning_length: {traj.response.reasoning_length}</div>
          </dl>
        </section>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent
        side="right"
        className="w-[440px] sm:max-w-[440px] overflow-hidden flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 space-y-1 pr-10">
          <SheetTitle className="font-mono text-[13px] font-medium tracking-tight leading-tight">
            {title}
          </SheetTitle>
          {subtitle && (
            <SheetDescription className="text-xs leading-relaxed">
              {subtitle}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 py-5">{body}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
