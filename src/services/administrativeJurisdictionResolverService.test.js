import { describe, it, expect } from 'vitest';
import {
  resolveAdministrativeJurisdiction,
  filterRulesByJurisdiction,
  resolveConcurrentPowerConflict,
  JURISDICTION_TIER,
  JURISDICTION_DISCLAIMER,
} from './administrativeJurisdictionResolverService.js';

describe('Administrative Jurisdiction Resolver Service', () => {
  it('returns JURISDICTION_NOT_ESTABLISHED when location input is missing', () => {
    const res = resolveAdministrativeJurisdiction({});
    expect(res.status).toBe('JURISDICTION_NOT_ESTABLISHED');
    expect(res.tier).toBe(JURISDICTION_TIER.UNRESOLVED);
    expect(res.clarificationPrompt).toContain('Please select your State or Union Territory');
    expect(res.disclaimer).toBe(JURISDICTION_DISCLAIMER);
  });

  it('resolves State level when only state is provided', () => {
    const res = resolveAdministrativeJurisdiction({ stateCode: 'MAHARASHTRA' });
    expect(res.status).toBe('STATE_ESTABLISHED');
    expect(res.state).toBe('Maharashtra');
    expect(res.tier).toBe(JURISDICTION_TIER.STATE_UT);
    expect(res.scopeHierarchy).toContain('MAHARASHTRA');
    expect(res.scopeHierarchy).toContain('ALL_INDIA');
  });

  it('resolves District and Urban Local Body when specified', () => {
    const res = resolveAdministrativeJurisdiction({
      stateCode: 'KARNATAKA',
      districtName: 'BENGALURU_URBAN',
      localBodyName: 'BBMP',
    });

    expect(res.status).toBe('LOCAL_BODY_ESTABLISHED');
    expect(res.tier).toBe(JURISDICTION_TIER.URBAN_LOCAL_BODY);
    expect(res.state).toBe('Karnataka');
    expect(res.district).toBe('Bengaluru Urban');
    expect(res.localBody).toBe('Bruhat Bengaluru Mahanagara Palike (BBMP)');
  });

  it('filters rule corpus strictly to in-scope jurisdiction and excludes alien state rules', () => {
    const mockRules = [
      { id: 'rule-central', title: 'Motor Vehicles Act Central Provisions', jurisdiction: 'ALL_INDIA' },
      { id: 'rule-mh', title: 'Maharashtra Motor Vehicles Rules (Form 4 fee ₹200)', jurisdiction: 'MAHARASHTRA' },
      { id: 'rule-ka', title: 'Karnataka Motor Vehicles Rules (Form 4 fee ₹250)', jurisdiction: 'KARNATAKA' },
      { id: 'rule-dl', title: 'Delhi Transport Department EV Subsidy', jurisdiction: 'DELHI_NCT' },
    ];

    const mhContext = resolveAdministrativeJurisdiction({ stateCode: 'MAHARASHTRA', districtName: 'PUNE' });
    const inScopeRules = filterRulesByJurisdiction(mockRules, mhContext);

    expect(inScopeRules.length).toBe(2);
    const ruleIds = inScopeRules.map((r) => r.id);
    expect(ruleIds).toContain('rule-central');
    expect(ruleIds).toContain('rule-mh');
    expect(ruleIds).not.toContain('rule-ka');
    expect(ruleIds).not.toContain('rule-dl');
  });

  it('falls back strictly to central-only rules when jurisdiction is unresolved', () => {
    const mockRules = [
      { id: 'r1', jurisdiction: 'ALL_INDIA', title: 'Central Framework' },
      { id: 'r2', jurisdiction: 'KARNATAKA', title: 'State Rule' },
    ];

    const unconfirmed = resolveAdministrativeJurisdiction({});
    const safeRules = filterRulesByJurisdiction(mockRules, unconfirmed);

    expect(safeRules.length).toBe(1);
    expect(safeRules[0].id).toBe('r1');
    expect(safeRules[0].applicabilityNote).toContain('Central / All-India guideline');
  });

  it('resolves concurrent power conflicts between Central standards and State procedural fees', () => {
    const centralRule = {
      authority: 'Ministry of Road Transport & Highways',
      statute: 'Motor Vehicles Act 1988 (Sec 9)',
      fee: 200,
    };
    const stateRule = {
      authority: 'Transport Department, Government of Karnataka',
      statute: 'Karnataka Motor Vehicles Rules 1989',
      fee: 300,
    };

    const resolution = resolveConcurrentPowerConflict(centralRule, stateRule);
    expect(resolution.conflictType).toBe('CENTRAL_STATE_CONCURRENT_SCHEDULE');
    expect(resolution.applicableFee).toBe(300);
    expect(resolution.guidance).toContain('Substantive eligibility is governed by central statute');
    expect(resolution.guidance).toContain('application fees, forms, and counter appointment procedures are set by the State');
  });
});
