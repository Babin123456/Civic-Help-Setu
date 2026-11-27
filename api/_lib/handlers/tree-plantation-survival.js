/* global process */
/**
 * api/_lib/handlers/tree-plantation-survival.js
 *
 * Serverless API handler for Tree-Plantation Survival & Public Green Asset Registry (#1441):
 *   GET  /api/tree-plantation-survival
 *   GET  /api/tree-plantation-survival/assets?wardId=&batchId=&species=
 *   GET  /api/tree-plantation-survival/audit-log           (Admin-gated)
 *   POST /api/tree-plantation-survival/assets              (Admin-gated + duplicate check + jurisdiction)
 *   POST /api/tree-plantation-survival/assets/:id/evidence (Authenticated citizen or admin)
 *   POST /api/tree-plantation-survival/assets/:id/verify   (Admin-gated + jurisdiction)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  GREEN_ASSET_SCHEMA_VERSION,
  aggregateGreenAssetSummary,
  appendGreenAssetEvidence,
  registerGreenAsset,
  validateGreenAssetZeroPii,
  verifyGreenAssetSurvival,
} from '../../../src/services/treePlantationSurvivalService.js';
import { getProductionTreePlantationStore } from '../treePlantationSurvivalStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function parseUrlQuery(url) {
  const q = {};
  const idx = (url || '').indexOf('?');
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) q[decodeURIComponent(pair)] = '';
    else q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return q;
}

export async function defaultVerifyTreeActor(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 503, error: 'Authentication service is not configured.' };

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const claims = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(claims.sub);
    const role = resolveRole(user?.publicMetadata);
    const jurisdiction =
      typeof user?.publicMetadata?.jurisdiction === 'string' && user.publicMetadata.jurisdiction.trim()
        ? user.publicMetadata.jurisdiction.trim()
        : '*';
    return { ok: true, actorId: claims.sub, role, jurisdiction };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

function isJurisdictionAuthorized(operatorJurisdiction, targetJurisdiction) {
  if (!operatorJurisdiction || operatorJurisdiction === '*') return true;
  if (!targetJurisdiction || targetJurisdiction === 'UNSPECIFIED') return false;
  return operatorJurisdiction.toLowerCase() === String(targetJurisdiction).trim().toLowerCase();
}

export function createTreePlantationSurvivalHandler({
  verifyActor = defaultVerifyTreeActor,
  getStore = getProductionTreePlantationStore,
  rateLimiter = defaultRateLimiter,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = { ...parseUrlQuery(url), ...(req.query || {}) };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);

    const ipKey = clientKey(req);
    const rate = rateLimiter.take(ipKey);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({ error: 'Rate limit exceeded.', code: 'ERR_RATE_LIMIT' });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      return res.status(503).json({ error: 'Green asset store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: GREEN_ASSET_SCHEMA_VERSION,
        service: 'tree-plantation-survival',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'assets' && rest.length === 1) {
      const assets = await store.listAssets();
      const summary = aggregateGreenAssetSummary(assets, {
        wardId: query.wardId || 'all',
        batchId: query.batchId || 'all',
        species: query.species || 'all',
      });
      return res.status(200).json({ schemaVersion: GREEN_ASSET_SCHEMA_VERSION, summary });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: GREEN_ASSET_SCHEMA_VERSION, entries });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateGreenAssetZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'assets' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin steward role required to register assets.' });

      const targetJur = body.jurisdiction || 'IN-UP';
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot register asset for '${targetJur}'.`,
        });
      }

      const existingAssets = await store.listAssets();
      const reg = registerGreenAsset(existingAssets, body, auth.actorId);
      if (!reg.valid) {
        return res.status(reg.statusCode || 400).json({
          error: reg.errors[0],
          code: reg.statusCode === 409 ? 'ERR_DUPLICATE_GREEN_ASSET' : 'ERR_VALIDATION',
          details: reg.errors,
        });
      }

      await store.saveAsset(reg.asset);
      await store.appendAuditLog({
        action: 'REGISTER_GREEN_ASSET',
        actorId: auth.actorId,
        role,
        jurisdiction: targetJur,
        targetId: reg.asset.assetId,
        status: reg.asset.survivalStatus,
        summary: `Registered ${reg.asset.species} in batch ${reg.asset.batchId}`,
      });
      return res.status(201).json({ schemaVersion: GREEN_ASSET_SCHEMA_VERSION, asset: reg.asset });
    }

    if (method === 'POST' && rest[0] === 'assets' && rest.length === 3 && rest[2] === 'evidence') {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid assetId.' });
      const existing = await store.getAsset(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Green asset not found.' });

      try {
        const updated = appendGreenAssetEvidence(existing, body, auth.actorId);
        await store.saveAsset(updated);
        await store.appendAuditLog({
          action: 'ADD_GREEN_ASSET_EVIDENCE',
          actorId: auth.actorId,
          role,
          jurisdiction: existing.jurisdiction,
          targetId: existing.assetId,
          status: 'evidence_added',
          summary: `Appended citizen evidence to ${existing.assetId}`,
        });
        return res.status(201).json({ schemaVersion: GREEN_ASSET_SCHEMA_VERSION, asset: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'assets' && rest.length === 3 && rest[2] === 'verify') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required to verify survival.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid assetId.' });
      const existing = await store.getAsset(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Green asset not found.' });

      const targetJur = body.officialSource?.jurisdiction || existing.jurisdiction;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJur)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot verify asset for '${targetJur}'.`,
        });
      }

      try {
        const updated = verifyGreenAssetSurvival(existing, {
          actorId: auth.actorId,
          role,
          survivalStatus: body.survivalStatus,
          inspectionDate: body.inspectionDate,
          note: body.note,
          officialSource: body.officialSource || {},
        });
        await store.saveAsset(updated);
        await store.appendAuditLog({
          action: 'VERIFY_GREEN_ASSET_SURVIVAL',
          actorId: auth.actorId,
          role,
          jurisdiction: targetJur,
          targetId: updated.assetId,
          status: updated.survivalStatus,
          summary: `Verified ${updated.assetId} as ${updated.survivalStatus}`,
        });
        return res.status(200).json({ schemaVersion: GREEN_ASSET_SCHEMA_VERSION, asset: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Tree plantation survival endpoint not found.' });
  };
}

export default createTreePlantationSurvivalHandler();
