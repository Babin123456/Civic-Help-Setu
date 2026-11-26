import { describe, it, expect, beforeEach } from 'vitest';
import { ChildProtectionDirectoryService } from './childProtectionDirectoryService.js';

describe('ChildProtectionDirectoryService', () => {
  let service;

  beforeEach(() => {
    service = new ChildProtectionDirectoryService();
  });

  it('provides emergency hotlines (1098, 112) and mandatory FIR Supreme Court guidance', () => {
    const emergency = service.getImmediateEmergencyGuidance();
    expect(emergency.emergencyHotlines.length).toBe(2);
    expect(emergency.emergencyHotlines[0].number).toBe('1098');
    expect(emergency.emergencyHotlines[1].number).toBe('112');
    expect(emergency.firstActionsWhenChildMissing[1]).toContain('MANDATORY in every case of a missing child');
    expect(emergency.legalSafeguardSection74Warning).toContain('Section 74 of the Juvenile Justice Act');
    expect(emergency.platformSafetyGuarantee).toContain('does NOT host any public missing child noticeboards');
  });

  it('locates verified district statutory child protection bodies (CWC, DCPU, SJPU)', () => {
    const results = service.findDistrictAuthorities('Karnataka', 'Bengaluru Urban');
    expect(results.length).toBe(1);
    expect(results[0].cwc.name).toContain('Child Welfare Committee');
    expect(results[0].cwc.contactPhone).toBe('080-26560000');
    expect(results[0].dcpu.nodalOfficer).toContain('DCPO');
    expect(results[0].policeSpecialUnit).toContain('Special Juvenile Police Unit');
  });

  it('provides the authorized reporting information checklist with safety notes', () => {
    const checklist = service.getAuthorizedReportingInformationChecklist();
    expect(checklist.items.length).toBeGreaterThanOrEqual(4);
    expect(checklist.safetyNote).toContain('Do NOT circulate mobile numbers');
  });

  it('accepts community reports for changed CWC contact numbers', () => {
    const report = service.submitContactCorrection('IN-DL-CENTRAL', 'CWC office shifted to Lajpat Nagar-IV');
    expect(report.reportId).toMatch(/^cwc_corr_/);
    expect(report.status).toBe('PENDING_OFFICIAL_VERIFICATION');
  });
});
