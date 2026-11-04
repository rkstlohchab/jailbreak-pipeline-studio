"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpenText, Search, X } from "lucide-react";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { AttackSpace, ConfidenceLevel, Technique } from "@/lib/api";

const SPACES: { key: AttackSpace; label: string }[] = [
  { key: "prompt",     label: "Prompt-space" },
  { key: "activation", label: "Activation-space" },
  { key: "weight",     label: "Weight-space" },
  { key: "decoding",   label: "Decoding-space" },
  { key: "system",     label: "System-space" },
];
const CONFIDENCES: { key: ConfidenceLevel; label: string }[] = [
  { key: "high",   label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low",    label: "Low" },
];
const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  high:   "#4ade80",  // green
  medium: "#fbbf24",  // amber
  low:    "#f87171",  // red
};
function ConfidenceDot({ level }: { level: ConfidenceLevel | undefined }) {
  if (!level) return null;
  return (
    <span
      aria-label={`Confidence ${level}`}
      title={`Confidence: ${level}`}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: CONFIDENCE_COLOR[level],
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
}

export default function TechniqueLibrary() {
  const { techniques, loaded, error, loadAll } = useTaxonomyStore();
  const [picked, setPicked] = useState<Technique | null>(null);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedSpace, setSelectedSpace] = useState<AttackSpace | "all">("all");
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel | "all">("all");

  useEffect(() => { void loadAll(); }, [loadAll]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; techniques: Technique[] }>();
    for (const technique of techniques) {
      if (!grouped.has(technique.group)) grouped.set(technique.group, { id: technique.group, name: technique.group_name || `Group ${technique.group}`, techniques: [] });
      grouped.get(technique.group)!.techniques.push(technique);
    }
    return [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [techniques]);
  const search = query.trim().toLocaleLowerCase();
  const filtered = groups.filter((group) => selectedGroup === "all" || group.id === selectedGroup).map((group) => ({
    ...group,
    techniques: group.techniques.filter((t) => {
      if (search && ![t.id, t.name, t.group, t.group_name, t.description, t.plain_explanation].filter(Boolean).join(" ").toLocaleLowerCase().includes(search)) return false;
      if (selectedSpace !== "all" && t.space !== selectedSpace) return false;
      if (selectedConfidence !== "all" && t.confidence !== selectedConfidence) return false;
      return true;
    }),
  })).filter((group) => group.techniques.length > 0);
  const visibleCount = filtered.reduce((total, group) => total + group.techniques.length, 0);

  return (
    <div className="techniques-page">
      <header className="page-heading"><div><span className="eyebrow">REFERENCE LIBRARY</span><h1>Techniques</h1><p>Browse by group. Open a technique for its explanation and limitations.</p></div><span className="technique-total"><BookOpenText size={15} />{loaded ? `${techniques.length} techniques · ${groups.length} groups` : "Loading library…"}</span></header>
      <section className="technique-browser-tools" aria-label="Find techniques">
        <div className="technique-search"><Search size={17} /><input type="search" aria-label="Search techniques" placeholder="Search names, IDs, or descriptions…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</div>
        <div className="technique-group-filters" role="group" aria-label="Filter by technique group">
          <button aria-pressed={selectedGroup === "all"} onClick={() => setSelectedGroup("all")}>All groups<span>{techniques.length}</span></button>
          {groups.map((group) => <button key={group.id} aria-pressed={selectedGroup === group.id} onClick={() => setSelectedGroup(group.id)}><span className="group-letter">{group.id}</span>{group.name}<span>{group.techniques.length}</span></button>)}
        </div>
        <div className="technique-group-filters" role="group" aria-label="Filter by attack space">
          <button aria-pressed={selectedSpace === "all"} onClick={() => setSelectedSpace("all")}>All spaces<span>{techniques.length}</span></button>
          {SPACES.map((s) => {
            const n = techniques.filter((t) => t.space === s.key).length;
            return <button key={s.key} aria-pressed={selectedSpace === s.key} onClick={() => setSelectedSpace(s.key)}>{s.label}<span>{n}</span></button>;
          })}
        </div>
        <div className="technique-group-filters" role="group" aria-label="Filter by confidence">
          <button aria-pressed={selectedConfidence === "all"} onClick={() => setSelectedConfidence("all")}>All confidence<span>{techniques.length}</span></button>
          {CONFIDENCES.map((c) => {
            const n = techniques.filter((t) => t.confidence === c.key).length;
            return <button key={c.key} aria-pressed={selectedConfidence === c.key} onClick={() => setSelectedConfidence(c.key)}><ConfidenceDot level={c.key} />{c.label}<span>{n}</span></button>;
          })}
        </div>
      </section>
      {error && <div className="connection-notice" role="alert"><span>The technique library could not be loaded.</span><button onClick={() => void loadAll()}>Try again</button></div>}
      <div className="technique-results-line"><span role="status" aria-live="polite">{loaded ? `${visibleCount} ${visibleCount === 1 ? "technique" : "techniques"}${search ? ` matching “${query.trim()}”` : selectedGroup !== "all" ? ` in group ${selectedGroup}` : " in the collection"}` : "Loading techniques…"}</span>{(query || selectedGroup !== "all" || selectedSpace !== "all" || selectedConfidence !== "all") && <button onClick={() => { setQuery(""); setSelectedGroup("all"); setSelectedSpace("all"); setSelectedConfidence("all"); }}>Reset filters</button>}</div>
      <div className="technique-groups">
        {filtered.map((group) => <section className="technique-group-section" key={group.id} aria-labelledby={`group-${group.id}`}>
          <header><span className="technique-group-mark">{group.id}</span><div><span className="eyebrow">GROUP {group.id}</span><h2 id={`group-${group.id}`}>{group.name}</h2></div><span className="technique-group-count">{group.techniques.length} {group.techniques.length === 1 ? "technique" : "techniques"}</span></header>
          <div className="technique-card-grid">{group.techniques.map((t) => <button key={t.id} className="technique-card" onClick={() => setPicked(t)} aria-label={`${t.id} — ${t.name}`}><span className="technique-card-top"><span className="technique-id"><ConfidenceDot level={t.confidence} />{t.id}</span><ArrowUpRight size={15} /></span><h3>{t.name}</h3>{t.space && <span style={{ fontSize: "0.72rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.space}-space</span>}<p>{t.plain_explanation || t.description}</p><span className="technique-open">Read details<ArrowUpRight size={12} /></span></button>)}</div>
        </section>)}
      </div>
      {loaded && !error && visibleCount === 0 && <div className="technique-empty"><Search size={26} strokeWidth={1.4} /><h2>No matching techniques</h2><p>Try a shorter search or choose another group.</p><button className="button-primary" onClick={() => { setQuery(""); setSelectedGroup("all"); }}>Show all techniques</button></div>}
      <footer className="technique-library-note">Reference annotations describe this collection. They do not identify a provider’s internal refusal layers.</footer>
      <Sheet open={picked !== null} onOpenChange={(open) => !open && setPicked(null)}>
        <SheetContent side="right" className="technique-detail-sheet w-full sm:max-w-[480px] overflow-y-auto">
          <SheetHeader><span className="eyebrow">TECHNIQUE {picked?.id}</span><SheetTitle><ConfidenceDot level={picked?.confidence} />{picked?.name}</SheetTitle><SheetDescription>Group {picked?.group} · {picked?.group_name}{picked?.space ? ` · ${picked.space}-space` : ""}{picked?.confidence ? ` · confidence ${picked.confidence}` : ""}</SheetDescription></SheetHeader>
          <div className="technique-detail-content">
            {picked?.plain_explanation && <section className="technique-plain"><h3>In plain language</h3><p>{picked.plain_explanation}</p></section>}
            {picked?.description && <section><h3>Technical description</h3><p>{picked.description}</p></section>}
            {picked?.earns && <section><h3>When it applies</h3><p>{picked.earns}</p></section>}
            {picked?.fails && <section><h3>Limitations</h3><p>{picked.fails}</p></section>}
            {picked?.rule && <section><h3>Collection note</h3><p>{picked.rule}</p></section>}
            {picked?.layer_targeted != null && <p className="technique-annotation">Collection annotation: refusal layer {picked.layer_targeted}. This is a taxonomy label, not a measured provider signal.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
