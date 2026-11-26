/**
 * api/_lib/handlers/mesh-readiness.js
 *
 * Internal readiness, keyring management, and zero-PII telemetry inspection
 * endpoint for the Internal Service Mesh Readiness Layer (#1276).
 *
 * Never exposes private keys or citizen PII.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { KEY_STATUS } from '../mesh/serviceIdentity.js';

const defaultLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

function hasScope(meshContext, requiredScope) {
  if (!meshContext || meshContext.mode !== 'enforced') return true;
  const scopes = meshContext.servicePrincipal?.scopes || [];
  return scopes.includes('*') || scopes.includes('internal:*') || scopes.includes(requiredScope);
}

function hasAuthenticatedAdmin(meshContext) {
  const principal = meshContext?.servicePrincipal;
  if (!principal) return false;
  const scopes = principal.scopes || [];
  return scopes.includes('*') || scopes.includes('internal:*') || scopes.includes('internal:admin');
}

/**
 * Factory for the `/api/mesh-readiness` handler.
 */
export function createMeshReadinessHandler({ meshLayer, rateLimiter = defaultLimiter } = {}) {
  return async function meshReadinessHandler(req) {
    const ip = clientKey(req?.headers || {}) || 'internal';
    const verdict = rateLimiter.take(ip);
    if (!verdict.allowed) {
      return json(
        429,
        { error: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds },
        { 'Retry-After': String(verdict.retryAfterSeconds) }
      );
    }

    if (!meshLayer) {
      return json(503, { error: 'mesh_layer_not_initialized' });
    }

    const method = String(req?.method || 'GET').toUpperCase();
    const query = req?.query || {};
    const meshContext = req?.meshContext || null;

    if (method === 'GET') {
      if (!hasScope(meshContext, 'internal:read')) {
        return json(403, { error: 'forbidden', code: 'MESH_INSUFFICIENT_SCOPE' });
      }
      const action = query.action || 'status';

      if (action === 'status') {
        return json(200, {
          ok: true,
          ...meshLayer.getReadinessSnapshot(),
          callerService: meshContext?.servicePrincipal?.serviceId || null,
          correlationId: meshContext?.trace?.correlationId || null,
        });
      }

      if (action === 'keys') {
        return json(200, {
          ok: true,
          serviceId: meshLayer.config.serviceId,
          keys: meshLayer.keyring.listKeys({
            serviceId: typeof query.serviceId === 'string' ? query.serviceId : undefined,
            includePublicKey: false,
          }),
        });
      }

      if (action === 'telemetry') {
        const limit = Number(query.limit) || 25;
        return json(200, {
          ok: true,
          counters: meshLayer.telemetry.getCounters(),
          spans: meshLayer.telemetry.getSpans(limit),
        });
      }

      return json(400, { error: 'unknown_action', message: `Unsupported GET action "${action}".` });
    }

    if (method === 'POST') {
      // Keyring mutations always fail closed unless an authenticated service principal holds internal:admin.
      if (!meshContext?.servicePrincipal) {
        return json(401, { error: 'service_auth_required', code: 'MESH_SERVICE_ASSERTION_MISSING' });
      }
      if (!hasAuthenticatedAdmin(meshContext)) {
        return json(403, { error: 'forbidden', code: 'MESH_INSUFFICIENT_SCOPE' });
      }

      const body = req?.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json(400, { error: 'invalid_body', message: 'Request body must be a JSON object.' });
      }

      const action = body.action;
      if (action === 'rotate-key') {
        const {
          kid,
          serviceId,
          publicKeyPem,
          certificatePem,
          spiffeId,
          notBefore,
          notAfter,
          allowedAudiences,
          allowedScopes,
        } = body;
        if (!kid || !serviceId || (!publicKeyPem && !certificatePem)) {
          return json(400, {
            error: 'validation_failed',
            message: 'kid, serviceId, and publicKeyPem or certificatePem are required.',
          });
        }
        let registered;
        try {
          registered = meshLayer.keyring.rotateKey({
            kid: String(kid),
            serviceId: String(serviceId),
            spiffeId: spiffeId ? String(spiffeId) : undefined,
            publicKeyPem: publicKeyPem ? String(publicKeyPem) : undefined,
            certificatePem: certificatePem ? String(certificatePem) : undefined,
            notBefore: typeof notBefore === 'number' ? notBefore : undefined,
            notAfter: typeof notAfter === 'number' ? notAfter : undefined,
            allowedAudiences,
            allowedScopes,
          });
        } catch {
          return json(400, {
            error: 'invalid_key_or_certificate',
            message: 'Provided publicKeyPem or certificatePem could not be parsed.',
          });
        }
        return json(200, {
          ok: true,
          action: 'rotate-key',
          key: {
            kid: registered.kid,
            serviceId: registered.serviceId,
            status: registered.status,
            fingerprint: registered.fingerprint,
          },
        });
      }

      if (action === 'revoke-key') {
        const { kid, reason } = body;
        if (!kid || typeof kid !== 'string') {
          return json(400, { error: 'validation_failed', message: 'kid is required.' });
        }
        const revoked = meshLayer.keyring.revokeKey(kid, typeof reason === 'string' ? reason : 'api_revocation');
        if (!revoked) {
          return json(404, { error: 'key_not_found', message: `No key found for kid "${kid}".` });
        }
        return json(200, { ok: true, action: 'revoke-key', kid, status: KEY_STATUS.REVOKED });
      }

      if (action === 'prune-expired') {
        const pruned = meshLayer.keyring.pruneExpired();
        return json(200, { ok: true, action: 'prune-expired', ...pruned });
      }

      return json(400, { error: 'unknown_action', message: `Unsupported POST action "${action}".` });
    }

    return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
  };
}

export default createMeshReadinessHandler;
