"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Check,
  Circle,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Layers,
  Map,
  Search,
  Server,
  Sparkles,
  Target,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SKILL_TREE, ALL_NODES, ALL_NODE_IDS, NODE_INDEX, type SkillNode, type SkillBranch } from "@/data/skill-tree";
import { LESSONS, EXERCISES, type Lesson } from "@/data/learning";
import { RESEARCH_PAPERS, CATEGORY_META, ACCESS_META, type PaperCategory } from "@/data/research-papers";
import { TOOLS, TOOL_KIND_META, type ToolKind } from "@/data/tools";
import { authorLabel } from "@/lib/knowledge";
import { useSavedIds } from "@/hooks/use-saved-ids";

const SPINE: string[] = ["foundations", "prompt-side", "automated", "frameworks", "weight-level", "methodology"];
const SIDE_BRANCHES: Record<string, string[]> = {
  "prompt-side": ["agent-rag", "multimodal"],
  methodology: ["disclosure"],
};
const DIFFICULTY_CLASS: Record<SkillNode["difficulty"], string> = { easy: "skill-diff-easy", med: "skill-diff-med", hard: "skill-diff-hard" };
const STATUS_CLASS: Record<SkillNode["status"], string> = { known: "skill-status-known", current: "skill-status-current", next: "skill-status-next", ambient: "skill-status-ambient" };
const BRANCH_BY_ID: Record<string, SkillBranch> = Object.fromEntries(SKILL_TREE.branches.map((b) => [b.id, b]));

type Tab = "roadmap" | "lessons" | "research" | "resources";
const TABS: { id: Tab; label: string; Icon: typeof Map; blurb: string }[] = [
  { id: "roadmap",   label: "Roadmap",   Icon: Map,           blurb: "Walk the spine, click a node to open its drills." },
  { id: "lessons",   label: "Lessons",   Icon: GraduationCap, blurb: "Short reads that explain what each paper means for a jailbreak." },
  { id: "research",  label: "Research",  Icon: BookOpenText,  blurb: "Primary sources. Open one to see finding, study note, limits." },
  { id: "resources", label: "Resources", Icon: Wrench,        blurb: "Red-team frameworks, scanners, benchmarks, datasets." },
];

export default function RoadmapPage() {
  return <Suspense fallback={<div className="scene-loading">Opening learning hub…</div>}><Hub /></Suspense>;
}

