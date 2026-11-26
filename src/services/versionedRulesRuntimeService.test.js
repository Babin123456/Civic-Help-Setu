import { describe, it, expect, beforeEach } from 'vitest';
import {
  VersionedRulesRuntimeService,
  RuleRuntimeError
} from './versionedRulesRuntimeService.js';

describe('VersionedRulesRuntimeService', () => {
  let service;

  beforeEach(() => {
    service = new VersionedRulesRuntimeService();
  });

  it('executes a versioned rule deterministically and emits input/output hashes', () => {
    const execution = service.executeRule('rule_senior_citizen_concession', '1.0.0', {
      age: 65,
      isStateResident: true
    });

    expect(execution.ruleId).toBe('rule_senior_citizen_concession');
    expect(execution.version).toBe('1.0.0');
    expect(execution.resultSnapshot.isEligible).toBe(true);
    expect(execution.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(execution.outputHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('replays a historical trace and guarantees identical output hash (zero side-effects)', () => {
    const execution = service.executeRule('rule_senior_citizen_concession', '1.0.0', {
      age: 55,
      isStateResident: true
    });

    const replay = service.replayTrace(execution.traceId);
    expect(replay.isDeterministic).toBe(true);
    expect(replay.replayedOutputHash).toBe(execution.outputHash);
  });

  it('allows side-by-side comparison between rule versions', () => {
    // 59-year-old female resident: ineligible in v1.0.0 (requires 60), eligible in v2.0.0 (requires 58)
    const comparison = service.compareRuleVersions(
      'rule_senior_citizen_concession',
      '1.0.0',
      '2.0.0',
      { age: 59, gender: 'female', isStateResident: true }
    );

    expect(comparison.resultA.isEligible).toBe(false);
    expect(comparison.resultB.isEligible).toBe(true);
    expect(comparison.isOutputIdentical).toBe(false);
  });
});
