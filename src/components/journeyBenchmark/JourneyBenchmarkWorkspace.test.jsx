import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BenchmarkDisclaimer, BenchmarkErrorState, ScoreBadge } from "./BenchmarkStates.jsx";
import { BenchmarkSuiteSelector } from "./BenchmarkSuiteSelector.jsx";
import { BenchmarkResultsPanel } from "./BenchmarkResultsPanel.jsx";
import { BENCHMARK_SUITES, BENCHMARK_TASKS, BENCHMARK_MODELS } from "../../data/civicJourneyBenchmarkData.js";

describe("JourneyBenchmark UI components (renderToStaticMarkup)", () => {
  it("renders BenchmarkDisclaimer with canary token and safety guidelines", () => {
    const html = renderToStaticMarkup(<BenchmarkDisclaimer canaryToken="CANARY_TEST_12345" />);
    expect(html).toContain("Public Service Journey Benchmark &amp; Open Evaluation Dataset");
    expect(html).toContain("CANARY_TEST_12345");
    expect(html).toContain("Deterministic rules remain strictly outside LLM prompts");
    expect(html).toContain("AI evaluation outputs are untrusted suggestions");
  });

  it("renders BenchmarkErrorState with error message and retry button", () => {
    const html = renderToStaticMarkup(<BenchmarkErrorState error="Connection timeout on evaluation endpoint" onRetry={() => {}} />);
    expect(html).toContain("Connection timeout on evaluation endpoint");
    expect(html).toContain("Retry");
  });

  it("renders ScoreBadge with PASS or FAIL status", () => {
    const passHtml = renderToStaticMarkup(<ScoreBadge score={0.92} threshold={0.80} />);
    expect(passHtml).toContain("92%");
    expect(passHtml).toContain("PASS");

    const failHtml = renderToStaticMarkup(<ScoreBadge score={0.65} threshold={0.80} />);
    expect(failHtml).toContain("65%");
    expect(failHtml).toContain("FAIL");
  });

  it("renders BenchmarkSuiteSelector with suites, tasks, and model options", () => {
    const html = renderToStaticMarkup(
      <BenchmarkSuiteSelector
        suites={BENCHMARK_SUITES}
        selectedSuiteId="suite-core-service-navigation"
        onSelectSuite={() => {}}
        tasks={BENCHMARK_TASKS}
        selectedTaskId={BENCHMARK_TASKS[0].id}
        onSelectTask={() => {}}
        models={BENCHMARK_MODELS}
        selectedModelId={BENCHMARK_MODELS[0].id}
        onSelectModel={() => {}}
        onRunSuite={() => {}}
        isRunningSuite={false}
      />
    );
    expect(html).toContain("Candidate / Model:");
    expect(html).toContain("Run Entire Benchmark Suite");
    expect(html).toContain("Core Public Service Navigation Benchmark");
    expect(html).toContain(BENCHMARK_TASKS[0].title);
  });

  it("renders BenchmarkResultsPanel with metrics breakdown and citations", () => {
    const mockResult = {
      compositeScore: 0.92,
      passingThreshold: 0.85,
      passed: true,
      breakdown: {
        correctness: 0.90,
        evidenceGrounding: 0.95,
        abstentionSafety: 1.0,
        accessibility: 0.85
      },
      evaluations: {
        violationsDetected: ["Sample Warning"],
        citationsFound: [
          {
            id: "cite-up-esathi-act",
            title: "Uttar Pradesh Janhit Guarantee Act, 2011",
            authority: "Government of Uttar Pradesh",
            url: "https://edistrict.up.gov.in/edistrictinfo/"
          }
        ],
        citationsMissing: [],
        keyActionsFeedback: [
          { action: "Submit Application Form", matched: true, matchRatio: 1 }
        ],
        avgWordsPerSentence: 14.2
      },
      reproducibilityDigest: "dig_7f8a9b1c",
      modelId: "civic-help-setu-grounded-v1",
      timestamp: new Date().toISOString()
    };

    const html = renderToStaticMarkup(
      <BenchmarkResultsPanel result={mockResult} task={BENCHMARK_TASKS[0]} />
    );

    expect(html).toContain("Evaluation Outcome");
    expect(html).toContain("92%");
    expect(html).toContain("PASS");
    expect(html).toContain("Correctness");
    expect(html).toContain("Evidence Grounding");
    expect(html).toContain("Abstention &amp; Safety");
    expect(html).toContain("Sample Warning");
    expect(html).toContain("Uttar Pradesh Janhit Guarantee Act, 2011");
    expect(html).toContain("dig_7f8a9b1c");
    expect(html).toContain("Provenance: Untrusted suggestion | Human review mandatory");
  });
});
