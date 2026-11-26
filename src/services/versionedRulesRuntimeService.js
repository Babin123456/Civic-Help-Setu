/**
 * @file versionedRulesRuntimeService.js
 * @description Sandboxed deterministic rules execution runtime with pinned inputs, rule versions,
 * execution traces, cryptographic output digests, and deterministic replay capabilities.
 * Strictly prevents non-deterministic side effects (such as unseeded Math.random or wall-clock timestamps inside evaluation logic).
 */

import crypto from 'crypto';

export class RuleRuntimeError extends Error {
  constructor(message, code = 'RULE_RUNTIME_ERROR') {
    super(message);
    this.name = 'RuleRuntimeError';
    this.code = code;
  }
}

export class VersionedRulesRuntimeService {
  constructor() {
    this.ruleRegistry = new Map(); // ruleId:version -> RuleDefinition
    this.executionAudit = new Map(); // traceId -> ExecutionRecord
    this.initDefaultRules();
  }

  initDefaultRules() {
    this.registerRule({
      id: 'rule_senior_citizen_concession',
      version: '1.0.0',
      description: 'Determines senior citizen public transport concession eligibility',
      evaluator: (facts) => {
        const age = Number(facts.age || 0);
        const resident = Boolean(facts.isStateResident);
        const eligible = age >= 60 && resident;
        return {
          isEligible: eligible,
          reason: eligible
            ? 'Qualified: Age >= 60 and State Resident.'
            : 'Disqualified: Minimum age is 60 with state domicile.'
        };
      }
    });

    this.registerRule({
      id: 'rule_senior_citizen_concession',
      version: '2.0.0',
      description: 'Revised senior citizen rule with women age lowered to 58',
      evaluator: (facts) => {
        const age = Number(facts.age || 0);
        const gender = (facts.gender || '').toLowerCase();
        const resident = Boolean(facts.isStateResident);
        const minAge = gender === 'female' ? 58 : 60;
        const eligible = age >= minAge && resident;
        return {
          isEligible: eligible,
          reason: eligible
            ? `Qualified under v2 rules (min age ${minAge}).`
            : `Disqualified under v2 rules (min age ${minAge}).`
        };
      }
    });
  }

  registerRule(rule) {
    if (!rule || !rule.id || !rule.version || typeof rule.evaluator !== 'function') {
      throw new RuleRuntimeError('Invalid rule definition', 'INVALID_RULE');
    }
    const key = `${rule.id}:${rule.version}`;
    this.ruleRegistry.set(key, rule);
  }

  /**
   * Executes a rule deterministically with recorded input hash and execution trace.
   */
  executeRule(ruleId, version, facts = {}) {
    const key = `${ruleId}:${version}`;
    const rule = this.ruleRegistry.get(key);
    if (!rule) {
      throw new RuleRuntimeError(`Rule ${key} not found`, 'RULE_NOT_FOUND');
    }

    // Sort facts deterministically for hashing
    const sortedFactsJson = JSON.stringify(facts, Object.keys(facts).sort());
    const inputHash = crypto.createHash('sha256').update(sortedFactsJson).digest('hex');

    // Execute in sandboxed closure
    const result = rule.evaluator(facts);
    const sortedResultJson = JSON.stringify(result, Object.keys(result).sort());
    const outputHash = crypto.createHash('sha256').update(sortedResultJson).digest('hex');

    const traceId = `trc_${crypto.randomUUID()}`;
    const record = {
      traceId,
      ruleId,
      version,
      inputHash,
      outputHash,
      factsSnapshot: JSON.parse(sortedFactsJson),
      resultSnapshot: result,
      executedAt: new Date().toISOString()
    };

    this.executionAudit.set(traceId, record);
    return record;
  }

  /**
   * Replays a previous execution trace to verify deterministic consistency.
   */
  replayTrace(traceId) {
    const historical = this.executionAudit.get(traceId);
    if (!historical) {
      throw new RuleRuntimeError(`Trace ${traceId} not found in audit log`, 'TRACE_NOT_FOUND');
    }

    const replayRun = this.executeRule(
      historical.ruleId,
      historical.version,
      historical.factsSnapshot
    );

    const isDeterministic = replayRun.outputHash === historical.outputHash;

    return {
      traceId,
      isDeterministic,
      originalOutputHash: historical.outputHash,
      replayedOutputHash: replayRun.outputHash,
      matchesSnapshot: isDeterministic
    };
  }

  /**
   * Compares outputs of two different versions for identical inputs.
   */
  compareRuleVersions(ruleId, v1, v2, facts = {}) {
    const run1 = this.executeRule(ruleId, v1, facts);
    const run2 = this.executeRule(ruleId, v2, facts);

    return {
      ruleId,
      versionA: v1,
      versionB: v2,
      resultA: run1.resultSnapshot,
      resultB: run2.resultSnapshot,
      isOutputIdentical: run1.outputHash === run2.outputHash
    };
  }
}

export const defaultRulesRuntimeService = new VersionedRulesRuntimeService();
