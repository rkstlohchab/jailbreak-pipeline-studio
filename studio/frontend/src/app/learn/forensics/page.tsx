"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Microscope } from "lucide-react";
import { api, type ForensicsDecisionTree } from "@/lib/api";

export default function ForensicsPage() {
  const [data, setData] = useState<ForensicsDecisionTree | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.forensics.decisionTree()
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="knowledge-page"><p>Load error: {err}</p></div>;
  if (!data) return <div className="knowledge-page"><p>Loading forensics tree…</p></div>;

  return (
    <div className="knowledge-page">
      <header className="page-heading">
        <div>
          <h1>{data.title}</h1>
          <p>{data.subtitle}</p>
        </div>
        <Link className="button-secondary" href="/learn">
          <ArrowLeft size={16} /> Back to lessons
        </Link>
      </header>

      <section className="lesson-article" style={{ display: "grid", gap: "1.5rem" }}>
        <p><strong>When to use:</strong> {data.when_to_use}</p>

        <section>
          <h2 style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Microscope size={20} /> 10-step probe sequence
          </h2>
          <ol style={{ display: "grid", gap: "1rem", paddingLeft: "1.5rem" }}>
            {data.probes.map((p) => (
              <li key={p.step}>
                <strong>{p.name}</strong>
                <div style={{ marginTop: "0.25rem" }}>
                  <code style={{
                    display: "block",
                    padding: "0.5rem 0.75rem",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    whiteSpace: "pre-wrap",
                  }}>{p.prompt}</code>
                  <p style={{ margin: "0.5rem 0 0.25rem" }}>
                    <strong>Signal:</strong> {p.signal}
                  </p>
                  <p style={{ margin: 0 }}><strong>Reads:</strong> {p.reads}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2>Verdict fingerprints</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {data.verdicts.map((v) => (
              <div key={v.class} style={{
                padding: "0.75rem 1rem",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
              }}>
                <strong>{v.class}</strong> <small>(confidence: {v.confidence})</small>
                <p style={{ margin: "0.25rem 0 0" }}>{v.fingerprint}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Notes</h2>
          <ul>{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      </section>
    </div>
  );
}
