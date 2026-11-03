"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { SessionSidebar } from "@/components/panels/SessionSidebar";
import { InspectorPanel } from "@/components/panels/InspectorPanel";
import { TimelineScrubber } from "@/components/scene/TimelineScrubber";

const PipelineCanvas = dynamic(
  () => import("@/components/scene/PipelineCanvas").then((m) => m.PipelineCanvas),
  { ssr: false }
);

export default function PipelineTheatre() {
  return (
    <div
      className="flex flex-row overflow-hidden"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <Suspense fallback={<div className="w-72 shrink-0 border-r border-border/60" />}>
        <SessionSidebar />
      </Suspense>
      <section className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="relative flex-1 overflow-hidden min-h-0">
          <PipelineCanvas />
        </div>
        <TimelineScrubber />
      </section>
      <InspectorPanel />
    </div>
  );
}
