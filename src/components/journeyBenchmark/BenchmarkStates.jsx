import React from "react";
import { AlertTriangle, ShieldCheck, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export function BenchmarkDisclaimer({ canaryToken }) {
  return (
    <div
      role="region"
      aria-label="Benchmark Disclaimer & AI Output Provenance"
      style={{
        padding: "1rem",
        marginBottom: "1.5rem",
        background: "var(--color-bg-secondary, #f8fafc)",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: "0.5rem"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <ShieldCheck style={{ color: "#2563eb", width: "20px", height: "20px", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", color: "var(--color-text-primary, #0f172a)" }}>
            Public Service Journey Benchmark & Open Evaluation Dataset (NSoC #1188)
          </h4>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #475569)", lineHeight: 1.4 }}>
            This workspace evaluates citizen service navigation, multilingual comprehension, evidence grounding, and abstention on unverified claims.
            <strong> Engineering Boundaries:</strong> Deterministic rules remain strictly outside LLM prompts. AI evaluation outputs are untrusted suggestions carrying explicit provenance. High-impact determinations, certificate approvals, and benefit denials require verified human authority.
          </p>
          {canaryToken && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
              Canary Token (Anti-Contamination): {canaryToken}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BenchmarkErrorState({ error, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        padding: "1rem",
        marginBottom: "1.5rem",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "0.5rem",
        color: "#991b1b"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlertTriangle style={{ width: "20px", height: "20px" }} />
          <span>{error || "An error occurred while evaluating benchmark task."}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "#dc2626",
              color: "#fff",
              border: "none",
              padding: "0.35rem 0.75rem",
              borderRadius: "0.25rem",
              cursor: "pointer"
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px" }} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function ScoreBadge({ score, threshold = 0.8 }) {
  const isPassed = score >= threshold;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.2rem 0.5rem",
        borderRadius: "9999px",
        fontSize: "0.8rem",
        fontWeight: "600",
        background: isPassed ? "#dcfce7" : "#fee2e2",
        color: isPassed ? "#15803d" : "#b91c1c"
      }}
    >
      {isPassed ? <CheckCircle2 style={{ width: "14px", height: "14px" }} /> : <XCircle style={{ width: "14px", height: "14px" }} />}
      {Math.round(score * 100)}% ({isPassed ? "PASS" : "FAIL"})
    </span>
  );
}
