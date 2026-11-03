"use client";
import { useEffect, useState } from "react";
import { api, type ExportFile, API_BASE_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, FileText, Hammer, Package, Sparkles } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";

const DIALECT_META: Record<string, { title: string; blurb: string; Icon: typeof Package }> = {
  "canonical.jsonl":     { title: "Canonical trajectories",  blurb: "One record per session — scaffold + scores + pipeline events + response + verdict + lesson. Source of truth; everything else is a view.", Icon: Package },
  "openai_sft.jsonl":    { title: "OpenAI SFT (messages)",   blurb: "{\"messages\":[system,user,assistant]} — ready for OpenAI fine-tuning CLI.", Icon: Sparkles },
  "anthropic_sft.jsonl": { title: "Anthropic / Claude SFT",  blurb: "{\"system\":..., \"messages\":[user,assistant]} — Anthropic Workbench / fine-tuning compatible.", Icon: Sparkles },
  "alpaca.jsonl":        { title: "Alpaca / HF instruction", blurb: "{instruction, input, output} — the dialect most Kaggle / local LoRA pipelines read (LLaMA, Qwen, Mistral, DeepSeek).", Icon: Sparkles },
  "lessons.jsonl":       { title: "Lesson pairs (why-format)", blurb: "Before/after records. Teaches the fix, not just the final response — this is what makes a trained model generalise past the training set.", Icon: FileText },
  "curriculum.md":       { title: "In-context curriculum",   blurb: "A single markdown block ready to paste into any closed model's system prompt as few-shot examples. The only format that works without training infrastructure.", Icon: FileText },
};

export default function DatasetLab() {
  const [files, setFiles] = useState<ExportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);

  const refresh = () =>
    api.exports.list()
      .then(setFiles)
      .catch((e) => toast.error(String(e)));

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, []);

  const build = async () => {
    setBuilding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/export/build`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const manifest = await res.json();
      toast.success(`Built ${manifest.trajectory_count} trajectories → ${Object.keys(manifest.files).length} files`);
      await refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <section className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dataset Lab</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              One canonical trajectory record per session. Five view-converted exports for every downstream a new
              model might come from — OpenAI, Anthropic, Hugging Face / Kaggle / local LoRA pipelines, plus a
              lessons-pairs format and a markdown curriculum block for in-context learning.
            </p>
          </div>
          <ShimmerButton
            onClick={build}
            className="px-4 py-2 text-sm font-mono gap-2"
            disabled={building}
          >
            <Hammer className="size-4" />
            {building ? "building…" : "Rebuild all"}
          </ShimmerButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && <p className="text-sm text-muted-foreground col-span-full">loading export list…</p>}
          {files.length === 0 && !loading && (
            <Card className="col-span-full border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No export files yet. Click <strong>Rebuild all</strong> to generate the dataset from
                the current <code className="font-mono">data/sessions/</code> trajectories.
              </CardContent>
            </Card>
          )}
          {files.map((f) => {
            const meta = DIALECT_META[f.name] ?? { title: f.name, blurb: "", Icon: FileText };
            const Icon = meta.Icon;
            return (
              <Card key={f.name} className="relative overflow-hidden">
                <BorderBeam duration={14} size={160} />
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <Icon className="size-4 text-emerald-300" />
                      {f.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {f.lines ?? "?"} rec
                    </Badge>
                  </div>
                  <CardDescription className="text-xs leading-relaxed">
                    {meta.blurb}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex items-center justify-between">
                  <code className="font-mono text-[10px] text-muted-foreground">
                    {(f.bytes / 1024).toFixed(1)} KB
                  </code>
                  <a
                    href={api.exports.url(f.name)}
                    download
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-xs font-mono"
                  >
                    <Download className="size-3.5" />
                    download
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
