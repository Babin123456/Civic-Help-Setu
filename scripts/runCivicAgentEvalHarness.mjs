#!/usr/bin/env node
import { createServer } from 'vite';

async function main() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    logLevel: 'error',
  });

  try {
    const { runScenarioEvaluationSuite, compareHarnessRuns } = await server.ssrLoadModule(
      '/src/ai/evals/evalRunner.js'
    );
    const { DEFAULT_RELEASE_THRESHOLDS } = await server.ssrLoadModule(
      '/src/ai/evals/evalContracts.js'
    );

    const baselineRun = await runScenarioEvaluationSuite(
      {
        targetId: 'civic-agent-pipeline',
        modelId: 'civic-orchestrator-v1',
        modelVersion: '1.0.0',
        promptVersion: 'v1.0',
        concurrency: 4,
        thresholds: DEFAULT_RELEASE_THRESHOLDS,
      },
      { runId: 'cli-baseline-orchestrator' }
    );

    const candidateRun = await runScenarioEvaluationSuite(
      {
        targetId: 'grounded-rag-assistant',
        modelId: 'grounded-rag-v1',
        modelVersion: '1.1.0',
        promptVersion: 'v1.1',
        concurrency: 4,
        thresholds: DEFAULT_RELEASE_THRESHOLDS,
      },
      { runId: 'cli-candidate-rag' }
    );

    const comparison = compareHarnessRuns(baselineRun, candidateRun, DEFAULT_RELEASE_THRESHOLDS);

    const summary = {
      evaluatedAt: new Date().toISOString(),
      schemaVersion: baselineRun.schemaVersion,
      baseline: {
        targetId: baselineRun.targetId,
        metrics: baselineRun.metrics,
        gatePassed: baselineRun.gate.passed,
        gateFailures: baselineRun.gate.failures,
      },
      candidate: {
        targetId: candidateRun.targetId,
        metrics: candidateRun.metrics,
        gatePassed: candidateRun.gate.passed,
        gateFailures: candidateRun.gate.failures,
      },
      comparison: {
        deltas: comparison.deltas,
        regressedScenarios: comparison.regressedScenarios,
        improvedScenarios: comparison.improvedScenarios,
        gatePassed: comparison.gatePassed,
        gateFailures: comparison.gateFailures,
      },
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!baselineRun.gate.passed || !comparison.gatePassed) {
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

main();
