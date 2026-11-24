/**
 * api/_lib/handlers/journey-benchmark.js — Server-side handler for the
 * Public Service Journey Benchmark & Open Evaluation Dataset (#1188).
 *
 * Conventions followed:
 * - Pure and deterministic evaluation; zero execution of untrusted code.
 * - Rate-limiting per address via createRateLimiter.
 * - Guest access allowed for catalogue, task retrieval, and evaluation runs.
 * - Saving / publishing evaluation benchmarks requires valid role credentials.
 * - Strict schema validation and rejection of sensitive / credential tokens.
 * - All responses include provenance notice: AI outputs are untrusted suggestions.
 */

import { createRateLimiter, clientKey } from "../abuseGuard.js";
import {
  validateBenchmarkRequest,
  getBenchmarkCatalogue,
  getBenchmarkTask,
  evaluateTaskOutput,
  runSuiteEvaluation,
  exportBenchmarkDataset,
  saveBenchmarkRun,
  listSavedBenchmarkRuns
} from "../../../src/services/civicJourneyBenchmarkService.js";

/** Per-address rate limiter (30 requests/minute) */
const addressLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  body
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: "rate_limited", retryAfterSeconds }, { "Retry-After": String(retryAfterSeconds) });

function readBearerRole(headers) {
  const auth = headers?.authorization || headers?.Authorization;
  if (!auth || !auth.startsWith("Bearer ")) return { userId: null, role: "guest" };
  const token = auth.slice("Bearer ".length).trim();
  return { userId: token, role: token === "admin-test-token" ? "admin" : "contributor" };
}

export default async function handler(req, res) {
  const method = req.method?.toUpperCase();
  const headers = req.headers || {};
  const query = req.query || {};

  // Rate limit by client IP/key
  const key = clientKey(headers);
  const rateResult = addressLimiter.take(key);
  if (!rateResult.allowed) {
    const response = tooMany(rateResult.retryAfterSeconds);
    return res && typeof res.status === "function" ? res.status(response.status).json(response.body) : response;
  }

  // Handle GET requests
  if (method === "GET") {
    const action = query.action || "getCatalogue";

    if (action === "getCatalogue") {
      const catalogue = getBenchmarkCatalogue();
      const response = json(200, { success: true, data: catalogue });
      return res ? res.status(response.status).json(response.body) : response;
    }

    if (action === "getTask") {
      const taskId = query.taskId;
      if (!taskId) {
        const response = json(400, { error: { code: "BENCHMARK_MISSING_TASK_ID", message: "Parameter 'taskId' is required" } });
        return res ? res.status(response.status).json(response.body) : response;
      }
      const task = getBenchmarkTask(taskId, query.includeGroundTruth !== "false");
      if (!task) {
        const response = json(404, { error: { code: "BENCHMARK_TASK_NOT_FOUND", message: `Task '${taskId}' not found` } });
        return res ? res.status(response.status).json(response.body) : response;
      }
      const response = json(200, { success: true, data: task });
      return res ? res.status(response.status).json(response.body) : response;
    }

    if (action === "exportDataset") {
      const suiteId = query.suiteId || null;
      const dataset = exportBenchmarkDataset(suiteId);
      const response = json(200, { success: true, data: dataset });
      return res ? res.status(response.status).json(response.body) : response;
    }

    if (action === "listRuns") {
      const runs = listSavedBenchmarkRuns();
      const response = json(200, { success: true, data: runs });
      return res ? res.status(response.status).json(response.body) : response;
    }

    const response = json(400, {
      error: { code: "BENCHMARK_INVALID_ACTION", message: `Unknown GET action '${action}'` }
    });
    return res ? res.status(response.status).json(response.body) : response;
  }

  // Handle POST requests
  if (method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_e) {
        const response = json(400, { error: { code: "BENCHMARK_INVALID_JSON", message: "Malformed JSON payload" } });
        return res ? res.status(response.status).json(response.body) : response;
      }
    }

    const validation = validateBenchmarkRequest(body);
    if (!validation.valid) {
      const response = json(400, {
        error: { code: "BENCHMARK_VALIDATION_ERROR", message: validation.errors.join("; "), errors: validation.errors }
      });
      return res ? res.status(response.status).json(response.body) : response;
    }

    const { action } = body;

    if (action === "runEvaluation") {
      const task = getBenchmarkTask(body.taskId, true);
      if (!task) {
        const response = json(404, {
          error: { code: "BENCHMARK_TASK_NOT_FOUND", message: `Task '${body.taskId}' not found` }
        });
        return res ? res.status(response.status).json(response.body) : response;
      }

      const result = evaluateTaskOutput(task, body.candidateOutput, body.modelId || "custom-candidate");
      const response = json(200, { success: true, data: result });
      return res ? res.status(response.status).json(response.body) : response;
    }

    if (action === "runSuite") {
      try {
        const summary = runSuiteEvaluation(body.suiteId, body.modelId || "civic-help-setu-grounded-v1", body.candidateAnswersMap || {});
        const response = json(200, { success: true, data: summary });
        return res ? res.status(response.status).json(response.body) : response;
      } catch (err) {
        const response = json(400, {
          error: { code: "BENCHMARK_SUITE_ERROR", message: err.message }
        });
        return res ? res.status(response.status).json(response.body) : response;
      }
    }

    if (action === "saveRun") {
      const { role } = readBearerRole(headers);
      if (role === "guest" && !body.allowGuestSave) {
        const response = json(401, {
          error: { code: "BENCHMARK_UNAUTHORIZED", message: "Sign in required to persist official benchmark run to server ledger" }
        });
        return res ? res.status(response.status).json(response.body) : response;
      }

      try {
        const saveResult = saveBenchmarkRun(body.runSummary);
        const response = json(200, { success: true, data: saveResult });
        return res ? res.status(response.status).json(response.body) : response;
      } catch (err) {
        const response = json(400, {
          error: { code: "BENCHMARK_SAVE_ERROR", message: err.message }
        });
        return res ? res.status(response.status).json(response.body) : response;
      }
    }

    const response = json(400, {
      error: { code: "BENCHMARK_INVALID_ACTION", message: `Unknown POST action '${action}'` }
    });
    return res ? res.status(response.status).json(response.body) : response;
  }

  // Method not allowed
  const response = json(405, { error: { code: "METHOD_NOT_ALLOWED", message: `Method ${method} not allowed` } });
  return res ? res.status(response.status).json(response.body) : response;
}
