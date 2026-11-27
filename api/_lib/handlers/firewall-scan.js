/**
 * api/_lib/handlers/firewall-scan.js
 * Server-side endpoint for scanning untrusted retrieved civic documents and
 * external web content through the Prompt-Injection Firewall (#1151).
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import {
  FIREWALL_CONTRACT_VERSION,
  scanRetrievedDocument,
  enforceToolAllowlist,
} from '../../../src/ai/promptInjectionFirewall.js';

const rateLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

export const FIREWALL_METRICS = {
  totalScans: 0,
  blockedScans: 0,
  partialQuarantines: 0,
  rejectedInvalid: 0,
};

function buildFlightKey(body) {
  const sourceId = typeof body?.sourceId === 'string' ? body.sourceId.slice(0, 120) : 'unknown';
  const len = typeof body?.content === 'string' ? body.content.length : (body?.passages?.length || 0);
  const idempotency = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 64) : '';
  return `${sourceId}:${len}:${idempotency}`;
}

export default async function firewallScanHandler(req, res) {
  if (req.method !== 'POST') {
    res?.setHeader?.('Allow', 'POST');
    return {
      status: 405,
      body: { error: 'Method Not Allowed. Use POST.' },
    };
  }

  const key = clientKey(req.headers || {});
  if (key) {
    const rate = rateLimiter.take(key);
    if (!rate.allowed) {
      return {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        body: {
          error: 'Too many firewall scan requests. Please retry later.',
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      };
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      FIREWALL_METRICS.rejectedInvalid += 1;
      return {
        status: 400,
        body: {
          contractVersion: FIREWALL_CONTRACT_VERSION,
          error: 'Invalid JSON payload.',
        },
      };
    }
  }

  const flightKey = buildFlightKey(body);
  const result = await singleFlight.run(flightKey, async () => {
    const scanResult = scanRetrievedDocument(body);
    if (!scanResult.valid) {
      FIREWALL_METRICS.rejectedInvalid += 1;
      return {
        status: 400,
        body: {
          contractVersion: FIREWALL_CONTRACT_VERSION,
          error: 'Validation failed for untrusted document payload.',
          details: scanResult.errors,
        },
      };
    }

    FIREWALL_METRICS.totalScans += 1;
    if (scanResult.decision === 'block') FIREWALL_METRICS.blockedScans += 1;
    if (scanResult.decision === 'partial_quarantine') FIREWALL_METRICS.partialQuarantines += 1;

    const toolCheck = body.requestedTool
      ? enforceToolAllowlist({
          toolName: body.requestedTool,
          humanApproved: Boolean(body.humanApproved),
          approverId: body.approverId || null,
        })
      : null;

    return {
      status: 200,
      body: {
        contractVersion: scanResult.contractVersion,
        sourceId: scanResult.sourceId,
        sourceType: scanResult.sourceType,
        decision: scanResult.decision,
        counts: scanResult.counts,
        threatClasses: scanResult.threatClasses,
        redactedCategories: scanResult.redactedCategories,
        isolatedEvidenceEnvelope: scanResult.isolatedEvidenceEnvelope,
        quarantinedPassages: scanResult.quarantinedPassages.map((p) => ({
          passageIndex: p.passageIndex,
          verdict: p.verdict,
          findings: p.findings,
        })),
        toolPolicy: toolCheck,
        telemetryEvent: scanResult.telemetryEvent,
      },
    };
  });

  return result;
}
