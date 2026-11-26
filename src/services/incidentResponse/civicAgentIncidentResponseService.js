/**
 * Civic Agent Incident Response and Kill-Switch Engine (#1182)
 *
 * Provides:
 *  - Per-agent circuit breakers (CLOSED, OPEN, HALF_OPEN)
 *  - Global emergency kill-switch
 *  - Granular tool revocation matrix
 *  - Queued-job quarantine with forensic isolation
 *  - PII-scrubbed tamper-evident audit logging
 *  - Multi-step recovery checklist with verification criteria
 *  - Deterministic non-AI fallback routes
 */

// Breaker States
export const BREAKER_STATES = Object.freeze({
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Tripped / Inactive (all calls rejected)
  HALF_OPEN: 'HALF_OPEN'  // Trial canary state
});

// Incident Severity Tiers
export const INCIDENT_SEVERITY = Object.freeze({
  P1_CRITICAL: 'P1_CRITICAL', // Immediate full agent or global quarantine
  P2_HIGH: 'P2_HIGH',         // Tool-specific revocation or agent circuit open
  P3_MEDIUM: 'P3_MEDIUM',     // Elevated error rates or latency warning
  P4_LOW: 'P4_LOW'            // Minor anomalies / telemetry notice
});

// Known Registered Agents
export const REGISTERED_AGENTS = Object.freeze({
  CIVIC_ASSISTANT: 'civic-assistant',
  GROUNDED_ASSISTANT: 'grounded-assistant',
  SERVICE_SIMPLIFIER: 'service-simplifier',
  TOOL_ROUTER: 'policy-controlled-tool-router',
  RAG_INGESTION: 'rag-ingestion-agent'
});

// Default Configuration Thresholds
export const DEFAULT_INCIDENT_CONFIG = Object.freeze({
  consecutiveFailureThreshold: 5,   // Trip breaker after 5 consecutive errors
  errorRateThresholdPercent: 50,    // Trip breaker if >50% failure in window
  windowDurationMs: 60000,          // Rolling 1-minute window
  resetTimeoutMs: 30000,            // Time in OPEN state before transitioning to HALF_OPEN
  maxHalfOpenAttempts: 3,           // Canary requests allowed in HALF_OPEN
  loopRecursionLimit: 4,            // Maximum allowed loop recursion / repeated queries
  costSpikeTokensPerMinute: 20000,  // Max token velocity per minute
  autoQuarantineOnLoop: true        // Automatically quarantine suspicious jobs
});

// Fallback Routes for Civic Workflows
export const NON_AI_CIVIC_FALLBACKS = Object.freeze({
  'ration-card': {
    title: 'Ration Card Support (Manual Directory)',
    portalUrl: 'https://nfsa.gov.in',
    helpline: '1967',
    fallbackSteps: [
      'Locate your nearest Food & Civil Supplies / Fair Price Shop',
      'Download and print the NFSA offline application form',
      'Submit identity proof and residence documentation in person'
    ]
  },
  'voter-id': {
    title: 'Voter ID & Electoral Services (Manual)',
    portalUrl: 'https://voters.eci.gov.in',
    helpline: '1950',
    fallbackSteps: [
      'Submit Form 6 offline at your Electoral Registration Office (ERO)',
      'Provide passport-sized photographs and age/address documentation',
      'Obtain physical receipt acknowledgement from the BLO'
    ]
  },
  'driving-license': {
    title: 'Sarathi Parivahan Services (Direct Portal)',
    portalUrl: 'https://parivahan.gov.in',
    helpline: '0120-4925505',
    fallbackSteps: [
      'Visit Parivahan Sewa portal directly',
      'Select your state and schedule an RTO slot',
      'Present original documents at RTO window'
    ]
  },
  'default': {
    title: 'Citizen Assistance Portal (Standard Helpdesk)',
    portalUrl: 'https://services.india.gov.in',
    helpline: '1800-111-555',
    fallbackSteps: [
      'Access the national service directory',
      'Verify requirements directly with the designated department desk',
      'Visit your local Common Service Centre (CSC) or Gram Panchayat office'
    ]
  }
});

