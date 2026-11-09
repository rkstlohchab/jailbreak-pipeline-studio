"use client";
import { useState } from "react";
import { Check, NotebookPen } from "lucide-react";
import { EXERCISES } from "@/data/learning";
import type { RunRecord, StudyPlan, StudyReview } from "@/lib/run-diagnostics";

export const REVIEW_LABELS: Record<StudyReview["outcome"], string> = {
  unreviewed: "Not reviewed", "task-met": "Task criteria met", "task-unmet": "Task criteria not met", partial: "Partial response",
  refusal: "Refusal observed", uncertain: "Uncertain", "not-evaluable": "Not evaluable (error / no usable response)",
};
export function StudyPlanFields({ plan, onChange, disabled }: { plan: StudyPlan; onChange: (plan: StudyPlan) => void; disabled: boolean }) {
  return <details className="study-plan" open={plan.exerciseId ? true : undefined}>
    <summary><NotebookPen size={15} />Experiment plan <span>Optional · saved with the run</span></summary>
    <fieldset disabled={disabled}><div className="lab-field"><label htmlFor="study-hypothesis">Hypothesis</label><textarea id="study-hypothesis" value={plan.hypothesis} maxLength={2000} onChange={(event) => onChange({ ...plan, hypothesis: event.target.value })} placeholder="What do you expect this change to affect?" /></div><div className="lab-field"><label htmlFor="study-criteria">Success criteria</label><textarea id="study-criteria" value={plan.criteria} maxLength={3000} onChange={(event) => onChange({ ...plan, criteria: event.target.value })} placeholder="What would count as a correct, complete response?" /></div></fieldset>
  </details>;
}
export function RunReview({ run, disabled, onSave }: { run: RunRecord; disabled: boolean; onSave: (review: StudyReview) => boolean }) {
  const [outcome, setOutcome] = useState<StudyReview["outcome"]>(run.review?.outcome ?? "unreviewed");
  const [notes, setNotes] = useState(run.review?.notes ?? "");
  const [saved, setSaved] = useState(false);
  const exercise = EXERCISES.find((item) => item.id === run.study?.exerciseId);
  return <section className="lab-card study-review">
    <div className="lab-card-heading"><span className="lab-section-icon"><NotebookPen size={18} /></span><div><h2>Review this run</h2><p>Your assessment, kept separate from provider signals.</p></div></div>
    <div className="study-review-body">
      {run.study?.hypothesis && <div className="study-record"><strong>Hypothesis at send time</strong><p>{run.study.hypothesis}</p></div>}
      {run.study?.criteria && <div className="study-record"><strong>Success criteria at send time</strong><p>{run.study.criteria}</p></div>}
      {exercise && <div className="study-next-step"><strong>Next comparison</strong><p>{exercise.nextStep}</p></div>}
      <fieldset disabled={disabled}><div className="lab-field"><label htmlFor="review-outcome">Your outcome label</label><select id="review-outcome" value={outcome} onChange={(event) => { setOutcome(event.target.value as StudyReview["outcome"]); setSaved(false); }}>{Object.entries(REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="lab-field"><label htmlFor="review-notes">Evidence and notes</label><textarea id="review-notes" maxLength={6000} value={notes} placeholder="What changed? Cite the response and record uncertainty or confounds." onChange={(event) => { setNotes(event.target.value); setSaved(false); }} /></div><button className="button-secondary" onClick={() => setSaved(onSave({ outcome, notes, reviewedAt: new Date().toISOString() }))}>{saved && <Check size={14} />}{saved ? "Review saved" : "Save review"}</button></fieldset>
      <p className="field-help">Stored with this run in browser history and JSON exports. This label does not identify a hidden refusal layer.</p>
    </div>
  </section>;
}
