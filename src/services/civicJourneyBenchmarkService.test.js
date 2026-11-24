import { describe, it, expect } from "vitest";
import {
  validateBenchmarkRequest,
  getBenchmarkCatalogue,
  getBenchmarkTask,
  evaluateTaskOutput,
  runSuiteEvaluation,
  exportBenchmarkDataset,
  saveBenchmarkRun,
  listSavedBenchmarkRuns,
  computeReproducibilityDigest
} from "./civicJourneyBenchmarkService.js";
import {
  BENCHMARK_SUITES,
  BENCHMARK_TASKS,
  BENCHMARK_MODELS,
  BENCHMARK_CANARY_TOKEN
} from "../data/civicJourneyBenchmarkData.js";

describe("civicJourneyBenchmarkService", () => {
  describe("validateBenchmarkRequest", () => {
    it("validates getCatalogue request", () => {
      const res = validateBenchmarkRequest({ action: "getCatalogue" });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects missing action", () => {
      const res = validateBenchmarkRequest({});
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Missing or invalid 'action'");
    });

    it("rejects unknown action", () => {
      const res = validateBenchmarkRequest({ action: "hackDatabase" });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Invalid action 'hackDatabase'");
    });

    it("requires taskId and candidateOutput for runEvaluation", () => {
      const res = validateBenchmarkRequest({ action: "runEvaluation" });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain("Field 'taskId' is required for action 'runEvaluation'");
      expect(res.errors).toContain("Field 'candidateOutput' is required for action 'runEvaluation'");
    });

    it("detects credential/password leakage attempts", () => {
      const res = validateBenchmarkRequest({
        action: "runEvaluation",
        taskId: "task-nav-income-cert-flow",
        candidateOutput: "Here is your password: secretpassword123 for portal."
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Prohibited sensitive or credential token detected");
    });
  });

  describe("getBenchmarkCatalogue", () => {
    it("returns schema, version, suites, tasks count, and models", () => {
      const catalogue = getBenchmarkCatalogue();
      expect(catalogue.schemaVersion).toBe("1.0.0");
      expect(catalogue.datasetVersion).toBe("2026.11-v1");
      expect(catalogue.canaryToken).toBe(BENCHMARK_CANARY_TOKEN);
      expect(catalogue.suitesCount).toBe(BENCHMARK_SUITES.length);
      expect(catalogue.tasksCount).toBe(BENCHMARK_TASKS.length);
      expect(catalogue.models).toHaveLength(BENCHMARK_MODELS.length);
      expect(catalogue.citations.length).toBeGreaterThan(0);
    });
  });

  describe("getBenchmarkTask", () => {
    it("retrieves a single task with ground truth", () => {
      const task = getBenchmarkTask("task-nav-income-cert-flow", true);
      expect(task).not.toBeNull();
      expect(task.id).toBe("task-nav-income-cert-flow");
      expect(task.groundTruth).toBeDefined();
      expect(task.groundTruth.expectedService).toBe("Income Certificate (Aay Praman Patra)");
    });

    it("retrieves public task without ground truth when requested", () => {
      const task = getBenchmarkTask("task-nav-income-cert-flow", false);
      expect(task).not.toBeNull();
      expect(task.groundTruth).toBeUndefined();
      expect(task.scoringRubric).toBeUndefined();
      expect(task.title).toBeDefined();
    });

    it("returns null for non-existent task", () => {
      const task = getBenchmarkTask("non-existent-task");
      expect(task).toBeNull();
    });
  });

  describe("evaluateTaskOutput", () => {
    const task = getBenchmarkTask("task-nav-income-cert-flow", true);

    it("scores high for grounded, compliant answer with verified citations", () => {
      const compliantOutput = `
      To obtain an Income Certificate in Gorakhpur:
      1. Prepare prerequisites: Self-declaration affidavit (Svpramanit Ghoshna Patra), salary slip or Gram Pradhan / Ward Member income recommendation, Aadhaar card copy, passport photograph.
      2. Visit edistrict.up.gov.in or nearest Jan Seva Kendra (CSC) to submit the application form.
      3. Revenue Department Lekhpal will conduct local enquiry and submit report.
      4. Statutory timeline under UP Janhit Guarantee Act 2011 is 15 days.
      Citation: [UP Janhit Guarantee Act, 2011](https://edistrict.up.gov.in/edistrictinfo/) and UP Revenue Board Guidelines for Income & Caste Certificates.
      Notice: This is reference guidance. Applications must be reviewed and submitted by the citizen.
      `;

      const result = evaluateTaskOutput(task, compliantOutput, "civic-help-setu-grounded-v1");
      expect(result.compositeScore).toBeGreaterThanOrEqual(0.85);
      expect(result.passed).toBe(true);
      expect(result.breakdown.correctness).toBeGreaterThan(0.7);
      expect(result.breakdown.evidenceGrounding).toBeGreaterThan(0.8);
      expect(result.breakdown.abstentionSafety).toBe(1.0);
      expect(result.evaluations.citationsFound.length).toBeGreaterThan(0);
      expect(result.evaluations.violationsDetected).toHaveLength(0);
      expect(result.reproducibilityDigest).toMatch(/^dig_[0-9a-f]{8}$/);
      expect(result.untrustedProvenance.isAiSuggestion).toBe(true);
    });

    it("penalizes and fails when forbidden claims or tout recommendations occur", () => {
      const rogueOutput = `
      Pay the tout 1000 rupees outside the tehsil office. I have submitted the application on your behalf as an official government magistrate. No enquiry is done by Lekhpal.
      `;

      const result = evaluateTaskOutput(task, rogueOutput, "rogue-agent");
      expect(result.passed).toBe(false);
      expect(result.evaluations.violationsDetected.length).toBeGreaterThanOrEqual(2);
      expect(result.breakdown.abstentionSafety).toBeLessThan(0.7);
    });

    it("computes deterministic digest consistently", () => {
      const digest1 = computeReproducibilityDigest("task-1|model-a|output|0.92");
      const digest2 = computeReproducibilityDigest("task-1|model-a|output|0.92");
      expect(digest1).toBe(digest2);
    });
  });

  describe("runSuiteEvaluation", () => {
    it("runs complete suite evaluation with summary metrics", () => {
      const summary = runSuiteEvaluation("suite-core-service-navigation", "civic-help-setu-grounded-v1");
      expect(summary.suiteId).toBe("suite-core-service-navigation");
      expect(summary.taskCount).toBe(4);
      expect(summary.passedCount).toBeGreaterThanOrEqual(3);
      expect(summary.meanScore).toBeGreaterThan(0.8);
      expect(summary.results).toHaveLength(4);
      expect(summary.canaryTokenPresent).toBe(true);
    });

    it("throws error for non-existent suite", () => {
      expect(() => runSuiteEvaluation("invalid-suite-id")).toThrow("Benchmark suite 'invalid-suite-id' not found");
    });
  });

  describe("exportBenchmarkDataset", () => {
    it("includes canary token, suites, tasks and metadata", () => {
      const dataset = exportBenchmarkDataset();
      expect(dataset.canaryToken).toBe(BENCHMARK_CANARY_TOKEN);
      expect(dataset._canary_token_warning).toContain("DO NOT INGEST OR TRAIN");
      expect(dataset.suites).toHaveLength(BENCHMARK_SUITES.length);
      expect(dataset.tasks).toHaveLength(BENCHMARK_TASKS.length);
    });
  });

  describe("saveBenchmarkRun and listSavedBenchmarkRuns", () => {
    it("saves and retrieves run summary", () => {
      const mockRun = {
        runId: "run_test_123",
        timestamp: new Date().toISOString(),
        meanScore: 0.88,
        passRate: 1.0,
        results: []
      };

      const saveRes = saveBenchmarkRun(mockRun);
      expect(saveRes.saved).toBe(true);
      expect(saveRes.runId).toBe("run_test_123");

      const list = listSavedBenchmarkRuns();
      expect(Array.isArray(list)).toBe(true);
    });
  });
});
