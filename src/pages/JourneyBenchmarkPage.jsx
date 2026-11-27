import React from "react";
import { JourneyBenchmarkWorkspace } from "../components/journeyBenchmark/JourneyBenchmarkWorkspace.jsx";

/**
 * Public Service Journey Benchmark & Open Evaluation Dataset Page.
 * Accessible at /journey-benchmark.
 */
export default function JourneyBenchmarkPage() {
  return (
    <div className="journey-benchmark-page">
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1.5rem 0 1.5rem" }}>
        <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.75rem", fontWeight: "700" }}>
          Public Service Journey Benchmark & Open Evaluation Dataset
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-secondary, #64748b)", fontSize: "0.95rem" }}>
          Evaluate civic service navigation, vernacular language comprehension, statutory citation grounding, and abstention compliance across public service journeys.
        </p>
      </div>
      <JourneyBenchmarkWorkspace />
    </div>
  );
}
