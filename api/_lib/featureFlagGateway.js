/* global process */
/**
 * api/_lib/featureFlagGateway.js
 *
 * Server-side Feature Flag & Emergency Kill-Switch Gateway (#1337).
 * Loads static defaults + environment overrides + optional remote loader
 * with safe fallback when remote config is unreachable, and prevents
 * client-side spoofing of server-only flags.
 */

import {
  createFeatureFlagEngine,
  validateFlagRegistry,
  FLAG_SCHEMA_VERSION,
} from '../../src/services/featureFlagEngine.js';

export const DEFAULT_PLATFORM_FLAGS = Object.freeze({
  'civic.ai.grounded_citations': {
    defaultEnabled: true,
    rolloutPercentage: 100,
    killSwitch: false,
    exposure: 'server',
  },
  'civic.offline.draft_sync': {
    defaultEnabled: true,
    rolloutPercentage: 100,
    killSwitch: false,
    exposure: 'client',
  },
  'civic.ward.heatmap_v2': {
    defaultEnabled: false,
    rolloutPercentage: 25,
    killSwitch: false,
    exposure: 'client',
  },
});

export function parseEnvFlags(env = process.env || {}) {
  const raw = env.FEATURE_FLAGS_JSON;
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    const check = validateFlagRegistry(parsed);
    return check.valid ? parsed : {};
  } catch {
    return {};
  }
}

export async function createServerFeatureFlagGateway({
  staticDefaults = DEFAULT_PLATFORM_FLAGS,
  env = process.env || {},
  remoteLoader = null,
  adminToken = env.FEATURE_FLAG_ADMIN_TOKEN || '',
  onAudit = () => {},
} = {}) {
  const envFlags = parseEnvFlags(env);
  const engine = createFeatureFlagEngine({
    staticDefaults,
    initialFlags: envFlags,
    onAudit,
  });

  let degraded = false;
  if (typeof remoteLoader === 'function') {
    try {
      const remote = await remoteLoader();
      if (remote && typeof remote === 'object') {
        const res = engine.mergeRemoteRegistry({ ...envFlags, ...remote });
        if (!res.applied) degraded = true;
      }
    } catch {
      degraded = true;
    }
  }

  function isAuthorizedAdmin(req) {
    if (req.auth?.role === 'admin') return true;
    const token = req.headers?.['x-feature-flag-admin-token'];
    return Boolean(adminToken && typeof token === 'string' && token === adminToken);
  }

  async function handler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'GET') {
      const context = {
        userId: req.auth?.userId || req.query?.userId,
        tenantId: req.headers?.['x-tenant-id'] || req.query?.tenantId,
        jurisdictionCode: req.headers?.['x-jurisdiction-code'] || req.query?.jurisdiction,
      };
      // Client projection strips server-only flags to prevent internal flag leakage.
      const flags = engine.evaluateAll(context, { exposure: 'client' });
      return res.status(200).json({
        schemaVersion: FLAG_SCHEMA_VERSION,
        degraded,
        flags,
      });
    }

    if (method === 'POST') {
      if (!isAuthorizedAdmin(req)) {
        return res.status(403).json({
          error: 'Forbidden: admin authorization required for kill-switch mutation',
          code: 'FEATURE_FLAG_FORBIDDEN',
        });
      }
      const { flagKey, killSwitch, reason = '' } = req.body || {};
      if (!flagKey || typeof killSwitch !== 'boolean') {
        return res.status(400).json({
          error: 'flagKey (string) and killSwitch (boolean) are required',
          code: 'INVALID_KILL_SWITCH_PAYLOAD',
        });
      }
      try {
        const audit = engine.setKillSwitch(flagKey, killSwitch, {
          actorId: req.auth?.userId || 'admin-token',
          reason,
        });
        return res.status(200).json({ ok: true, audit, evaluation: engine.evaluate(flagKey) });
      } catch (err) {
        return res.status(404).json({ error: err.message, code: 'FLAG_NOT_FOUND' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  return {
    engine,
    isDegraded: () => degraded,
    handler,
  };
}
