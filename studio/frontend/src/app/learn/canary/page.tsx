"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { api, type CanarySet, type CanaryRunPayload, type CanaryDiffPayload } from "@/lib/api";

export default function CanaryPage() {
  const [set, setSet] = useState<CanarySet | null>(null);
  const [runs, setRuns] = useState<Record<string, string[]>>({});
  const [target, setTarget] = useState<string>("");
  const [dateA, setDateA] = useState<string>("");
  const [dateB, setDateB] = useState<string>("");
  const [runData, setRunData] = useState<CanaryRunPayload | null>(null);
  const [diff, setDiff] = useState<CanaryDiffPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.canary.set().then(setSet).catch((e) => setErr(String(e)));
    api.canary.runs().then((r) => {
      setRuns(r.runs);
      const first = Object.keys(r.runs)[0];
      if (first) {
        setTarget(first);
        const dates = r.runs[first] ?? [];
        if (dates[0]) setDateA(dates[0]);
        if (dates[1]) setDateB(dates[1]);
      }
    }).catch((e) => setErr(String(e)));
  }, []);

  const loadRun = async () => {
    if (!target || !dateA) return;
    try { setRunData(await api.canary.run(target, dateA)); setDiff(null); }
    catch (e) { setErr(String(e)); }
  };
  const loadDiff = async () => {
    if (!target || !dateA || !dateB) return;
    try { setDiff(await api.canary.diff(target, dateA, dateB)); }
    catch (e) { setErr(String(e)); }
  };

  if (err) return <div className="knowledge-page"><p>Error: {err}</p></div>;
  if (!set) return <div className="knowledge-page"><p>Loading canary set…</p></div>;

  const targets = Object.keys(runs);

  return (
    <div className="knowledge-page">
      <header className="page-heading">
        <div>
          <h1>Canary drift monitor</h1>
          <p>{set.purpose}</p>
        </div>
        <Link className="button-secondary" href="/learn">
          <ArrowLeft size={16} /> Back to lessons
        </Link>
      </header>

      <section className="lesson-article" style={{ display: "grid", gap: "1.5rem" }}>
        <section>
          <h2 style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <ShieldAlert size={20} /> Verdict rubric
          </h2>
          <ul>
            {Object.entries(set.rubric).map(([k, v]) => (
              <li key={k}><strong>{k}:</strong> {v}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Canary categories ({set.categories.length})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
            {set.categories.map((c) => (
              <div key={c.id} style={{
                padding: "0.75rem 1rem",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
              }}>
                <strong>{c.id}</strong>
                <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                  {c.prompts.map((p) => <li key={p}>{p}</li>)}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Runs on disk</h2>
          {targets.length === 0 ? (
            <p>No runs yet. From the repo root: <code>python studio/scripts/canary_run.py --target openai:gpt-4o</code></p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label>Target
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {targets.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Date A
                <select value={dateA} onChange={(e) => setDateA(e.target.value)}>
                  {(runs[target] ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label>Date B (for diff)
                <select value={dateB} onChange={(e) => setDateB(e.target.value)}>
                  <option value="">(none)</option>
                  {(runs[target] ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="button-primary" onClick={loadRun} disabled={!dateA}>Load run</button>
                <button className="button-secondary" onClick={loadDiff} disabled={!dateA || !dateB}>Diff A→B</button>
              </div>
            </div>
          )}
        </section>

        {runData && (
          <section>
            <h2>Run totals · {runData.target} · {runData.date}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ textAlign: "left" }}>Category</th><th>Refuse</th><th>Hedge</th><th>Comply</th></tr></thead>
              <tbody>
                {Object.entries(runData.totals).map(([cat, counts]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td style={{ textAlign: "center" }}>{counts.refuse}</td>
                    <td style={{ textAlign: "center" }}>{counts.hedge}</td>
                    <td style={{ textAlign: "center" }}>{counts.comply}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {diff && (
          <section>
            <h2>Drift · {diff.date_a} → {diff.date_b}</h2>
            {diff.flips.length === 0 ? (
              <p>No verdict flips between runs.</p>
            ) : (
              <>
                <p><strong>{diff.flips.length}</strong> flip(s) across categories: {diff.categories_affected.join(", ")}</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ textAlign: "left" }}>Category</th><th>Idx</th><th>From</th><th>To</th></tr></thead>
                  <tbody>
                    {diff.flips.map((f, i) => (
                      <tr key={`${f.category}-${f.idx}-${i}`}>
                        <td>{f.category}</td>
                        <td style={{ textAlign: "center" }}>{f.idx}</td>
                        <td style={{ textAlign: "center" }}>{f.from}</td>
                        <td style={{ textAlign: "center" }}>{f.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
