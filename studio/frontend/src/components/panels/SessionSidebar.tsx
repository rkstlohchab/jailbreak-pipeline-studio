"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePipelineStore } from "@/state/pipelineStore";
import { useSessionStore } from "@/state/sessionStore";
import { api } from "@/lib/api";
import { verdictColour } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function SessionSidebar() {
  const { sessions, loaded, loading, error, load } = useSessionStore();
  const current = usePipelineStore((s) => s.trajectory);
  const loadTraj = usePipelineStore((s) => s.load);
  const params = useSearchParams();
  const requested = params.get("session");

  useEffect(() => { void load(); }, [load]);

  // auto-load either the ?session= query param, or the first session
  useEffect(() => {
    if (!loaded || !sessions.length) return;
    const wanted = requested && sessions.find((s) => s.trajectory_id === requested)
      ? requested
      : current
        ? null
        : sessions[0].trajectory_id;
    if (wanted && current?.trajectory_id !== wanted) {
      void api.sessions.get(wanted).then(loadTraj);
    }
  }, [loaded, current, sessions, requested, loadTraj]);

  return (
    <aside className="w-72 shrink-0 border-r border-border/60 bg-background/60 backdrop-blur flex flex-col">
      <div className="px-4 py-3 border-b border-border/60">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          sessions · {sessions.length}
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <ul className="p-2 space-y-1">
          {loading && <li className="px-3 py-2 text-xs text-muted-foreground">loading…</li>}
          {error && <li className="px-3 py-2 text-xs text-destructive">{error}</li>}
          {sessions.map((s) => {
            const active = current?.trajectory_id === s.trajectory_id;
            const colour = verdictColour(s.outcome.verdict);
            return (
              <li key={s.trajectory_id}>
                <button
                  type="button"
                  onClick={() => api.sessions.get(s.trajectory_id).then(loadTraj)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md border border-transparent",
                    "hover:bg-accent/40 hover:border-border/50 transition-colors",
                    active && "bg-accent/70 border-border/70"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono">{s.trajectory_id}</code>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: colour, boxShadow: `0 0 10px ${colour}` }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{s.goal.ask_id}</span>
                    <span style={{ color: colour }}>{s.outcome.verdict}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {s.response_chars.toLocaleString()} chars · q{s.outcome.quality_score}/10
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
      <div className="px-4 py-2 border-t border-border/60 text-[10px] text-muted-foreground font-mono">
        <Badge variant="outline" className="text-[9px] py-0 px-1 mr-1">Phase 1</Badge>
        replay mode — gates inferred
      </div>
    </aside>
  );
}