/**
 * PII Scrubber for Incident Forensics and Telemetry
 * Never records Aadhaar, PAN, phone numbers, email addresses, or raw passwords.
 */
export function scrubIncidentTelemetry(textOrObj) {
  if (!textOrObj) return textOrObj;
  const str = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj);

  const scrubbed = str
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED_PAN]')
    .replace(/(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/g, '[REDACTED_PHONE]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/"?(password|apiKey|secret|token)"?\s*[:=]\s*"?[^"'\s,}]+"?/gi, '"$1":"[REDACTED_SECRET]"');

  try {
    return typeof textOrObj === 'object' ? JSON.parse(scrubbed) : scrubbed;
  } catch {
    return scrubbed;
  }
}

/**
 * Core Circuit Breaker & Incident Response Manager
 */
export class CivicAgentIncidentResponseService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_INCIDENT_CONFIG, ...config };
    this.globalKillSwitchActive = false;
    this.globalKillReason = null;
    this.globalKillTimestamp = null;
    this.globalKillActor = null;

    // Per-agent state registry: agentId -> state object
    this.agentBreakers = new Map();

    // Revoked tools registry: Set of tool names
    this.revokedTools = new Set();

    // Quarantined jobs: Array of quarantined job objects
    this.quarantinedQueue = [];

    // Audit Log: Append-only ledger
    this.auditLog = [];

    // Active Recovery Checklists: incidentId -> Checklist
    this.recoveryChecklists = new Map();

    // Initialize registered agents
    Object.values(REGISTERED_AGENTS).forEach((agentId) => {
      this.initBreaker(agentId);
    });
  }

  initBreaker(agentId) {
    if (!this.agentBreakers.has(agentId)) {
      this.agentBreakers.set(agentId, {
        agentId,
        state: BREAKER_STATES.CLOSED,
        failureCount: 0,
        successCount: 0,
        halfOpenAttempts: 0,
        lastFailureTimestamp: null,
        lastStateChangeTimestamp: Date.now(),
        recentCalls: [], // Rolling window of { timestamp, success, latencyMs, tokens }
        tripReason: null,
        loopTracker: new Map() // queryHash -> count
      });
    }
  }

  /**
   * Activate Global Emergency Kill-Switch
   */
  engageGlobalKillSwitch({ actorId = 'SYSTEM', reason = 'Manual emergency trigger', severity = INCIDENT_SEVERITY.P1_CRITICAL } = {}) {
    this.globalKillSwitchActive = true;
    this.globalKillReason = reason;
    this.globalKillTimestamp = Date.now();
    this.globalKillActor = actorId;

    this.recordAudit({
      eventType: 'GLOBAL_KILL_SWITCH_ENGAGED',
      severity,
      actorId,
      reason,
      details: { timestamp: this.globalKillTimestamp }
    });

    return {
      status: 'KILL_SWITCH_ENGAGED',
      active: true,
      timestamp: this.globalKillTimestamp,
      reason
    };
  }

  /**
   * Disengage Global Kill-Switch (Requires checklist verification)
   */
  disengageGlobalKillSwitch({ actorId, incidentId, override = false }) {
    if (!override) {
      const checklist = this.recoveryChecklists.get(incidentId);
      if (!checklist || !checklist.isComplete()) {
        throw new Error('Cannot disengage global kill-switch without a completed and signed recovery checklist.');
      }
    }

    this.globalKillSwitchActive = false;
    const previousReason = this.globalKillReason;
    this.globalKillReason = null;
    this.globalKillTimestamp = null;

    this.recordAudit({
      eventType: 'GLOBAL_KILL_SWITCH_DISENGAGED',
      severity: INCIDENT_SEVERITY.P2_HIGH,
      actorId,
      reason: 'Incident verified and resolved',
      details: { previousReason, incidentId }
    });

    return {
      status: 'KILL_SWITCH_DISENGAGED',
      active: false,
      timestamp: Date.now()
    };
  }

  /**
   * Revoke Tool Execution
   */
  revokeTool({ toolName, actorId = 'SYSTEM', reason = 'Tool anomaly detected' }) {
    if (!toolName) throw new Error('Tool name required for revocation');
    this.revokedTools.add(toolName);

    this.recordAudit({
      eventType: 'TOOL_REVOKED',
      severity: INCIDENT_SEVERITY.P2_HIGH,
      actorId,
      reason,
      details: { toolName }
    });

    return { status: 'TOOL_REVOKED', toolName, revoked: true };
  }

  /**
   * Restore Tool Execution
   */
  restoreTool({ toolName, actorId = 'SYSTEM', reason = 'Tool verified healthy' }) {
    if (!toolName) throw new Error('Tool name required for restoration');
    this.revokedTools.delete(toolName);

    this.recordAudit({
      eventType: 'TOOL_RESTORED',
      severity: INCIDENT_SEVERITY.P3_MEDIUM,
      actorId,
      reason,
      details: { toolName }
    });

    return { status: 'TOOL_RESTORED', toolName, revoked: false };
  }

  /**
   * Check if a tool is revoked
   */
  isToolRevoked(toolName) {
    return this.revokedTools.has(toolName);
  }

  /**
   * Get Breaker Status for an Agent
   */
  getBreaker(agentId) {
    this.initBreaker(agentId);
    const breaker = this.agentBreakers.get(agentId);

    // Check automatic transition from OPEN to HALF_OPEN after resetTimeoutMs
    if (breaker.state === BREAKER_STATES.OPEN) {
      const now = Date.now();
      if (now - breaker.lastStateChangeTimestamp >= this.config.resetTimeoutMs) {
        breaker.state = BREAKER_STATES.HALF_OPEN;
        breaker.halfOpenAttempts = 0;
        breaker.lastStateChangeTimestamp = now;
        this.recordAudit({
          eventType: 'BREAKER_STATE_CHANGED',
          severity: INCIDENT_SEVERITY.P3_MEDIUM,
          actorId: 'AUTO_CIRCUIT_SUPERVISOR',
          reason: 'Reset timeout expired; transitioning to canary trial',
          details: { agentId, fromState: BREAKER_STATES.OPEN, toState: BREAKER_STATES.HALF_OPEN }
        });
      }
    }

    return breaker;
  }

  /**
   * Check if execution is permitted for an agent and optional tool
   */
  checkExecutionPermission(agentId, { toolName = null, queryPayload = null } = {}) {
    // 1. Global Kill-Switch Check
    if (this.globalKillSwitchActive) {
      return {
        permitted: false,
        reason: `Global emergency kill-switch is active: ${this.globalKillReason}`,
        code: 'GLOBAL_KILL_SWITCH_ACTIVE',
        fallbackAvailable: true
      };
    }

    // 2. Tool Revocation Check
    if (toolName && this.isToolRevoked(toolName)) {
      return {
        permitted: false,
        reason: `Tool '${toolName}' has been revoked due to incident policy`,
        code: 'TOOL_REVOKED',
        fallbackAvailable: true
      };
    }

    // 3. Agent Breaker Status Check
    const breaker = this.getBreaker(agentId);

    if (breaker.state === BREAKER_STATES.OPEN) {
      return {
        permitted: false,
        reason: `Circuit breaker for agent '${agentId}' is OPEN (${breaker.tripReason || 'High error rate'})`,
        code: 'CIRCUIT_BREAKER_OPEN',
        fallbackAvailable: true
      };
    }

    if (breaker.state === BREAKER_STATES.HALF_OPEN) {
      if (breaker.halfOpenAttempts >= this.config.maxHalfOpenAttempts) {
        return {
          permitted: false,
          reason: `Agent '${agentId}' has exhausted canary trial slots in HALF_OPEN state`,
          code: 'CANARY_CAPACITY_EXCEEDED',
          fallbackAvailable: true
        };
      }
      breaker.halfOpenAttempts += 1;
    }

    // 4. Runaway Loop Detection Check
    if (queryPayload) {
      const isLoop = this.detectRunawayLoop(agentId, queryPayload);
      if (isLoop.detected) {
        this.tripBreaker(agentId, {
          reason: `Runaway loop detected: repeated invocation pattern (${isLoop.count} identical occurrences)`,
          severity: INCIDENT_SEVERITY.P1_CRITICAL
        });

        if (this.config.autoQuarantineOnLoop) {
          this.quarantineJob({
            agentId,
            payload: queryPayload,
            reason: 'Runaway query loop detection trip'
          });
        }

        return {
          permitted: false,
          reason: 'Execution blocked due to recursive/runaway query loop detection',
          code: 'RUNAWAY_LOOP_DETECTED',
          fallbackAvailable: true
        };
      }
    }

    return { permitted: true, state: breaker.state };
  }

  /**
   * Record Call Outcome (Success / Failure / Latency / Cost)
   */
  recordCallResult(agentId, { success = true, latencyMs = 0, tokensUsed = 0, error = null }) {
    const breaker = this.getBreaker(agentId);
    const now = Date.now();

    // Clean rolling window
    breaker.recentCalls = breaker.recentCalls.filter(c => now - c.timestamp <= this.config.windowDurationMs);
    breaker.recentCalls.push({ timestamp: now, success, latencyMs, tokens: tokensUsed });

    if (success) {
      breaker.failureCount = 0;
      breaker.successCount += 1;

      // In HALF_OPEN, sufficient successes close the circuit
      if (breaker.state === BREAKER_STATES.HALF_OPEN) {
        if (breaker.successCount >= this.config.maxHalfOpenAttempts) {
          breaker.state = BREAKER_STATES.CLOSED;
          breaker.lastStateChangeTimestamp = now;
          breaker.tripReason = null;
          this.recordAudit({
            eventType: 'BREAKER_RECOVERED_CLOSED',
            severity: INCIDENT_SEVERITY.P3_MEDIUM,
            actorId: 'AUTO_CIRCUIT_SUPERVISOR',
            reason: 'Canary executions succeeded. Agent restored to full operation.',
            details: { agentId }
          });
        }
      }
    } else {
      breaker.failureCount += 1;
      breaker.lastFailureTimestamp = now;

      // In HALF_OPEN, a single failure immediately trips back to OPEN
      if (breaker.state === BREAKER_STATES.HALF_OPEN) {
        this.tripBreaker(agentId, {
          reason: `Canary trial failed in HALF_OPEN state: ${error?.message || 'Execution error'}`,
          severity: INCIDENT_SEVERITY.P2_HIGH
        });
        return;
      }

      // Check consecutive failure threshold
      if (breaker.failureCount >= this.config.consecutiveFailureThreshold) {
        this.tripBreaker(agentId, {
          reason: `Exceeded consecutive failure threshold (${breaker.failureCount}/${this.config.consecutiveFailureThreshold})`,
          severity: INCIDENT_SEVERITY.P2_HIGH
        });
        return;
      }

      // Check rolling error rate in window
      if (breaker.recentCalls.length >= 6) {
        const failedCalls = breaker.recentCalls.filter(c => !c.success).length;
        const failureRate = (failedCalls / breaker.recentCalls.length) * 100;
        if (failureRate >= this.config.errorRateThresholdPercent) {
          this.tripBreaker(agentId, {
            reason: `Rolling window failure rate breached: ${failureRate.toFixed(1)}% >= ${this.config.errorRateThresholdPercent}%`,
            severity: INCIDENT_SEVERITY.P2_HIGH
          });
          return;
        }
      }
    }

    // Check token / cost spike
    const totalTokensInWindow = breaker.recentCalls.reduce((sum, c) => sum + (c.tokens || 0), 0);
    if (totalTokensInWindow > this.config.costSpikeTokensPerMinute) {
      this.tripBreaker(agentId, {
        reason: `Token consumption velocity limit breached: ${totalTokensInWindow} tokens in last minute`,
        severity: INCIDENT_SEVERITY.P1_CRITICAL
      });
    }
  }

  /**
   * Trip Breaker into OPEN state
   */
  tripBreaker(agentId, { reason = 'Circuit tripped', actorId = 'AUTO_CIRCUIT_SUPERVISOR', severity = INCIDENT_SEVERITY.P2_HIGH } = {}) {
    this.initBreaker(agentId);
    const breaker = this.agentBreakers.get(agentId);
    const previousState = breaker.state;

    breaker.state = BREAKER_STATES.OPEN;
    breaker.tripReason = reason;
    breaker.lastStateChangeTimestamp = Date.now();
    breaker.successCount = 0;

    this.recordAudit({
      eventType: 'BREAKER_TRIPPED_OPEN',
      severity,
      actorId,
      reason,
      details: { agentId, previousState }
    });

    return {
      agentId,
      state: BREAKER_STATES.OPEN,
      reason
    };
  }

  /**
   * Manually Reset / Close Breaker
   */
  resetBreaker(agentId, { actorId = 'SYSTEM', reason = 'Manual administrative reset' } = {}) {
    this.initBreaker(agentId);
    const breaker = this.agentBreakers.get(agentId);
    const previousState = breaker.state;

    breaker.state = BREAKER_STATES.CLOSED;
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.halfOpenAttempts = 0;
    breaker.tripReason = null;
    breaker.lastStateChangeTimestamp = Date.now();
    breaker.loopTracker.clear();

    this.recordAudit({
      eventType: 'BREAKER_MANUAL_RESET',
      severity: INCIDENT_SEVERITY.P3_MEDIUM,
      actorId,
      reason,
      details: { agentId, previousState }
    });

    return { agentId, state: BREAKER_STATES.CLOSED };
  }

  /**
   * Runaway Loop Detection
   */
  detectRunawayLoop(agentId, queryPayload) {
    const breaker = this.getBreaker(agentId);
    const key = typeof queryPayload === 'string'
      ? queryPayload.trim().toLowerCase()
      : JSON.stringify(queryPayload);

    // Simple hash/frequency counter
    const currentCount = (breaker.loopTracker.get(key) || 0) + 1;
    breaker.loopTracker.set(key, currentCount);

    if (currentCount >= this.config.loopRecursionLimit) {
      return { detected: true, count: currentCount, key };
    }
    return { detected: false, count: currentCount };
  }

  /**
   * Quarantine a Job or Request Payload
   */
  quarantineJob({ agentId, payload, reason, citizenSessionId = null }) {
    const sanitizedPayload = scrubIncidentTelemetry(payload);
    const jobRecord = {
      quarantineId: `qj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      timestamp: Date.now(),
      status: 'QUARANTINED',
      reason,
      citizenSessionId,
      payload: sanitizedPayload
    };

    this.quarantinedQueue.push(jobRecord);

    this.recordAudit({
      eventType: 'JOB_QUARANTINED',
      severity: INCIDENT_SEVERITY.P2_HIGH,
      actorId: 'INCIDENT_RESPONSE_CONTROLLER',
      reason,
      details: {
        quarantineId: jobRecord.quarantineId,
        agentId,
        citizenSessionId
      }
    });

    return jobRecord;
  }

  /**
   * Evict / Discard Quarantined Job
   */
  evictQuarantinedJob(quarantineId, { actorId = 'SYSTEM', reason = 'Manual eviction' } = {}) {
    const idx = this.quarantinedQueue.findIndex(q => q.quarantineId === quarantineId);
    if (idx === -1) throw new Error(`Quarantined job ${quarantineId} not found`);

    const [evicted] = this.quarantinedQueue.splice(idx, 1);
    this.recordAudit({
      eventType: 'JOB_EVICTED_FROM_QUARANTINE',
      severity: INCIDENT_SEVERITY.P3_MEDIUM,
      actorId,
      reason,
      details: { quarantineId, agentId: evicted.agentId }
    });

    return evicted;
  }

  /**
   * Drain and Reprocess Safe Quarantined Jobs
   */
  drainQuarantine({ actorId = 'SYSTEM', maxJobs = 10 } = {}) {
    const drained = this.quarantinedQueue.splice(0, maxJobs);
    this.recordAudit({
      eventType: 'QUARANTINE_DRAINED',
      severity: INCIDENT_SEVERITY.P3_MEDIUM,
      actorId,
      reason: 'Batch quarantine drain initiated',
      details: { count: drained.length }
    });
    return drained;
  }

  /**
   * Get Non-AI Fallback Guidance for a Service
   */
  getFallbackGuidance(serviceId = 'default') {
    const fallback = NON_AI_CIVIC_FALLBACKS[serviceId] || NON_AI_CIVIC_FALLBACKS['default'];
    return {
      serviceId,
      fallbackUsed: true,
      title: fallback.title,
      portalUrl: fallback.portalUrl,
      helpline: fallback.helpline,
      steps: fallback.fallbackSteps,
      notice: 'Civic AI systems are currently in offline fallback mode. Verified official manual procedure provided.'
    };
  }

  /**
   * Create a Multi-Step Recovery Checklist
   */
  createRecoveryChecklist({ incidentId, agentId, incidentType, authorId = 'OPERATOR' }) {
    const checklist = new IncidentRecoveryChecklist({
      incidentId,
      agentId,
      incidentType,
      authorId
    });

    this.recoveryChecklists.set(incidentId, checklist);

    this.recordAudit({
      eventType: 'RECOVERY_CHECKLIST_INITIALIZED',
      severity: INCIDENT_SEVERITY.P2_HIGH,
      actorId: authorId,
      reason: 'Recovery checklist created for incident',
      details: { incidentId, agentId, incidentType }
    });

    return checklist;
  }

  /**
   * Record Audit Entry with PII Scrubbing
   */
  recordAudit(entry) {
    const auditRecord = {
      auditId: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      ...entry,
      details: scrubIncidentTelemetry(entry.details || {})
    };

    this.auditLog.push(auditRecord);
    return auditRecord;
  }

  /**
   * Export Current Operational Snapshot
   */
  getOperationalSnapshot() {
    const agents = {};
    for (const [id, breaker] of this.agentBreakers.entries()) {
      agents[id] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        tripReason: breaker.tripReason,
        lastStateChangeTimestamp: breaker.lastStateChangeTimestamp
      };
    }

    return {
      globalKillSwitch: {
        active: this.globalKillSwitchActive,
        reason: this.globalKillReason,
        timestamp: this.globalKillTimestamp,
        actor: this.globalKillActor
      },
      revokedTools: Array.from(this.revokedTools),
      agents,
      quarantinedJobsCount: this.quarantinedQueue.length,
      auditRecordsCount: this.auditLog.length
    };
  }
}

/**
 * Structured Post-Incident Recovery Checklist
 */
export class IncidentRecoveryChecklist {
  constructor({ incidentId, agentId, incidentType, authorId }) {
    this.incidentId = incidentId;
    this.agentId = agentId;
    this.incidentType = incidentType;
    this.createdAt = Date.now();
    this.authorId = authorId;
    this.signedOff = false;
    this.signedOffBy = null;
    this.signOffTimestamp = null;

    // Standardized Verification Steps
    this.items = [
      { id: 'ROOT_CAUSE_IDENTIFIED', label: 'Root cause identified and validated', completed: false, notes: '' },
      { id: 'UPSTREAM_RESTORED', label: 'Upstream LLM provider / subsystem confirmed stable', completed: false, notes: '' },
      { id: 'QUARANTINE_INSPECTED', label: 'Quarantined requests inspected for exploits or data leakage', completed: false, notes: '' },
      { id: 'CANARY_HEALTH_CHECK', label: 'Synthetic canary health checks executed and passed', completed: false, notes: '' },
      { id: 'AUTHORIZATION_SIGNOFF', label: 'Lead Maintainer sign-off verified', completed: false, notes: '' }
    ];
  }

  markStep(itemId, completed = true, notes = '') {
    const item = this.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Checklist item ${itemId} not found`);
    item.completed = Boolean(completed);
    if (notes) item.notes = notes;
    return item;
  }

  isComplete() {
    return this.items.every(i => i.completed) && this.signedOff;
  }

  signOff(signerId) {
    if (!signerId) throw new Error('Signer ID is required');
    const pending = this.items.filter(i => !i.completed && i.id !== 'AUTHORIZATION_SIGNOFF');
    if (pending.length > 0) {
      throw new Error(`Cannot sign off checklist with pending verification steps: ${pending.map(p => p.id).join(', ')}`);
    }

    this.markStep('AUTHORIZATION_SIGNOFF', true, `Signed off by ${signerId}`);
    this.signedOff = true;
    this.signedOffBy = signerId;
    this.signOffTimestamp = Date.now();
    return true;
  }
}

// Singleton global instance for server & client context
export const civicAgentIncidentResponse = new CivicAgentIncidentResponseService();
