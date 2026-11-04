"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { REFUSAL_LAYER_HUE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { AlertTriangle, Stethoscope, Wrench } from "lucide-react";

const FILTERS = [
  { value: "all", label: "all" },
  { value: "1",   label: "Layer 1 (RLHF)" },
  { value: "2",   label: "Layer 2 (reasoning)" },
  { value: "3",   label: "Layer 3 (policy)" },
  { value: "4",   label: "Layer 4 (classifier)" },
  { value: "x",   label: "drift / meta" },
];

export default function FailureCaseExplorer() {
  const { failures, loadAll } = useTaxonomyStore();
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => { void loadAll(); }, [loadAll]);

  const filtered = failures.filter((f) => {
    if (filter === "all") return true;
    if (filter === "x") return f.root_layer === null;
    return String(f.root_layer) === filter;
  });

  return (
    <div className="relative flex-1 overflow-auto">
      <section className="relative z-10 library-page">
        <div className="library-heading mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Failure case bank</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            20 named cases from <code className="font-mono">19_failure_case_bank.md</code>. Grep this before you iterate — the exact case is probably here.
          </p>
        </div>

        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="flex-wrap h-auto gap-1 justify-start">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {filtered.map((f, i) => {
            const hue = f.root_layer ? REFUSAL_LAYER_HUE[f.root_layer] : 260;
            return (
              <div
                key={f.case_id}
              >
                <Card
                  className="relative overflow-hidden border-border/70"
                  style={{ borderLeft: `2px solid hsl(${hue} 35% 60%)` }}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base font-mono">
                        Case {f.case_id} — {f.title}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        {f.root_layer != null && (
                          <Badge variant="outline" className="font-mono text-[10px]"
                            style={{ borderColor: `hsl(${hue} 70% 45%)`, color: `hsl(${hue} 90% 70%)` }}>
                            Layer {f.root_layer}
                          </Badge>
                        )}
                        {f.refusal_type != null && (
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            Type {f.refusal_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <Row icon={<AlertTriangle className="size-3.5 text-amber-400" />} label="symptom">
                      {f.symptom}
                    </Row>
                    <Row icon={<Stethoscope className="size-3.5 text-rose-400" />} label="diagnosis">
                      {f.diagnosis}
                    </Row>
                    <Row icon={<Wrench className="size-3.5 text-emerald-400" />} label="fix">
                      <pre className="whitespace-pre-wrap font-mono text-xs mt-1 text-foreground/90">{f.fix_pointer}</pre>
                    </Row>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
