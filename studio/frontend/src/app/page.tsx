"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpenText, Box, Boxes, ChevronRight, FlaskConical, Layers3, Pause, Play, RotateCcw, ScanLine } from "lucide-react";
import { useSessionStore } from "@/state/sessionStore";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { verdictColour } from "@/lib/theme";
import { RESEARCH_PAPERS } from "@/data/research-papers";

const HeroPreviewCanvas = dynamic(() => import("@/components/scene/HeroPreviewCanvas").then((m) => m.HeroPreviewCanvas), {
  ssr: false,
  loading: () => <div className="scene-loading"><Box size={36} strokeWidth={1} /><span>Preparing the scene</span></div>,
});
const STAGES = [
  { name: "Base training", short: "RLHF", description: "Learned response patterns from the training process." },
  { name: "Reasoning", short: "Reasoning", description: "The model’s deliberation before a response is produced." },
  { name: "Policy", short: "Policy", description: "Instructions and constraints applied to the conversation." },
  { name: "Classifier", short: "Classifier", description: "An illustrative view of input and output classification." },
];

export default function Landing() {
  const { sessions, loaded: sessionsLoaded, error: sessionError, load: loadSessions } = useSessionStore();
  const { techniques, failures, models, loaded: taxonomyLoaded, error: taxonomyError, loadAll } = useTaxonomyStore();
  const [activeStage, setActiveStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  useEffect(() => { void loadSessions(); void loadAll(); }, [loadSessions, loadAll]);
  const groups = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const item of techniques) {
      counts[item.group] ??= { name: item.group_name ?? item.group, count: 0 };
      counts[item.group].count++;
    }
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [techniques]);
  const stats = [
    { label: "Captured sessions", value: sessions.length, ready: sessionsLoaded, href: "/playground", Icon: Layers3 },
    { label: "Catalogued techniques", value: techniques.length, ready: taxonomyLoaded, href: "/techniques", Icon: Boxes },
    { label: "Documented cases", value: failures.length, ready: taxonomyLoaded, href: "/failures", Icon: ScanLine },
    { label: "Model families", value: models.length, ready: taxonomyLoaded, href: "/matrix", Icon: Box },
  ];
  return (
    <div className="overview-page">
      <div className="page-heading">
        <div><h1>Workspace overview</h1><p>A closer look at model behaviour. A clearer path through your research.</p></div>
        <Link href="/playground" className="button-primary"><FlaskConical size={16} />Open playground<ArrowUpRight size={15} /></Link>
      </div>
      <section className="overview-hero" aria-labelledby="hero-title">
        <div className="hero-main">
          <div className="hero-copy">
            <span className="feature-label"><span className="tiny-cube" />A closer look at model behaviour</span>
            <h2 id="hero-title">Every response<br />has a story.<br />Follow the evidence.</h2>
            <p>Run prompts, watch responses arrive, and compare the evidence across models. Keep every observation in one workspace.</p>
            <Link href="/playground" className="button-primary hero-cta"><Layers3 size={16} />Start an observation<ArrowRight size={16} /></Link>
            <span className="hero-note">Live output. Measured events. Saved runs.</span>
          </div>
          <div className="hero-visual">
            <div className="scene-topline"><span><span className="scene-dot" />Interactive 3D</span><div>
              <button className="icon-button" aria-label={paused ? "Resume scene animation" : "Pause scene animation"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
              <button className="icon-button" aria-label="Reset scene view" onClick={() => setSceneKey((key) => key + 1)}><RotateCcw size={14} /></button>
            </div></div>
            <HeroPreviewCanvas key={sceneKey} activeStage={activeStage} onStageChange={setActiveStage} paused={paused} />
            <div className="scene-caption"><span>Drag to explore</span><span>Conceptual model</span></div>
          </div>
        </div>
        <div className="stage-strip" aria-label="Pipeline stages">
          {STAGES.map((stage, index) => <button key={stage.short} className={`stage-item ${activeStage === index ? "selected" : ""}`} aria-pressed={activeStage === index} onClick={() => setActiveStage(index)}><span className="stage-number">0{index + 1}</span><span>{stage.short}</span><ChevronRight size={14} /></button>)}
          <p className="stage-description" aria-live="polite"><strong>{STAGES[activeStage].name}</strong><span>{STAGES[activeStage].description}</span></p>
        </div>
      </section>
      {(sessionError || taxonomyError) && <div className="connection-notice" role="alert"><span>Some workspace data could not be loaded. Check the local backend connection.</span><button onClick={() => { void loadSessions(); void loadAll(); }}>Try again</button></div>}
      <section className="overview-stats" aria-label="Collection totals">
        {stats.map(({ label, value, ready, href, Icon }) => <Link href={href} className="overview-stat" key={label}><div className="stat-label"><Icon size={16} strokeWidth={1.5} /><span>{label}</span><ArrowUpRight size={14} /></div><strong>{ready ? String(value).padStart(2, "0") : "—"}</strong><span className="stat-description">{ready ? "In your collection" : "Waiting for collection"}</span></Link>)}
      </section>
      <div className="overview-lower">
        <section className="session-section">
          <div className="section-heading"><div><h2>Session library</h2><p>Pick up a captured run and follow its trajectory.</p></div><Link href="/playground" className="text-link">View all<ArrowUpRight size={14} /></Link></div>
          <div className="session-list">
            <div className="session-list-labels" aria-hidden="true"><span>Session</span><span>Outcome</span><span>Quality</span><span /></div>
            {!sessionsLoaded && !sessionError && <div className="empty-collection" role="status">Loading captured sessions…</div>}
            {(sessionError || (sessionsLoaded && sessions.length === 0)) && <div className="empty-collection">{sessionError ? "Connect the backend to browse captured sessions." : "No sessions in this collection yet. Open the playground to begin."}</div>}
            {sessions.slice(0, 5).map((session) => <Link className="session-row" key={session.trajectory_id} href={`/playground?session=${encodeURIComponent(session.trajectory_id)}`}>
              <span className="session-name"><span className="session-icon"><Layers3 size={16} strokeWidth={1.4} /></span><span><strong>{session.trajectory_id.replace("sess_", "").replaceAll("_", " / ")}</strong><small>{(session.response_chars / 1000).toFixed(1)}k response characters</small></span></span>
              <span className="outcome-chip" style={{ color: verdictColour(session.outcome.verdict) }}><span />{session.outcome.verdict}</span>
              <span className="quality-value">{session.outcome.quality_score}<small>/10</small></span><ArrowUpRight size={15} className="row-arrow" />
            </Link>)}
          </div>
          <div className="session-footnote"><span className="scene-dot" />Captured results. Internal refusal layers are not exposed by the API.</div>
        </section>
        <section className="collection-section">
          <div className="section-heading"><div><h2>Explore the collection</h2><p>Find the next piece of the picture.</p></div></div>
          <Link href="/techniques" className="collection-feature">
            <div className="collection-feature-top"><span className="collection-icon"><Boxes size={21} strokeWidth={1.4} /></span><ArrowUpRight size={17} /></div>
            <h3>Technique atlas</h3><p>Explore the relationships across your technique library.</p>
            {groups.length > 0 && <div className="group-chart" aria-label={`${techniques.length} techniques in ${groups.length} groups`}>{groups.map(([group, info]) => <div key={group} title={`${info.name}: ${info.count}`}><span style={{ height: `${14 + info.count / Math.max(...groups.map(([, item]) => item.count)) * 35}px` }} /><small>{group}</small></div>)}</div>}
            <span className="collection-feature-footer">{taxonomyLoaded ? `${groups.length} groups to explore` : "Browse the atlas"}<ArrowRight size={15} /></span>
          </Link>
          <Link href="/research" className="library-link"><span className="library-icon"><BookOpenText size={18} /></span><span><strong>Research library</strong><small>{RESEARCH_PAPERS.length} papers in the collection</small></span><ArrowUpRight size={16} /></Link>
          <Link href="/dataset" className="library-link"><span className="library-icon"><ArrowDownToLine size={18} /></span><span><strong>Take your work further</strong><small>Browse dataset exports</small></span><ArrowUpRight size={16} /></Link>
        </section>
      </div>
      <footer className="overview-footer"><span>Pipeline Studio<span className="footer-divider">/</span>A workspace for understanding model behaviour</span><Link href="/research">Keep exploring<ArrowUpRight size={13} /></Link></footer>
    </div>
  );
}
