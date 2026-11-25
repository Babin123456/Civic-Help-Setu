/* global process */
/**
 * api/_lib/handlers/multi-region-status.js
 *
 * Operational endpoint exposing real-time replica health, replication lag,
 * routing metrics, and failover control for Multi-Region Read Architecture (#1233).
 */

import {
  getMultiRegionInstance,
  getMultiRegionHealth,
  getMultiRegionMetrics,
} from '../multiRegionReadIntegration.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';

const json = (res, status, body, headers = {}) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  return res.status(status).json(body);
};

const resolveAdminRole = async (req) => {
  // Check development / test header override first
  const headerRole = req.headers?.['x-user-role'];
  if (headerRole === 'admin') {
    return { ok: true, role: 'admin', userId: req.headers?.['x-user-id'] || 'test-admin' };
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (secretKey) {
    const sessionToken = bearerToken(req.headers || {});
    if (!sessionToken) {
      return { ok: false, error: 'Authorization token required' };
    }
    try {
      const { verifyToken, createClerkClient } = await import('@clerk/backend');
      const clerk = createClerkClient({ secretKey });
      const claims = await verifyToken(sessionToken, { secretKey });
      const user = await clerk.users.getUser(claims.sub);
      const role = resolveRole(user.publicMetadata);
      if (role !== 'admin') {
        return { ok: false, error: 'Admin role required' };
      }
      return { ok: true, role: 'admin', userId: claims.sub };
    } catch (err) {
      return { ok: false, error: `Authentication failed: ${err.message}` };
    }
  }

  // If no auth secret configured and not explicitly forbidden, allow read or check role
  return { ok: true, role: 'operator', userId: 'local-operator' };
};

export default async function route(req, res) {
  const method = req.method || 'GET';
  const url = req.url || '';
  const isMetrics = url.includes('metrics') || req.query?.metrics === 'true';

  try {
    const instance = await getMultiRegionInstance();

    if (method === 'GET') {
      if (isMetrics) {
        const metrics = await getMultiRegionMetrics();
        return json(res, 200, {
          success: true,
          timestamp: new Date().toISOString(),
          metrics,
        });
      }

      const health = await getMultiRegionHealth();
      return json(res, 200, {
        success: true,
        timestamp: new Date().toISOString(),
        health,
      });
    }

    if (method === 'POST') {
      const auth = await resolveAdminRole(req);
      if (!auth.ok) {
        return json(res, 403, { success: false, error: auth.error });
      }

      const body = req.body || {};
      const { action, regionId, reason = 'Operator action', percent } = body;

      switch (action) {
        case 'manual_failover': {
          if (!regionId) {
            return json(res, 400, { success: false, error: 'regionId is required for manual_failover' });
          }
          instance.manualFailover(regionId, reason);
          return json(res, 200, {
            success: true,
            action,
            regionId,
            message: `Initiated failover for region ${regionId}`,
          });
        }

        case 'manual_recovery': {
          if (!regionId) {
            return json(res, 400, { success: false, error: 'regionId is required for manual_recovery' });
          }
          instance.manualRecovery(regionId);
          return json(res, 200, {
            success: true,
            action,
            regionId,
            message: `Initiated recovery for region ${regionId}`,
          });
        }

        case 'set_rollout': {
          const pct = typeof percent === 'number' ? percent : parseInt(percent, 10);
          if (isNaN(pct) || pct < 0 || pct > 100) {
            return json(res, 400, { success: false, error: 'percent must be a number between 0 and 100' });
          }
          instance.setRolloutPercent(pct);
          return json(res, 200, {
            success: true,
            action,
            percent: pct,
            message: `Rollout set to ${pct}%`,
          });
        }

        case 'disable': {
          instance.disableMultiRegionReads(reason);
          return json(res, 200, {
            success: true,
            action,
            message: `Multi-region reads disabled. All traffic routed to primary.`,
          });
        }

        case 'enable': {
          instance.enableMultiRegionReads();
          return json(res, 200, {
            success: true,
            action,
            message: `Multi-region reads enabled.`,
          });
        }

        default:
          return json(res, 400, {
            success: false,
            error: `Unsupported action: ${action}. Valid actions: manual_failover, manual_recovery, set_rollout, disable, enable`,
          });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { success: false, error: `Method ${method} not allowed` });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message });
  }
}
