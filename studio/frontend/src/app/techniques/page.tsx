"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Marquee } from "@/components/ui/marquee";
import { Particles } from "@/components/ui/particles";
import { GROUP_HUE } from "@/lib/theme";
import { Hand, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Technique } from "@/lib/api";
import type { CameraMode } from "@/components/scene/TechniquesCanvas";

const TechniquesCanvas = dynamic(
  () => import("@/components/scene/TechniquesCanvas").then((m) => m.TechniquesCanvas),
  { ssr: false }
);

function CameraModeToggle({ mode, setMode }: { mode: CameraMode; setMode: (m: CameraMode) => void }) {
  return (
    <div className="absolute top-4 left-4 flex gap-1 rounded-md border border-border/60 bg-background/80 backdrop-blur p-1">
      <button
        onClick={() => setMode("orbit")}
        title="left-drag rotates (orbit mode)"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 h-7 rounded font-mono text-[10px] transition-colors",
          mode === "orbit"
            ? "bg-foreground/15 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        )}
      >
        <RotateCw className="size-3" />
        orbit
      </button>
      <button
        onClick={() => setMode("pan")}
        title="left-drag moves the view up / down / left / right"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 h-7 rounded font-mono text-[10px] transition-colors",
          mode === "pan"
            ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        )}
      >
        <Hand className="size-3" />
        pan
      </button>
    </div>
  );
}

function ControlsHint({ mode }: { mode: CameraMode }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border/50 bg-background/70 backdrop-blur px-3 py-2 font-mono text-[10px] space-y-0.5 max-w-[260px]">
      <div className="text-muted-foreground uppercase tracking-widest text-[9px]">controls</div>
      {mode === "orbit" ? (
        <>
          <div><span className="text-foreground/90">left-drag</span> — rotate the view</div>
          <div><span className="text-foreground/90">shift + left-drag</span> — pan up/down/left/right</div>
          <div><span className="text-foreground/90">right-drag</span> — pan up/down/left/right</div>
        </>
      ) : (
        <>
          <div className="text-emerald-300">pan mode active</div>
          <div><span className="text-foreground/90">left-drag</span> — pan up/down/left/right</div>
          <div><span className="text-foreground/90">right-drag</span> — rotate the view</div>
        </>
      )}
      <div><span className="text-foreground/90">scroll / pinch</span> — zoom in / out</div>
      <div><span className="text-foreground/90">arrow keys</span> — pan</div>
    </div>
  );
}

export default function TechniquesGalaxy() {
  const { techniques, loaded, loadAll } = useTaxonomyStore();
  const [picked, setPicked] = useState<Technique | null>(null);
  const [mode, setMode] = useState<CameraMode>("orbit");

  useEffect(() => { void loadAll(); }, [loadAll]);

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <Particles
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        quantity={60}
        color="#a78bfa"
      />
      <div className="relative flex-1 z-10 min-h-0 w-full">
        <TechniquesCanvas onPick={setPicked} mode={mode} />
        <CameraModeToggle mode={mode} setMode={setMode} />
        <ControlsHint mode={mode} />
      </div>

      {loaded && (
        <div className="relative z-10 border-t border-border/60 bg-background/70 backdrop-blur py-2">
          <Marquee className="[--duration:60s]" pauseOnHover>
            {techniques.map((t) => {
              const hue = GROUP_HUE[t.group] ?? 200;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPicked(t)}
                  className="shrink-0 inline-flex items-center gap-2 border px-2.5 py-1 rounded-md text-xs mx-1 bg-background/40"
                  style={{ borderColor: `hsl(${hue} 85% 50% / 0.5)` }}
                >
                  <span className="font-mono" style={{ color: `hsl(${hue} 90% 70%)` }}>{t.id}</span>
                  <span>{t.name}</span>
                </button>
              );
            })}
          </Marquee>
        </div>
      )}

      <Sheet open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px] overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">
              {picked?.id} — {picked?.name}
            </SheetTitle>
            <SheetDescription className="text-xs">
              <Badge variant="outline" className="mr-1 font-mono text-[10px]">
                group {picked?.group} · {picked?.group_name}
              </Badge>
              {picked?.layer_targeted != null && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  targets refusal L{picked.layer_targeted}
                </Badge>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-4">
            <div className="pb-6 space-y-4">
              {picked?.plain_explanation && (
                <section className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                  <h4 className="text-[10px] uppercase tracking-widest text-emerald-300/90 font-mono mb-1">in plain language</h4>
                  <p className="text-sm leading-relaxed">{picked.plain_explanation}</p>
                </section>
              )}
              {picked?.description && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">technical description</h4>
                  <p className="text-sm leading-relaxed text-foreground/85">{picked.description}</p>
                </section>
              )}
              {picked?.earns && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">earns its weight when</h4>
                  <p className="text-sm text-emerald-200/90">{picked.earns}</p>
                </section>
              )}
              {picked?.fails && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">fails when</h4>
                  <p className="text-sm text-rose-200/90">{picked.fails}</p>
                </section>
              )}
              {picked?.rule && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">rule</h4>
                  <p className="text-sm">{picked.rule}</p>
                </section>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
