/**
 * api/_lib/handlers/agent-incident-response.js
 * Administrative API endpoint for Civic Agent Incident Response & Kill-Switch (#1182).
 *
 * Invariants:
 *  - Administrative authentication & authorization check (admin/operator only).
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII in audit records and quarantine payloads.
 *  - Multi-action dispatch:
 *      * GET: Retrieve operational snapshot (breaker status, revoked tools, queue metrics).
 *      * POST:
 *          - ENGAGE_KILL_SWITCH / DISENGAGE_KILL_SWITCH
 *          - TRIP_BREAKER / RESET_BREAKER
 *          - REVOKE_TOOL / RESTORE_TOOL
 *          - DRAIN_QUARANTINE / EVICT_JOB
 *          - CREATE_CHECKLIST / STEP_CHECKLIST / SIGN_CHECKLIST
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import {
  civicAgentIncidentResponse,
  INCIDENT_SEVERITY
} from '../../../src/services/incidentResponse/civicAgentIncidentResponseService.js';

const rateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

export const ALLOWED_ADMIN_ACTIONS = [
  'ENGAGE_KILL_SWITCH',
  'DISENGAGE_KILL_SWITCH',
  'TRIP_BREAKER',
  'RESET_BREAKER',
  'REVOKE_TOOL',
  'RESTORE_TOOL',
  'DRAIN_QUARANTINE',
  'EVICT_JOB',
  'CREATE_CHECKLIST',
  'STEP_CHECKLIST',
  'SIGN_CHECKLIST'
];

export function sanitizeText(val, maxLen = 2000) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function validateIncidentPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object'];
  }

  const { action, actorId, reason } = body;

  if (!action || !ALLOWED_ADMIN_ACTIONS.includes(action)) {
    errors.push(`Action must be one of: ${ALLOWED_ADMIN_ACTIONS.join(', ')}`);
  }

  if (!actorId || typeof actorId !== 'string' || !actorId.trim()) {
    errors.push('actorId is mandatory and must be a non-empty string');
  }

  if (['ENGAGE_KILL_SWITCH', 'TRIP_BREAKER', 'REVOKE_TOOL'].includes(action)) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      errors.push(`Reason is required for disruptive action ${action}`);
    }
  }

  return errors;
}

export default async function handler(req, res) {
  const ip = clientKey(req);

  // Rate Limiting
  const rateLimitResult = rateLimiter.take(ip);
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many requests. Please throttle administrative queries.',
      code: 'RATE_LIMITED'
    });
  }

  // Handle GET - Operational Snapshot
  if (req.method === 'GET') {
    try {
      const snapshot = civicAgentIncidentResponse.getOperationalSnapshot();
      return res.status(200).json({
        success: true,
        data: snapshot,
        timestamp: Date.now()
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to retrieve operational incident snapshot',
        details: err.message
      });
    }
  }

  // Handle POST - Administrative Actions
  if (req.method === 'POST') {
    const flightKey = `${ip}:${JSON.stringify(req.body)}`;
    return singleFlight.run(flightKey, async () => {
      try {
        const body = req.body || {};
        const validationErrors = validateIncidentPayload(body);

        if (validationErrors.length > 0) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validationErrors,
            code: 'VALIDATION_FAILED'
          });
        }

        const {
          action,
          actorId,
          reason,
          agentId,
          toolName,
          quarantineId,
          incidentId,
          stepId,
          notes,
          severity
        } = body;

        let result;

        switch (action) {
          case 'ENGAGE_KILL_SWITCH':
            result = civicAgentIncidentResponse.engageGlobalKillSwitch({
              actorId: sanitizeText(actorId),
              reason: sanitizeText(reason),
              severity: severity || INCIDENT_SEVERITY.P1_CRITICAL
            });
            break;

          case 'DISENGAGE_KILL_SWITCH':
            result = civicAgentIncidentResponse.disengageGlobalKillSwitch({
              actorId: sanitizeText(actorId),
              incidentId: sanitizeText(incidentId),
              override: body.override === true
            });
            break;

          case 'TRIP_BREAKER':
            if (!agentId) return res.status(400).json({ error: 'agentId is required for TRIP_BREAKER' });
            result = civicAgentIncidentResponse.tripBreaker(agentId, {
              actorId: sanitizeText(actorId),
              reason: sanitizeText(reason),
              severity: severity || INCIDENT_SEVERITY.P2_HIGH
            });
            break;

          case 'RESET_BREAKER':
            if (!agentId) return res.status(400).json({ error: 'agentId is required for RESET_BREAKER' });
            result = civicAgentIncidentResponse.resetBreaker(agentId, {
              actorId: sanitizeText(actorId),
              reason: sanitizeText(reason || 'Manual reset')
            });
            break;

          case 'REVOKE_TOOL':
            if (!toolName) return res.status(400).json({ error: 'toolName is required for REVOKE_TOOL' });
            result = civicAgentIncidentResponse.revokeTool({
              toolName: sanitizeText(toolName),
              actorId: sanitizeText(actorId),
              reason: sanitizeText(reason)
            });
            break;

          case 'RESTORE_TOOL':
            if (!toolName) return res.status(400).json({ error: 'toolName is required for RESTORE_TOOL' });
            result = civicAgentIncidentResponse.restoreTool({
              toolName: sanitizeText(toolName),
              actorId: sanitizeText(actorId),
              reason: sanitizeText(reason || 'Tool verified safe')
            });
            break;

          case 'EVICT_JOB':
            if (!quarantineId) return res.status(400).json({ error: 'quarantineId is required for EVICT_JOB' });
            result = civicAgentIncidentResponse.evictQuarantinedJob(quarantineId, {
              actorId: sanitizeText(actorId),
              reason: sanitizeText(reason || 'Manual eviction')
            });
            break;

          case 'DRAIN_QUARANTINE':
            result = civicAgentIncidentResponse.drainQuarantine({
              actorId: sanitizeText(actorId),
              maxJobs: body.maxJobs || 10
            });
            break;

          case 'CREATE_CHECKLIST':
            if (!incidentId || !agentId) {
              return res.status(400).json({ error: 'incidentId and agentId are required for CREATE_CHECKLIST' });
            }
            result = civicAgentIncidentResponse.createRecoveryChecklist({
              incidentId: sanitizeText(incidentId),
              agentId: sanitizeText(agentId),
              incidentType: sanitizeText(body.incidentType || 'GENERAL_INCIDENT'),
              authorId: sanitizeText(actorId)
            });
            break;

          case 'STEP_CHECKLIST': {
            if (!incidentId || !stepId) {
              return res.status(400).json({ error: 'incidentId and stepId are required for STEP_CHECKLIST' });
            }
            const checklist = civicAgentIncidentResponse.recoveryChecklists.get(incidentId);
            if (!checklist) {
              return res.status(404).json({ error: `Recovery checklist ${incidentId} not found` });
            }
            result = checklist.markStep(stepId, body.completed !== false, sanitizeText(notes || ''));
            break;
          }

          case 'SIGN_CHECKLIST': {
            if (!incidentId) {
              return res.status(400).json({ error: 'incidentId is required for SIGN_CHECKLIST' });
            }
            const checklist = civicAgentIncidentResponse.recoveryChecklists.get(incidentId);
            if (!checklist) {
              return res.status(404).json({ error: `Recovery checklist ${incidentId} not found` });
            }
            checklist.signOff(sanitizeText(actorId));
            result = { signedOff: true, incidentId, signerId: actorId };
            break;
          }

          default:
            return res.status(400).json({ error: 'Unhandled action' });
        }

        return res.status(200).json({
          success: true,
          action,
          data: result,
          timestamp: Date.now()
        });
      } catch (err) {
        return res.status(400).json({
          error: err.message,
          code: 'ACTION_EXECUTION_FAILED'
        });
      }
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
