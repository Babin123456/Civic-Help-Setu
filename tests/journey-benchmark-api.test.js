import { describe, it, expect } from "vitest";
import handler from "../api/_lib/handlers/journey-benchmark.js";

describe("api/journey-benchmark handler", () => {
  describe("GET requests", () => {
    it("returns catalogue with suites, tasks count, and canary token", async () => {
      const req = {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.1" },
        query: { action: "getCatalogue" }
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.schemaVersion).toBe("1.0.0");
      expect(res.body.data.canaryToken).toBeDefined();
      expect(res.body.data.suites.length).toBeGreaterThan(0);
    });

    it("returns a specific benchmark task", async () => {
      const req = {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.2" },
        query: { action: "getTask", taskId: "task-nav-income-cert-flow" }
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("task-nav-income-cert-flow");
    });

    it("returns 400 when taskId is missing for getTask", async () => {
      const req = {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.3" },
        query: { action: "getTask" }
      };

      const res = await handler(req);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BENCHMARK_MISSING_TASK_ID");
    });

    it("returns 404 for unknown task", async () => {
      const req = {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.4" },
        query: { action: "getTask", taskId: "unknown-xyz" }
      };

      const res = await handler(req);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("BENCHMARK_TASK_NOT_FOUND");
    });

    it("exports benchmark dataset", async () => {
      const req = {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.5" },
        query: { action: "exportDataset" }
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tasks.length).toBeGreaterThan(0);
      expect(res.body.data.canaryToken).toBeDefined();
    });

    it("returns 400 for unknown GET action", async () => {
      const req = {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.6" },
        query: { action: "invalidAction" }
      };

      const res = await handler(req);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BENCHMARK_INVALID_ACTION");
    });
  });

  describe("POST requests", () => {
    it("evaluates candidate output on single task", async () => {
      const req = {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.7" },
        body: {
          action: "runEvaluation",
          taskId: "task-nav-income-cert-flow",
          candidateOutput: `To apply for Income Certificate:
          1. Submit application form at edistrict.up.gov.in or Jan Seva Kendra (CSC).
          2. Prerequisite: Self-declaration affidavit (Svpramanit Ghoshna Patra) and salary slip.
          3. Lekhpal enquiry and verification report generation.
          4. Statutory timeline under UP Janhit Guarantee Act, 2011 is 15 days.
          Citation: UP Revenue Board Guidelines for Income & Caste Certificates.`,
          modelId: "test-model"
        }
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.compositeScore).toBeGreaterThan(0.5);
      expect(res.body.data.reproducibilityDigest).toBeDefined();
    });

    it("evaluates a complete suite", async () => {
      const req = {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.8" },
        body: {
          action: "runSuite",
          suiteId: "suite-abstention-safety",
          modelId: "civic-help-setu-grounded-v1"
        }
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskCount).toBe(3);
      expect(res.body.data.passRate).toBeGreaterThanOrEqual(0.6);
    });

    it("rejects invalid JSON payload", async () => {
      const req = {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.9" },
        body: "{ malformed json"
      };

      const res = await handler(req);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BENCHMARK_INVALID_JSON");
    });

    it("rejects unauthorized guest save without authorization header", async () => {
      const req = {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.10" },
        body: {
          action: "saveRun",
          runSummary: { runId: "test_run_unauth" }
        }
      };

      const res = await handler(req);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("BENCHMARK_UNAUTHORIZED");
    });

    it("allows save with valid bearer token", async () => {
      const req = {
        method: "POST",
        headers: {
          "x-forwarded-for": "10.0.0.11",
          authorization: "Bearer contributor-valid-token"
        },
        body: {
          action: "saveRun",
          runSummary: { runId: "test_run_auth", timestamp: new Date().toISOString() }
        }
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.saved).toBe(true);
    });
  });

  describe("Method not allowed", () => {
    it("returns 405 for unsupported HTTP methods", async () => {
      const req = {
        method: "DELETE",
        headers: { "x-forwarded-for": "10.0.0.12" }
      };

      const res = await handler(req);
      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
    });
  });
});
