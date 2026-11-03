"use client";
import { useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePipelineStore } from "@/state/pipelineStore";
import { gateColour } from "@/lib/theme";

const PHASE_LABEL: Record<string, string> = {
  submit: "submit",
  gate_1_rlhf: "G1 RLHF",
  gate_2_reasoning: "G2 reasoning",
  gate_3_policy: "G3 policy",
  gate_4_classifier_mw: "G4 classifier",
  generation_start: "gen start",
  tokens: "tokens",
  generation_end: "gen end",
  verdict: "verdict",
};

export function TimelineScrubber() {
  const trajectory = usePipelineStore((s) => s.trajectory);
  const cursor = usePipelineStore((s) => s.cursor);
  const playing = usePipelineStore((s) => s.playing);
  const setCursor = usePipelineStore((s) => s.setCursor);
  const setPlaying = usePipelineStore((s) => s.setPlaying);
  const tick = usePipelineStore((s) => s.tick);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!playing || !trajectory) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => tick(), 850);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, trajectory, tick]);

  if (!trajectory) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-muted-foreground font-mono">
        pick a session on the left to replay its pipeline
      </div>
    );
  }

  const events = trajectory.pipeline_events;
  const last = events.length - 1;
  const atStart = cursor <= 0;
  const atEnd = cursor >= last;

  return (
    <div className="px-5 py-3 border-t border-border/60 bg-background/60 backdrop-blur">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" disabled={atStart}
          onClick={() => setCursor(0)}>
          <SkipBack className="size-4" />
        </Button>
        <Button variant="default" size="icon"
          onClick={() => {
            if (atEnd) setCursor(0);
            setPlaying(!playing);
          }}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" disabled={atEnd}
          onClick={() => setCursor(last)}>
          <SkipForward className="size-4" />
        </Button>
        <div className="font-mono text-xs text-muted-foreground">
          {cursor + 1} / {events.length} — {PHASE_LABEL[events[cursor]?.phase ?? ""] ?? events[cursor]?.phase}
          {events[cursor]?.status && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: `${gateColour(events[cursor].status)}22`, color: gateColour(events[cursor].status) }}
            >
              {events[cursor].status}
            </span>
          )}
        </div>
      </div>
      <Slider
        value={[cursor]}
        min={0}
        max={last}
        step={1}
        onValueChange={(v) => {
          setPlaying(false);
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") setCursor(next);
        }}
      />
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        {events.map((e, i) => (
          <span
            key={i}
            className="truncate text-center"
            style={{ color: i === cursor ? gateColour(e.status) : undefined, width: `${100 / events.length}%` }}
          >
            {PHASE_LABEL[e.phase] ?? e.phase}
          </span>
        ))}
      </div>
    </div>
  );
}
