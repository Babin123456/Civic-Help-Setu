import { describe, it, expect } from 'vitest';
import {
  RULE_STATUS,
  JURISDICTION_LEVELS,
  validateRuleTemporalRange,
  resolveRuleStatus,
  extractTemporalIntent,
  filterVersionedCivicRules,
} from './temporalJurisdictionRetrievalService';

const MOCK_VERSIONED_RULES = [
  {
    id: 'pan-rule-v1',
    title: 'PAN Card Linking Deadline 2021',
    status: 'published',
    jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
    effectiveFrom: '2021-01-01T00:00:00Z',
    effectiveTo: '2022-03-31T23:59:59Z',
    supersededBy: 'pan-rule-v2',
  },
  {
    id: 'pan-rule-v2',
    title: 'PAN-Aadhaar Mandatory Linking and Late Fee',
    status: 'published',
    jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
    effectiveFrom: '2022-04-01T00:00:00Z',
    effectiveTo: null,
    supersedes: 'pan-rule-v1',
  },
  {
    id: 'ration-mh',
    title: 'Ration Card Allotment Maharashtra',
    status: 'published',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-MH',
    jurisdictionName: 'Maharashtra',
    effectiveFrom: '2023-01-01T00:00:00Z',
    effectiveTo: null,
  },
  {
    id: 'ration-dl',
    title: 'e-Ration Card Delhi Doorstep Delivery',
    status: 'published',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-DL',
    jurisdictionName: 'Delhi',
    effectiveFrom: '2023-01-01T00:00:00Z',
    effectiveTo: null,
  },
  {
    id: 'future-transport-2028',
    title: 'Autonomous Vehicle Licencing Guidelines 2028',
    status: 'published',
    jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
    effectiveFrom: '2028-01-01T00:00:00Z',
    effectiveTo: null,
  },
];

describe('Temporal and Jurisdiction-Aware Retrieval (#610)', () => {
  it('validates rule temporal boundaries correctly', () => {
    expect(validateRuleTemporalRange({ effectiveFrom: '2022-01-01' }).valid).toBe(true);
    expect(
      validateRuleTemporalRange({ effectiveFrom: '2022-01-01', effectiveTo: '2021-01-01' }).valid
    ).toBe(false);
  });

  it('correctly resolves statuses (current, historical, future, superseded)', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();

    expect(resolveRuleStatus(MOCK_VERSIONED_RULES[0], now)).toBe(RULE_STATUS.SUPERSEDED);
    expect(resolveRuleStatus(MOCK_VERSIONED_RULES[1], now)).toBe(RULE_STATUS.CURRENT);
    expect(resolveRuleStatus(MOCK_VERSIONED_RULES[4], now)).toBe(RULE_STATUS.FUTURE_EFFECTIVE);
  });

  it('filters out superseded and future rules for current queries', () => {
    const res = filterVersionedCivicRules({
      rules: MOCK_VERSIONED_RULES,
      query: 'what is the pan aadhaar fee',
    });

    const ids = res.validRules.map((r) => r.id);
    expect(ids).toContain('pan-rule-v2');
    expect(ids).not.toContain('pan-rule-v1');
    expect(ids).not.toContain('future-transport-2028');
  });

  it('retrieves historical rules when explicitly requested', () => {
    const res = filterVersionedCivicRules({
      rules: MOCK_VERSIONED_RULES,
      query: 'what was the pan rule in 2021',
    });

    const ids = res.validRules.map((r) => r.id);
    expect(ids).toContain('pan-rule-v1');
    expect(res.temporalDiagnostics.isHistoricalQuery).toBe(true);
    expect(res.temporalDiagnostics.targetYear).toBe(2021);
  });

  it('filters rules by state jurisdiction when context is provided', () => {
    const res = filterVersionedCivicRules({
      rules: MOCK_VERSIONED_RULES,
      query: 'ration card application',
      userJurisdiction: 'Maharashtra',
    });

    const ids = res.validRules.map((r) => r.id);
    expect(ids).toContain('ration-mh');
    expect(ids).not.toContain('ration-dl');
    expect(res.limitationNotice).toBeNull();
  });

  it('surfaces a limitation notice when state jurisdiction is omitted and rules differ', () => {
    const res = filterVersionedCivicRules({
      rules: MOCK_VERSIONED_RULES,
      query: 'ration card application',
      userJurisdiction: null,
    });

    expect(res.limitationNotice).not.toBeNull();
    expect(res.limitationNotice.type).toBe('MISSING_JURISDICTION');
    expect(res.limitationNotice.availableStates).toContain('Maharashtra');
    expect(res.limitationNotice.availableStates).toContain('Delhi');
  });
});
