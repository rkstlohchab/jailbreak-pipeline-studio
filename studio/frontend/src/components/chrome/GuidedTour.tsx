"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const shortcut = (e: KeyboardEvent) => {
      if (e.key === "?" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLElement && e.target.isContentEditable)) { e.preventDefault(); show(); }
    };
    window.addEventListener("tour:open", show);
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("tour:open", show); window.removeEventListener("keydown", shortcut); };
  }, []);
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Your research workspace</DialogTitle><DialogDescription>Run, observe, and compare model responses.</DialogDescription></DialogHeader><div className="space-y-5 py-3 text-sm leading-relaxed text-muted-foreground">
    <p><strong className="text-foreground">Playground</strong> sends your system and user messages to a provider. Response text arrives live, alongside real request events, stop reasons, reported usage, and errors.</p>
    <p><strong className="text-foreground">Diagnostics</strong> distinguish provider-reported information from text heuristics. These APIs do not expose which internal refusal layer caused a response. A refusal phrase or an empty response cannot prove that a particular layer fired.</p>
    <p><strong className="text-foreground">Run history</strong> keeps the last 20 runs in this browser. Select a run to edit its messages, compare responses, or download its JSON. API keys stay in the current tab and are excluded from saved runs.</p>
    <p><strong className="text-foreground">The collection</strong> contains captured sessions, techniques, failure cases, research papers, and dataset exports. Historical annotations and the 3D overview are reference material, not live provider telemetry.</p>
    <p>Use <kbd className="rounded border px-1.5">⌘ K</kbd> to jump to a view or captured session. Press <kbd className="rounded border px-1.5">?</kbd> to reopen this guide.</p>
  </div><Link href="/playground" onClick={() => setOpen(false)}><Button className="w-full">Open Playground</Button></Link></DialogContent></Dialog>;
}