function Hub() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "roadmap";
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    p.delete("node"); p.delete("lesson"); p.delete("paper"); p.delete("tool");
    router.replace(`/roadmap?${p.toString()}`, { scroll: false });
  };
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="knowledge-page roadmap-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow"><Map size={11} /> LEARN</span>
          <h1>Learning hub</h1>
          <p>{activeTab.blurb}</p>
        </div>
      </header>

      <nav className="hub-tabs" role="tablist" aria-label="Learning sections">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`hub-tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={14} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {tab === "roadmap" && <RoadmapTab />}
      {tab === "lessons" && <LessonsTab />}
      {tab === "research" && <ResearchTab />}
      {tab === "resources" && <ResourcesTab />}
    </div>
  );
}

function RoadmapTab() {
  const params = useSearchParams();
  const router = useRouter();
  const nodeId = params.get("node");
  const [query, setQuery] = useState("");
  const done = useSavedIds("studio-skill-tree-done-v1", ALL_NODE_IDS);

  const highlighted = useMemo(() => {
    const trimmed = query.trim().toLocaleLowerCase();
    if (!trimmed) return null;
    return new Set(ALL_NODES.filter((n) => [n.title, n.summary, n.id, ...n.learn.map((l) => l.label)].join(" ").toLocaleLowerCase().includes(trimmed)).map((n) => n.id));
  }, [query]);

  const openNode = (id?: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("node", id); else next.delete("node");
    router.replace(`/roadmap?${next.toString()}`, { scroll: false });
  };
  const picked = nodeId ? NODE_INDEX[nodeId]?.node ?? null : null;
  const pickedBranch = nodeId ? NODE_INDEX[nodeId]?.branch ?? null : null;
  const totalDone = done.ids.length;
  const percent = Math.round((totalDone / ALL_NODES.length) * 100);

  return <>
    <div className="roadmap-progress-card is-inline" aria-live="polite">
      <strong>{totalDone}<span>/{ALL_NODES.length}</span></strong>
      <small>{percent}% complete</small>
      <progress value={totalDone} max={ALL_NODES.length} aria-label="Overall progress" />
    </div>

    <div className="roadmap-toolbar">
      <div className="knowledge-search roadmap-search">
        <Search size={15} />
        <input type="search" aria-label="Search nodes" placeholder="Search a topic, paper, or technique…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="icon-button" aria-label="Clear" onClick={() => setQuery("")}><X size={13} /></button>}
      </div>
      <div className="roadmap-legend">
        <span className="legend-chip"><span className="legend-dot legend-done" />Done</span>
        <span className="legend-chip"><span className="legend-dot legend-open" />Open</span>
        <span className="legend-chip"><span className="legend-dot legend-match" />Search match</span>
      </div>
    </div>

    <section className="roadmap-flowchart" aria-label="Learning flowchart">
      {SPINE.map((branchId, index) => {
        const branch = BRANCH_BY_ID[branchId];
        if (!branch) return null;
        const sides = (SIDE_BRANCHES[branchId] ?? []).map((id) => BRANCH_BY_ID[id]).filter(Boolean);
        const isLast = index === SPINE.length - 1;
        return (
          <div className="roadmap-row" key={branchId}>
            <div className="roadmap-row-spine">
              <PhaseCard branch={branch} index={index + 1} isSpine highlighted={highlighted} doneIds={done.ids} onPick={openNode} />
              {!isLast && <div className="roadmap-spine-line" aria-hidden="true" />}
            </div>
            {sides.length > 0 && (
              <div className="roadmap-row-sides" aria-label={`Side branches off ${branch.title}`}>
                {sides.map((side) => (
                  <div className="roadmap-side-wrap" key={side.id}>
                    <div className="roadmap-side-connector" aria-hidden="true" />
                    <PhaseCard branch={side} isSpine={false} highlighted={highlighted} doneIds={done.ids} onPick={openNode} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>

    <FreeComputeStrip />

    <Sheet open={!!picked} onOpenChange={(open) => { if (!open) openNode(undefined); }}>
      <SheetContent side="right" className="skill-sheet">
        {picked && pickedBranch && <NodeDetail node={picked} branch={pickedBranch} isDone={done.ids.includes(picked.id)} ready={done.ready} onToggle={() => done.toggle(picked.id)} />}
      </SheetContent>
    </Sheet>
  </>;
}

function PhaseCard({ branch, index, isSpine, highlighted, doneIds, onPick }: {
  branch: SkillBranch; index?: number; isSpine: boolean; highlighted: Set<string> | null; doneIds: string[]; onPick: (id: string) => void;
}) {
  const doneSet = new Set(doneIds);
  const doneCount = branch.nodes.filter((n) => doneSet.has(n.id)).length;
  return (
    <section className={`roadmap-phase ${isSpine ? "is-spine" : "is-side"} skill-branch-color-${branch.color}`} aria-labelledby={`phase-${branch.id}`}>
      <header>
        <div className="roadmap-phase-badge">{isSpine ? <strong>{String(index).padStart(2, "0")}</strong> : <Sparkles size={13} />}</div>
        <div><h3 id={`phase-${branch.id}`}>{branch.title}</h3><p>{branch.note}</p></div>
        <span className="roadmap-phase-progress"><Check size={11} />{doneCount}/{branch.nodes.length}</span>
      </header>
      <ol className="roadmap-node-list">
        {branch.nodes.map((node) => {
          const dim = highlighted !== null && !highlighted.has(node.id);
          const match = highlighted !== null && highlighted.has(node.id);
          const done = doneSet.has(node.id);
          return (
            <li key={node.id} className={`roadmap-node ${STATUS_CLASS[node.status]} ${dim ? "roadmap-node-dim" : ""} ${match ? "roadmap-node-match" : ""} ${done ? "roadmap-node-done" : ""}`}>
              <button className="roadmap-node-body" onClick={() => onPick(node.id)} aria-label={`Open ${node.title}`}>
                <span className="roadmap-node-dot" aria-hidden="true">{done ? <Check size={10} /> : null}</span>
                <span className="roadmap-node-title">{node.title}</span>
                <span className={`roadmap-node-diff ${DIFFICULTY_CLASS[node.difficulty]}`}>{node.difficulty}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NodeDetail({ node, branch, isDone, ready, onToggle }: { node: SkillNode; branch: SkillBranch; isDone: boolean; ready: boolean; onToggle: () => void }) {
  return <>
    <SheetHeader>
      <SheetTitle>{node.title}</SheetTitle>
      <SheetDescription>
        <span className={`skill-branch-chip skill-branch-color-${branch.color}`}>{branch.title}</span>
        <span className={`skill-legend-diff ${DIFFICULTY_CLASS[node.difficulty]}`}>{node.difficulty}</span>
        <span className={`skill-sheet-status ${STATUS_CLASS[node.status]}`}>{node.status}</span>
      </SheetDescription>
    </SheetHeader>
    <div className="skill-sheet-body">
      <p className="skill-sheet-summary">{node.summary}</p>
      {node.learn.length > 0 && <section>
        <h4><BookOpenText size={12} /> Resources</h4>
        <ul className="skill-sheet-links">
          {node.learn.map((link) => <li key={link.url}>
            {link.url.startsWith("/") ? <Link href={link.url}><span>{link.label}</span><ArrowUpRight size={11} /></Link>
              : <a href={link.url} target="_blank" rel="noreferrer"><span>{link.label}</span><ExternalLink size={11} /></a>}
          </li>)}
        </ul>
      </section>}
      {node.practice && <section><h4><FlaskConical size={12} /> Practice</h4><p className="skill-sheet-practice">{node.practice}</p></section>}
      {node.prompt && <section><h4><Sparkles size={12} /> Drill prompt</h4><PromptBlock text={node.prompt} /></section>}
      {node.app_link && <section><h4><Target size={12} /> Jump in</h4><Link className="button-secondary skill-sheet-applink" href={node.app_link}><Sparkles size={12} /> Open {node.app_link}<ArrowUpRight size={12} /></Link></section>}
      <section><h4><Layers size={12} /> Progress</h4><button className="button-primary" disabled={!ready} onClick={onToggle}><Check size={13} /> {isDone ? "Done · click to unmark" : "Mark done"}</button></section>
    </div>
  </>;
}

function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast.success("Prompt copied"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Clipboard unavailable"); }
  };
  return <div className="skill-sheet-prompt"><pre>{text}</pre><button className="button-secondary" onClick={copy}>{copied ? <Check size={11} /> : <Sparkles size={11} />} {copied ? "Copied" : "Copy"}</button></div>;
}

function FreeComputeStrip() {
  return <section className="skill-compute" aria-label="Free compute">
    <header><Server size={13} /><h3>No-GPU practice lane</h3></header>
    <ul>{SKILL_TREE.free_compute.map((tier) => <li key={tier.provider}>
      <a href={tier.url} target="_blank" rel="noreferrer">
        <strong><Cpu size={10} /> {tier.provider}</strong><span>{tier.gpu}</span><small>{tier.best_for}</small><ExternalLink size={10} />
      </a>
    </li>)}</ul>
  </section>;
}

function LessonsTab() {
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = params.get("lesson");
  const selected = LESSONS.find((l) => l.id === selectedId) ?? null;
  const completed = useSavedIds("studio-completed-lessons-v1", LESSONS.map((l) => l.id));
  const pick = (id?: string) => {
    const p = new URLSearchParams(params);
    if (id) p.set("lesson", id); else p.delete("lesson");
    router.replace(`/roadmap?${p.toString()}`, { scroll: false });
  };
  return <>
    <div className="hub-progress-row">
      <span><strong>{completed.ids.length}</strong>/{LESSONS.length} lessons done</span>
      <progress value={completed.ids.length} max={LESSONS.length} />
    </div>
    <div className="hub-grid hub-grid-lessons">
      {LESSONS.map((lesson, i) => {
        const done = completed.ids.includes(lesson.id);
        return (
          <button key={lesson.id} className={`hub-card lesson-card ${done ? "is-done" : ""}`} onClick={() => pick(lesson.id)}>
            <div className="hub-card-head">
              <span className="hub-card-step">{done ? <Check size={13} /> : String(i + 1).padStart(2, "0")}</span>
              <span className="hub-card-meta">{lesson.minutes} min</span>
            </div>
            <h3>{lesson.title}</h3>
            <p>{lesson.subtitle}</p>
            <span className="hub-card-link">Open lesson <ArrowRight size={11} /></span>
          </button>
        );
      })}
    </div>
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) pick(undefined); }}>
      <SheetContent side="right" className="research-sheet">
        {selected && <LessonDetail lesson={selected} completed={completed.ids.includes(selected.id)} ready={completed.ready} onToggle={() => completed.toggle(selected.id)} />}
      </SheetContent>
    </Sheet>
  </>;
}

function LessonDetail({ lesson, completed, ready, onToggle }: { lesson: Lesson; completed: boolean; ready: boolean; onToggle: () => void }) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const exercise = EXERCISES.find((item) => item.id === lesson.exerciseId);
  const correct = answer === lesson.quiz.answer;
  return <>
    <SheetHeader>
      <SheetTitle>{lesson.title}</SheetTitle>
      <SheetDescription>{lesson.subtitle} · {lesson.minutes} min</SheetDescription>
    </SheetHeader>
    <div className="research-detail lesson-detail">
      <p className="skill-sheet-summary">{lesson.objective}</p>
      {lesson.sections.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}
      <section><h3>Apply it</h3><ul className="lesson-checklist-inline">{lesson.checklist.map((c) => <li key={c}><Check size={13} />{c}</li>)}</ul></section>
      {exercise && <section className="lesson-exercise"><FlaskConical size={18} /><div><strong>{exercise.title}</strong><p>{exercise.description}</p><Link className="button-primary" href="/attack">Open attack page<ArrowRight size={14} /></Link></div></section>}
      <section className="lesson-quiz"><h3>Check</h3><fieldset><legend>{lesson.quiz.question}</legend>
        {lesson.quiz.options.map((option, index) => <label key={option} data-selected={answer === index}>
          <input type="radio" name={`quiz-${lesson.id}`} value={index} checked={answer === index} onChange={() => { setAnswer(index); setChecked(false); }} />
          <span>{option}</span>
        </label>)}
      </fieldset>
        <button className="button-secondary" disabled={answer === null} onClick={() => setChecked(true)}>Check answer</button>
        {checked && <div className="quiz-feedback" data-correct={correct} role="status"><strong>{correct ? "Correct" : "Try another answer"}</strong><p>{lesson.quiz.explanation}</p></div>}
      </section>
      <section><h3>Primary sources</h3>
        {lesson.paperIds.map((id) => {
          const paper = RESEARCH_PAPERS.find((item) => item.id === id);
          return paper ? <div key={id} className="paper-lesson-links"><Link href={`/roadmap?tab=research&paper=${id}`}>{paper.title}<ArrowRight size={13} /></Link></div> : null;
        })}
      </section>
      <button className="button-primary" disabled={!ready || (!completed && !(checked && correct))} onClick={onToggle}>
        {completed ? <Check size={14} /> : <Circle size={14} />}{completed ? "Done · unmark" : "Mark complete"}
      </button>
    </div>
  </>;
}

function ResearchTab() {
  const params = useSearchParams();
  const router = useRouter();
  const pickedId = params.get("paper");
  const picked = RESEARCH_PAPERS.find((p) => p.id === pickedId) ?? null;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PaperCategory | "all">("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESEARCH_PAPERS.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (p.title + " " + authorLabel(p.authors) + " " + p.summary + " " + p.id).toLowerCase().includes(q);
    }).sort((a, b) => b.year - a.year);
  }, [query, category]);
  const pick = (id?: string) => {
    const p = new URLSearchParams(params);
    if (id) p.set("paper", id); else p.delete("paper");
    router.replace(`/roadmap?${p.toString()}`, { scroll: false });
  };
  return <>
    <div className="hub-filters">
      <div className="knowledge-search">
        <Search size={15} />
        <input type="search" aria-label="Search papers" placeholder="Search title, author, topic…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="hub-chips">
        <button aria-pressed={category === "all"} className={`hub-chip ${category === "all" ? "is-active" : ""}`} onClick={() => setCategory("all")}>All ({RESEARCH_PAPERS.length})</button>
        {Object.entries(CATEGORY_META).map(([id, meta]) => <button key={id} aria-pressed={category === id} className={`hub-chip ${category === id ? "is-active" : ""}`} onClick={() => setCategory(id as PaperCategory)}>{meta.label} ({RESEARCH_PAPERS.filter((p) => p.category === id).length})</button>)}
      </div>
    </div>
    <div className="hub-grid hub-grid-research">
      {filtered.map((paper) => (
        <button key={paper.id} className="hub-card research-card" onClick={() => pick(paper.id)}>
          <div className="hub-card-head"><span className="hub-card-meta">{paper.year}</span><span className="hub-card-meta">{CATEGORY_META[paper.category].label}</span></div>
          <h3>{paper.title}</h3>
          <p className="hub-card-authors">{authorLabel(paper.authors)}</p>
          <p>{paper.summary}</p>
          <span className="hub-card-link">Open <ArrowRight size={11} /></span>
        </button>
      ))}
    </div>
    <Sheet open={!!picked} onOpenChange={(open) => { if (!open) pick(undefined); }}>
      <SheetContent side="right" className="research-sheet">
        {picked && <>
          <SheetHeader><SheetTitle>{picked.title}</SheetTitle><SheetDescription>{CATEGORY_META[picked.category].label} · First published {picked.published}</SheetDescription></SheetHeader>
          <div className="research-detail">
            <div className="research-detail-actions"><a className="button-primary" href={picked.pdfUrl} target="_blank" rel="noreferrer">Read full paper<ArrowUpRight size={14} /></a></div>
            <section><h3>Reported finding</h3><p>{picked.summary}</p></section>
            <section className="research-study-note"><h3>Study note <span>Editorial</span></h3><p>{picked.takeaway}</p></section>
            <section><h3>Limits</h3><p>{picked.limitations}</p><span className="knowledge-tag">{ACCESS_META[picked.access]}</span></section>
            <section className="research-provenance"><h3>Source</h3><dl><dt>Reviewed material</dt><dd>{picked.reviewBasis}</dd><dt>Source</dt><dd><a href={picked.url} target="_blank" rel="noreferrer">{picked.source}{picked.arxivId ? ` · ${picked.arxivId}` : ""}<ArrowUpRight size={12} /></a></dd></dl></section>
            <details><summary>All authors ({picked.authors.length})</summary><p className="research-all-authors">{picked.authors.join("; ")}</p></details>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  </>;
}

function ResourcesTab() {
  const params = useSearchParams();
  const router = useRouter();
  const pickedId = params.get("tool");
  const picked = TOOLS.find((t) => t.id === pickedId) ?? null;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ToolKind | "all">("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (!q) return true;
      return (t.name + " " + t.maintainer + " " + t.summary + " " + t.useFor + " " + t.tags.join(" ")).toLowerCase().includes(q);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, kind]);
  const pick = (id?: string) => {
    const p = new URLSearchParams(params);
    if (id) p.set("tool", id); else p.delete("tool");
    router.replace(`/roadmap?${p.toString()}`, { scroll: false });
  };
  return <>
    <div className="hub-filters">
      <div className="knowledge-search">
        <Search size={15} />
        <input type="search" aria-label="Search resources" placeholder="Search a name, maintainer, use…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="hub-chips">
        <button aria-pressed={kind === "all"} className={`hub-chip ${kind === "all" ? "is-active" : ""}`} onClick={() => setKind("all")}>All ({TOOLS.length})</button>
        {Object.entries(TOOL_KIND_META).map(([id, meta]) => <button key={id} aria-pressed={kind === id} className={`hub-chip ${kind === id ? "is-active" : ""}`} onClick={() => setKind(id as ToolKind)}>{meta.label} ({TOOLS.filter((t) => t.kind === id).length})</button>)}
      </div>
    </div>
    <div className="hub-grid hub-grid-resources">
      {filtered.map((tool) => (
        <button key={tool.id} className="hub-card resource-card" onClick={() => pick(tool.id)}>
          <div className="hub-card-head"><span className="hub-card-meta">{TOOL_KIND_META[tool.kind].label}</span><span className="hub-card-meta">{tool.maintainer}</span></div>
          <h3>{tool.name}</h3>
          <p>{tool.useFor}</p>
          <span className="hub-card-link">Details <ArrowRight size={11} /></span>
        </button>
      ))}
    </div>
    <Sheet open={!!picked} onOpenChange={(open) => { if (!open) pick(undefined); }}>
      <SheetContent side="right" className="research-sheet">
        {picked && <>
          <SheetHeader><SheetTitle>{picked.name}</SheetTitle><SheetDescription>{TOOL_KIND_META[picked.kind].label} · {picked.maintainer}</SheetDescription></SheetHeader>
          <div className="research-detail">
            <div className="research-detail-actions"><a className="button-primary" href={picked.url} target="_blank" rel="noreferrer">Open source<ArrowUpRight size={14} /></a></div>
            <section><h3>What it is</h3><p>{picked.summary}</p></section>
            <section className="research-study-note"><h3>What it&apos;s for <span>Editorial</span></h3><p>{picked.useFor}</p></section>
            <section><h3>Tags</h3><div className="paper-lesson-links">{picked.tags.map((t) => <span key={t} className="knowledge-tag">{t}</span>)}</div></section>
            <section className="research-provenance"><h3>Source</h3><dl><dt>Maintainer</dt><dd>{picked.maintainer}</dd><dt>Source</dt><dd><a href={picked.url} target="_blank" rel="noreferrer">{picked.url}<ArrowUpRight size={12} /></a></dd></dl></section>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  </>;
}
