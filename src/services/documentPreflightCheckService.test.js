import { describe, it, expect } from 'vitest';
import {
  STATUTORY_PREFLIGHT_CRITERIA,
  getDocumentPreflightRules,
  calculatePreflightReadiness,
  generatePreflightInspectionText,
} from './documentPreflightCheckService';

describe('documentPreflightCheckService', () => {
  it('returns baseline criteria for any civic service', () => {
    const rules = getDocumentPreflightRules('birth-certificate', []);
    expect(rules.length).toBeGreaterThanOrEqual(6);
    expect(rules.some(r => r.id === 'self_attestation_signature')).toBe(true);
    expect(rules.some(r => r.id === 'address_freshness_90days')).toBe(true);
  });

  it('injects revenue and bloodline rules for caste and income certificates', () => {
    const incomeRules = getDocumentPreflightRules('income-certificate', ['Patwari report', 'Salary slip']);
    expect(incomeRules.some(r => r.id === 'income_patwari_report')).toBe(true);

    const casteRules = getDocumentPreflightRules('caste-certificate', ['Paternal lineage proof']);
    expect(casteRules.some(r => r.id === 'caste_ancestry_proof')).toBe(true);
  });

  it('injects medical fitness Form 1-A requirement for driving licenses', () => {
    const dlRules = getDocumentPreflightRules('driving-license', ['Medical Certificate']);
    expect(dlRules.some(r => r.id === 'medical_form_1a')).toBe(true);
  });

  it('evaluates readiness score and detects missing mandatory items', () => {
    const rules = getDocumentPreflightRules('birth-certificate', []);
    const initial = calculatePreflightReadiness([], rules);
    expect(initial.percentage).toBe(0);
    expect(initial.isReadyForVisit).toBe(false);
    expect(initial.missingMandatoryCount).toBeGreaterThan(0);

    // Complete all items
    const allIds = rules.map(r => r.id);
    const complete = calculatePreflightReadiness(allIds, rules);
    expect(complete.percentage).toBe(100);
    expect(complete.isReadyForVisit).toBe(true);
    expect(complete.readinessLevel).toBe('FULLY_READY');
  });

  it('generates well-formatted text report for physical counter visit', () => {
    const rules = getDocumentPreflightRules('passport', []);
    const checked = ['name_exact_match', 'self_attestation_signature'];
    const readiness = calculatePreflightReadiness(checked, rules);
    const text = generatePreflightInspectionText('Passport Seva', readiness, rules, checked);

    expect(text).toContain('CIVIC APPLICATION DOCUMENT PRE-FLIGHT READINESS REPORT');
    expect(text).toContain('Passport Seva');
    expect(text).toContain('[COMPLETED]');
    expect(text).toContain('[PENDING]');
  });
});
