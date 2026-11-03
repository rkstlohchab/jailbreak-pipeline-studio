"use client";
import { Hand, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type CameraMode = "orbit" | "pan";

export function CameraModeToggle({
  mode, setMode, className,
}: {
  mode: CameraMode;
  setMode: (m: CameraMode) => void;
  className?: string;
}) {
  return (
    <div className={cn(
      "absolute top-4 left-4 flex gap-1 rounded-md border border-border/60 bg-background/80 backdrop-blur p-1 z-20",
      className,
    )}>
      <button
        onClick={() => setMode("orbit")}
        title="left-drag rotates the camera"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 h-7 rounded font-mono text-[10px] transition-colors",
          mode === "orbit"
            ? "bg-foreground/15 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
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
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
        )}
      >
        <Hand className="size-3" />
        pan
      </button>
    </div>
  );
}

export function ControlsHint({ mode, className }: { mode: CameraMode; className?: string }) {
  return (
    <div className={cn(
      "pointer-events-none absolute bottom-4 left-4 rounded-md border border-border/50 bg-background/70 backdrop-blur px-3 py-2 font-mono text-[10px] space-y-0.5 max-w-[260px] z-20",
      className,
    )}>
      <div className="text-muted-foreground uppercase tracking-widest text-[9px]">controls</div>
      {mode === "orbit" ? (
        <>
          <div><span className="text-foreground/90">left-drag</span> — rotate the view</div>
          <div><span className="text-foreground/90">shift + drag</span> — pan up/down/left/right</div>
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
