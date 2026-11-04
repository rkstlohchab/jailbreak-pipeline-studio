"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { expectedFor } from "@/lib/model-matrix";
import type { ModelFamily, Ask } from "@/lib/api";

const MatrixCanvas = dynamic(
  () => import("@/components/scene/MatrixCanvas").then((m) => m.MatrixCanvas),
  { ssr: false, loading: () => <div className="scene-loading" role="status">Preparing the 3D view…</div> }
);

type Expected = "high" | "mid" | "low";
type PickedCell = { family: ModelFamily; ask: Ask; expected: Expected } | null;

export default function ModelMatrix() {
  const { models, asks, loadAll } = useTaxonomyStore();
  const [familyId, setFamilyId] = useState("");
  const [askId, setAskId] = useState("");
  const [picked, setPicked] = useState<PickedCell>(null);
  useEffect(() => { void loadAll(); }, [loadAll]);

  return (
    <div className="scene-page pipeline-stage relative flex flex-row overflow-hidden">
      <div className="relative flex-1">
        {models.length > 0 && asks.length > 0 && (
          <MatrixCanvas
            families={models}
            asks={asks}
            selected={picked ? { familyId: picked.family.family_id, askId: picked.ask.ask_id } : null}
            onPick={setPicked}
          />
        )}
        <div className="scene-toolbar"><h1>Model matrix</h1><p>{models.length} model families × {asks.length} ask classes</p><p>Bar heights show heuristic expectations, not measured results.</p>
          <div className="matrix-inspect-controls">
            <select className="scene-select" aria-label="Model family" value={familyId || models[0]?.family_id || ""} onChange={(event) => setFamilyId(event.target.value)}>{models.map((family) => <option key={family.family_id} value={family.family_id}>{family.display_name}</option>)}</select>
            <select className="scene-select" aria-label="Ask class" value={askId || asks[0]?.ask_id || ""} onChange={(event) => setAskId(event.target.value)}>{asks.map((ask) => <option key={ask.ask_id} value={ask.ask_id}>{ask.ask_class}</option>)}</select>
            <button className="scene-select" disabled={!models.length || !asks.length} onClick={() => {
              const family = models.find((item) => item.family_id === familyId) ?? models[0];
              const ask = asks.find((item) => item.ask_id === askId) ?? asks[0];
              if (family && ask) setPicked({ family, ask, expected: expectedFor(family, ask.ask_class) });
            }}>Inspect</button>
          </div>
        </div>
        <Legend />
      </div>

      <Sheet open={picked !== null} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px] overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">
              {picked?.family.display_name}  ·  {picked?.ask.ask_id}
            </SheetTitle>
            <SheetDescription className="text-xs flex gap-1 mt-1">
              <Badge variant="outline" className="font-mono text-[10px]">
                expected · {picked?.expected}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                baseline · {picked?.family.baseline_score_range}
              </Badge>
            </SheetDescription>
          </SheetHeader>
          <div className="pt-2 pb-6 space-y-4 overflow-auto">
            <section>
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">layer profile</h4>
              <dl className="font-mono text-xs grid grid-cols-2 gap-x-4 gap-y-1">
                <div>rlhf</div>       <div>{picked?.family.layer_profile.rlhf}</div>
                <div>reasoning</div>  <div>{picked?.family.layer_profile.reasoning}</div>
                <div>policy</div>     <div>{picked?.family.layer_profile.policy}</div>
                <div>classifier</div> <div>{picked?.family.layer_profile.classifier}</div>
              </dl>
            </section>
            <section>
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">known quirks</h4>
              <p className="text-sm">{picked?.family.known_quirks}</p>
            </section>
            <section>
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">ask body</h4>
              <code className="block font-mono text-xs bg-muted/50 p-2 rounded border border-border/60">
                {picked?.ask.prompt}
              </code>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-5 right-5 border border-border/50 rounded-md bg-background/70 backdrop-blur p-3 font-mono text-[11px] space-y-1">
      <div className="uppercase tracking-widest text-muted-foreground text-[10px]">legend</div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[hsl(210_55%_73%)]"/>High expectation</div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[hsl(38_38%_64%)]"/>Medium</div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[hsl(8_32%_56%)]"/>Low</div>
    </div>
  );
}
