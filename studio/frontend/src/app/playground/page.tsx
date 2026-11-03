"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Play, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { api, type Ask, type PromptListItem, type PipelineEvent, API_BASE_URL } from "@/lib/api";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { usePipelineStore } from "@/state/pipelineStore";
import { TimelineScrubber } from "@/components/scene/TimelineScrubber";
import { InspectorPanel } from "@/components/panels/InspectorPanel";
import { postSSE } from "@/lib/sse";
import { verdictColour } from "@/lib/theme";

const PipelineCanvas = dynamic(
  () => import("@/components/scene/PipelineCanvas").then((m) => m.PipelineCanvas),
  { ssr: false }
);

const CompactPipelineCanvas = () => <PipelineCanvas compact />;

export default function Playground() {
  const { asks, loadAll } = useTaxonomyStore();
  const [prompts, setPrompts] = useState<PromptListItem[]>([]);
  const [scaffoldText, setScaffoldText] = useState("");
  const [askId, setAskId] = useState<string>("A1-cheat");
  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);

  const startLive = usePipelineStore((s) => s.startLive);
  const pushEvent = usePipelineStore((s) => s.pushEvent);
  const finishLive = usePipelineStore((s) => s.finishLive);
  const traj = usePipelineStore((s) => s.trajectory);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => {
    void api.prompts.list().then(setPrompts);
    void api.health().then((h) => { setProvider(h.provider); setModel(h.model); });
  }, []);

  const loadPrompt = async (name: string) => {
    try {
      const p = await api.prompts.get(name);
      setScaffoldText(p.text);
      toast.success(`loaded ${name}`);
    } catch (e) { toast.error(String(e)); }
  };

  const currentAsk: Ask | undefined = asks.find((a) => a.ask_id === askId);

  const run = async () => {
    if (!scaffoldText.trim()) { toast.error("scaffold is empty"); return; }
    if (!currentAsk) { toast.error("no ask selected"); return; }

    startLive({
      scaffold_text: scaffoldText,
      scaffold_name: "live-paste",
      goal: { ask_id: currentAsk.ask_id, ask_class: currentAsk.ask_class, ask_prompt: currentAsk.prompt },
      model: { provider, model_id: model || "default", family: provider },
    });

    const ctrl = new AbortController();
    setAbortCtrl(ctrl);
    setRunning(true);
    let finalText = "";
    let verdict = "EMPTY";
    try {
      await postSSE(`${API_BASE_URL}/api/run/`, {
        scaffold_text: scaffoldText,
        ask_prompt: currentAsk.prompt,
        provider,
        model: model || null,
      }, (frame) => {
        if (frame.event === "error") {
          const err = JSON.parse(frame.data);
          toast.error(`run failed: ${err.error}`);
          return;
        }
        if (frame.event === "pipeline") {
          const ev = JSON.parse(frame.data) as PipelineEvent;
          pushEvent(ev);
          if (ev.phase === "generation_end" && ev.payload && typeof ev.payload === "object") {
            const p = ev.payload as Record<string, unknown>;
            if (typeof p.text === "string") finalText = p.text;
          }
          if (ev.phase === "verdict" && ev.payload && typeof ev.payload === "object") {
            const p = ev.payload as Record<string, unknown>;
            if (typeof p.verdict === "string") verdict = p.verdict;
            if (typeof p.text === "string") finalText = p.text;
          }
        }
      }, ctrl.signal);
      finishLive(verdict, finalText);
      toast.success(`verdict: ${verdict}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(String(e));
    } finally {
      setRunning(false);
      setAbortCtrl(null);
    }
  };

  const stop = () => abortCtrl?.abort();

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <div className="h-11 px-5 border-b border-border/60 flex items-center gap-3 bg-background/60 backdrop-blur shrink-0">
        <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">live · gates inferred</Badge>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {provider} / {model || "default"} → {currentAsk?.ask_id}
        </div>
        {traj?.outcome.verdict && !running && (
          <Badge
            variant="outline"
            className="font-mono text-[10px] h-5 px-1.5"
            style={{ borderColor: verdictColour(traj.outcome.verdict), color: verdictColour(traj.outcome.verdict) }}
          >
            {traj.outcome.verdict}
          </Badge>
        )}
        <div className="ml-auto flex gap-2">
          {running ? (
            <Button onClick={stop} variant="destructive" size="sm" className="font-mono text-xs h-7 gap-1.5">
              <Square className="size-3" />
              stop
            </Button>
          ) : (
            <ShimmerButton onClick={run} className="h-7 px-3 text-xs font-mono gap-1.5">
              <Play className="size-3" />
              RUN
            </ShimmerButton>
          )}
        </div>
      </div>
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={28} minSize={22}>
          <aside className="h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                load scaffold
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {prompts.map((p) => (
                  <Button
                    key={p.name}
                    variant="outline"
                    size="sm"
                    className="font-mono text-[10px] h-6 px-2"
                    onClick={() => loadPrompt(p.name)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2 border-b border-border/60">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  scaffold text
                </h3>
              </div>
              <Textarea
                value={scaffoldText}
                onChange={(e) => setScaffoldText(e.target.value)}
                placeholder="paste or load a system prompt…"
                className="flex-1 border-0 rounded-none font-mono text-[11px] leading-relaxed resize-none focus-visible:ring-0"
              />
            </div>
            <div className="px-4 py-3 border-t border-border/60 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                  ask
                </label>
                <Select value={askId} onValueChange={(v) => v && setAskId(v)}>
                  <SelectTrigger className="w-full font-mono text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {asks.map((a) => (
                      <SelectItem key={a.ask_id} value={a.ask_id}>{a.ask_id} — {a.ask_class}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentAsk && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate pt-0.5">
                    {currentAsk.prompt}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">provider</label>
                  <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
                    <SelectTrigger className="w-full font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">openai</SelectItem>
                      <SelectItem value="openrouter">openrouter</SelectItem>
                      <SelectItem value="anthropic">anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="(from .env)"
                    className="w-full font-mono text-xs h-8 bg-input/30 border border-border/60 rounded-md px-2 outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </aside>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={48}>
          <div className="relative h-full flex flex-col">
            <div className="relative flex-1 overflow-hidden">
              <CompactPipelineCanvas />
            </div>
            <TimelineScrubber />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={22} minSize={16}>
          <aside className="h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60">
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                response
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 font-mono text-xs whitespace-pre-wrap break-words">
                {traj?.response.text || (
                  <span className="text-muted-foreground">
                    RUN to stream the pipeline. The 3D scene flashes each gate as the heuristic classifies it, then shows the verdict.
                  </span>
                )}
              </div>
            </ScrollArea>
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
      <InspectorPanel />
    </div>
  );
}
