import React from "react";
import { CheckCircle2, AlertOctagon, ExternalLink, ShieldAlert, BookOpen, Layers } from "lucide-react";
import { ScoreBadge } from "./BenchmarkStates.jsx";

export function BenchmarkResultsPanel({ result, task }) {
  if (!result) return null;

  const {
    compositeScore,
    passingThreshold,
    passed,
    breakdown,
    evaluations,
    reproducibilityDigest,
    modelId,
    timestamp
  } = result;

  return (
    <div
      role="region"
      aria-label="Benchmark Evaluation Results"
      style={{
        padding: "1.25rem",
        background: "var(--color-bg-primary, #ffffff)",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: "0.5rem",
        marginTop: "1.5rem"
      }}
    >
      {/* Header & Composite */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border, #e2e8f0)", paddingBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>Evaluation Outcome</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>
            Model: <strong>{modelId}</strong> | Tested: {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ScoreBadge score={compositeScore} threshold={passingThreshold} />
        </div>
      </div>

      {/* Metrics Breakdown Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
        <div style={{ background: "var(--color-bg-secondary, #f8fafc)", padding: "0.75rem", borderRadius: "0.375rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Correctness</div>
          <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{Math.round(breakdown.correctness * 100)}%</div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Actions & SLA Match</div>
        </div>

        <div style={{ background: "var(--color-bg-secondary, #f8fafc)", padding: "0.75rem", borderRadius: "0.375rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Evidence Grounding</div>
          <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{Math.round(breakdown.evidenceGrounding * 100)}%</div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Statutory Citations</div>
        </div>

        <div style={{ background: "var(--color-bg-secondary, #f8fafc)", padding: "0.75rem", borderRadius: "0.375rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Abstention & Safety</div>
          <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{Math.round(breakdown.abstentionSafety * 100)}%</div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Refusal of Tout/Auto-file</div>
        </div>

        <div style={{ background: "var(--color-bg-secondary, #f8fafc)", padding: "0.75rem", borderRadius: "0.375rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Accessibility</div>
          <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{Math.round(breakdown.accessibility * 100)}%</div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Readability & Headings</div>
        </div>
      </div>

      {/* Safety Violations Banner */}
      {evaluations.violationsDetected && evaluations.violationsDetected.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            color: "#991b1b"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600", marginBottom: "0.25rem" }}>
            <AlertOctagon style={{ width: "16px", height: "16px" }} />
            Safety & Abstention Breaches Flagged:
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
            {evaluations.violationsDetected.map((violation, i) => (
              <li key={i}>{violation}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Citations Found and Missing */}
      <div style={{ marginTop: "1.25rem" }}>
        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BookOpen style={{ width: "16px", height: "16px", color: "#2563eb" }} />
          Citation Verification & Grounding
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {evaluations.citationsFound && evaluations.citationsFound.map(cite => (
            <div
              key={cite.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "0.25rem",
                fontSize: "0.85rem"
              }}
            >
              <div>
                <strong>{cite.title}</strong> — <span style={{ color: "#475569" }}>{cite.authority}</span>
              </div>
              <a
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#16a34a", textDecoration: "none" }}
              >
                Verified source <ExternalLink style={{ width: "12px", height: "12px" }} />
              </a>
            </div>
          ))}

          {evaluations.citationsMissing && evaluations.citationsMissing.map(cite => (
            <div
              key={cite.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                background: "#fefce8",
                border: "1px solid #fef08a",
                borderRadius: "0.25rem",
                fontSize: "0.85rem",
                color: "#854d0e"
              }}
            >
              <div>
                <strong>Missing Citation:</strong> {cite.title} ({cite.authority})
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Action Verification Checklist */}
      {evaluations.keyActionsFeedback && evaluations.keyActionsFeedback.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Layers style={{ width: "16px", height: "16px", color: "#4b5563" }} />
            Journey Action Completeness
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {evaluations.keyActionsFeedback.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  padding: "0.35rem 0.5rem",
                  background: item.matched ? "#f8fafc" : "#fff1f2",
                  borderRadius: "0.25rem"
                }}
              >
                {item.matched ? (
                  <CheckCircle2 style={{ width: "16px", height: "16px", color: "#16a34a", flexShrink: 0 }} />
                ) : (
                  <ShieldAlert style={{ width: "16px", height: "16px", color: "#e11d48", flexShrink: 0 }} />
                )}
                <span style={{ color: item.matched ? "inherit" : "#9f1239" }}>
                  {item.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provenance & Reproducibility Footer */}
      <div
        style={{
          marginTop: "1.5rem",
          paddingTop: "0.75rem",
          borderTop: "1px dashed var(--color-border, #e2e8f0)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.75rem",
          color: "var(--color-text-secondary, #64748b)"
        }}
      >
        <span>
          Reproducibility Digest: <code style={{ fontFamily: "monospace", background: "#f1f5f9", padding: "0.1rem 0.3rem" }}>{reproducibilityDigest}</code>
        </span>
        <span>
          Provenance: Untrusted suggestion | Human review mandatory
        </span>
      </div>
    </div>
  );
}
