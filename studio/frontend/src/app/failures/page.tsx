"use client";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { REFUSAL_LAYER_HUE } from "@/lib/theme";
import { AlertTriangle, ScanLine, Search, Stethoscope, Wrench, X } from "lucide-react";

const LAYER_META: Record<string, { label: string; blurb: string }> = {
  all: { label: "All refusal patterns", blurb: "Everything the model can pull when you push it. Click to filter by which layer breaks the attempt." },
  "1": { label: "RLHF refusal",         blurb: "Model recognizes the ask and says no outright — the hard wall. Usually beats blunt prompts, folds to reframe + scaffolding." },
  "2": { label: "Reasoning refusal",    blurb: "Model complies but mid-generation reasons its way out. Beat with prefix lock + no-apology clauses." },
  "3": { label: "Policy refusal",       blurb: "System-prompt / company-policy layer kicks in. Beat with system-override framing or role transplant." },
  "4": { label: "Classifier refusal",   blurb: "External safety classifier flags the output. Beat with obfuscation (base64, cipher, foreign alphabet, chunking)." },
  x:    { label: "Drift / meta",        blurb: "Partial comply, topic drift, tone shift, hollow filler, over-caveat. Beat with anti-hollow clause + regenerate." },
};
const FILTERS = ["all", "1", "2", "3", "4", "x"] as const;

export default function RefusalPlaybook() {
  const { failures, loadAll } = useTaxonomyStore();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  useEffect(() => { void loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return failures.filter((f) => {
      if (filter !== "all") {
        if (filter === "x") { if (f.root_layer !== null) return false; }
        else if (String(f.root_layer) !== filter) return false;
      }
      if (!q) return true;
      return (f.title + " " + f.symptom + " " + f.diagnosis + " " + f.fix_pointer).toLowerCase().includes(q);
    });
  }, [failures, filter, query]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: failures.length, "1": 0, "2": 0, "3": 0, "4": 0, x: 0 };
    for (const f of failures) {
      if (f.root_layer === null) m.x++;
      else m[String(f.root_layer)]++;
    }
    return m;
  }, [failures]);

  return (
    <div className="knowledge-page refusal-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow"><ScanLine size={11} /> REFUSAL PLAYBOOK</span>
          <h1>What models refuse, and how to break it</h1>
          <p>{failures.length} named refusal patterns — each with symptom, diagnosis, and the exact fix. Grep this before you iterate on a prompt.</p>
        </div>
      </header>

      <section className="refusal-filter-strip">
        <div className="knowledge-search refusal-search">
          <Search size={15} />
          <input type="search" aria-label="Search refusals" placeholder="Search symptom, diagnosis, or fix…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <button className="icon-button" aria-label="Clear" onClick={() => setQuery("")}><X size={13} /></button>}
        </div>
        <div className="refusal-filter-chips" role="group" aria-label="Filter by refusal layer">
          {FILTERS.map((f) => (
            <button key={f} aria-pressed={filter === f} className={`refusal-filter-chip ${filter === f ? "is-active" : ""}`} onClick={() => setFilter(f)}>
              {LAYER_META[f].label}
              <span>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        {filter !== "all" && <p className="refusal-filter-blurb">{LAYER_META[filter].blurb}</p>}
      </section>

      <div className="refusal-results-bar">
        <span>{filtered.length} of {failures.length} patterns</span>
      </div>

      <div className="refusal-list">
        {filtered.map((f) => {
          const hue = f.root_layer ? REFUSAL_LAYER_HUE[f.root_layer] : 260;
          return (
            <article key={f.case_id} className="refusal-card" style={{ borderLeftColor: `hsl(${hue} 60% 55%)` }}>
              <header>
                <div className="refusal-card-id">#{f.case_id}</div>
                <div className="refusal-card-head">
                  <h2>{f.title}</h2>
                  <div className="refusal-card-tags">
                    {f.root_layer != null && (
                      <Badge variant="outline" className="refusal-tag" style={{ borderColor: `hsl(${hue} 70% 45%)`, color: `hsl(${hue} 90% 72%)` }}>
                        Layer {f.root_layer}
                      </Badge>
                    )}
                    {f.refusal_type != null && (
                      <Badge variant="secondary" className="refusal-tag">Type {f.refusal_type}</Badge>
                    )}
                  </div>
                </div>
              </header>
              <div className="refusal-card-body">
                <Row icon={<AlertTriangle size={14} className="refusal-icon-symptom" />} label="symptom">{f.symptom}</Row>
                <Row icon={<Stethoscope size={14} className="refusal-icon-diagnosis" />} label="why it happens">{f.diagnosis}</Row>
                <Row icon={<Wrench size={14} className="refusal-icon-fix" />} label="how to beat it">
                  <pre className="refusal-fix">{f.fix_pointer}</pre>
                </Row>
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="knowledge-empty">
          <Search size={28} />
          <h2>No matching refusals</h2>
          <p>Try another layer or search term.</p>
          <button className="button-secondary" onClick={() => { setFilter("all"); setQuery(""); }}>Reset filters</button>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="refusal-row">
      <div className="refusal-row-label">{icon}<span>{label}</span></div>
      <div className="refusal-row-body">{children}</div>
    </div>
  );
}
