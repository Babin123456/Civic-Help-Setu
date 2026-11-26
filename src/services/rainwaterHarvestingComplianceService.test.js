import { describe, it, expect, beforeEach } from 'vitest';
import { RainwaterHarvestingComplianceService } from './rainwaterHarvestingComplianceService.js';

describe('RainwaterHarvestingComplianceService', () => {
  let service;

  beforeEach(() => {
    service = new RainwaterHarvestingComplianceService();
  });

  it('correctly assesses mandatory RWH for Bengaluru new construction over 1200 sq ft', () => {
    const result = service.evaluateComplianceRequirement('IN-KA-BLR', 1500, true);
    expect(result.isLocalRuleFound).toBe(true);
    expect(result.city).toBe('Bengaluru');
    expect(result.isMandatory).toBe(true);
    expect(result.penaltiesForNonCompliance).toContain('surcharge');
    expect(result.governingAuthority).toContain('BWSSB');
  });

  it('exempts small existing properties under statutory threshold', () => {
    const result = service.evaluateComplianceRequirement('IN-KA-BLR', 1800, false); // Existing threshold is 2400 sq ft
    expect(result.isMandatory).toBe(false);
    expect(result.penaltiesForNonCompliance).toContain('Exempt');
  });

  it('falls back to generic national guidance when jurisdiction is unindexed', () => {
    const result = service.evaluateComplianceRequirement('IN-UNKNOWN', 2000, true);
    expect(result.isLocalRuleFound).toBe(false);
    expect(result.message).toContain('No verified municipal bye-law indexed');
    expect(result.components.length).toBeGreaterThanOrEqual(2);
  });

  it('generates a seasonal pre-monsoon and post-monsoon maintenance checklist', () => {
    const checklist = service.generateMaintenanceChecklist();
    expect(checklist.preMonsoonSteps.length).toBe(4);
    expect(checklist.preMonsoonSteps[0].task).toContain('Clean Roof Catchment');
    expect(checklist.postMonsoonSteps.length).toBe(2);
  });
});
