#!/usr/bin/env node
import { createServer } from 'vite';

async function main() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  });

  try {
    const { SYNTHETIC_REPLAY_FIXTURES } = await server.ssrLoadModule('/src/ai/contracts/replayFixtures.js');
    const { validateAndAdaptMessage } = await server.ssrLoadModule('/src/ai/contracts/schemaEvolution.js');
    const { runCivicAgentPipeline } = await server.ssrLoadModule('/src/ai/agents/agentOrchestrator.js');

    let replayPassed = 0;
    const replayResults = [];

    for (const fixture of SYNTHETIC_REPLAY_FIXTURES) {
      const res = validateAndAdaptMessage(fixture.message, { allowExpired: true });
      const ok =
        res.ok === fixture.expectValid &&
        (fixture.expectValid
          ? res.migratedFrom === fixture.expectedMigratedFrom
          : res.errorEnvelope?.payload?.code === fixture.expectedErrorCode);
      if (ok) replayPassed += 1;
      replayResults.push({ id: fixture.id, ok });
    }

    const startMs = Date.now();
    const liveSlice = await runCivicAgentPipeline('What documents are needed for Birth Certificate?', {
      correlationId: 'eval-corr-1',
    });
    const latencyMs = Date.now() - startMs;

    const report = {
      evaluatedAt: new Date().toISOString(),
      replayFixtures: {
        total: SYNTHETIC_REPLAY_FIXTURES.length,
        passed: replayPassed,
        passRate: `${Math.round((replayPassed / SYNTHETIC_REPLAY_FIXTURES.length) * 100)}%`,
        details: replayResults,
      },
      verticalSlice: {
        status: liveSlice.status,
        grounded: liveSlice.grounded,
        schemaVersion: liveSlice.contractMeta?.schemaVersion,
        hops: liveSlice.contractMeta?.hops?.length || 0,
        latencyMs,
      },
    };

    console.log(JSON.stringify(report, null, 2));

    if (replayPassed !== SYNTHETIC_REPLAY_FIXTURES.length || liveSlice.status !== 'success') {
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

main();
