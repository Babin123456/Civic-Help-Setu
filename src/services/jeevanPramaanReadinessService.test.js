import { describe, it, expect } from 'vitest';
import {
  evaluatePensionReadiness,
  troubleshootJeevanPramaanFailure,
  generateFamilyHelperChecklist,
  formatPramaanLookup,
  exportPensionReadinessGuide,
  PENSION_PATHWAY,
  SUBMISSION_MODE,
  PENSION_DISCLAIMER,
} from './jeevanPramaanReadinessService.js';

describe('Jeevan Pramaan and Pension Life-Certificate Readiness Centre', () => {
  it('distinguishes Central Civil vs Defence SPARSH vs EPS-95 pension pathways', () => {
    const central = evaluatePensionReadiness({ pathway: PENSION_PATHWAY.CENTRAL_CIVIL, age: 70 });
    expect(central.disbursingAuthority).toContain('CPAO');
    expect(central.isSuperSenior).toBe(false);

    const defence = evaluatePensionReadiness({ pathway: PENSION_PATHWAY.DEFENCE_SPARSH, age: 72 });
    expect(defence.disbursingAuthority).toContain('SPARSH');
    expect(defence.specialNotice).toContain('SPARSH (PCDA Defence)');

    const eps = evaluatePensionReadiness({ pathway: PENSION_PATHWAY.EMPLOYEES_PENSION_SCHEME, age: 62 });
    expect(eps.disbursingAuthority).toContain('EPFO');
    expect(eps.submissionWindowActive).toBe(true); // Rolling 12-month window
  });

  it('activates October window for super-senior pensioners (age 80+)', () => {
    const octSenior = evaluatePensionReadiness({
      pathway: PENSION_PATHWAY.CENTRAL_CIVIL,
      age: 82,
      currentMonthStr: 'October',
    });
    expect(octSenior.isSuperSenior).toBe(true);
    expect(octSenior.submissionWindowActive).toBe(true);
    expect(octSenior.activeWindowDescription).toContain('1st October');

    const octJunior = evaluatePensionReadiness({
      pathway: PENSION_PATHWAY.CENTRAL_CIVIL,
      age: 68,
      currentMonthStr: 'October',
    });
    expect(octJunior.isSuperSenior).toBe(false);
    expect(octJunior.submissionWindowActive).toBe(false); // Only starts in November for under-80
  });

  it('provides actionable diagnostic troubleshooting for FaceRD and SPARSH errors', () => {
    const faceErr = troubleshootJeevanPramaanFailure('face blink detection timeout error');
    expect(faceErr.cause).toContain('Aadhaar FaceRD');
    expect(faceErr.solution).toContain('diffuse lighting');
    expect(faceErr.fallbackChannel).toBe(SUBMISSION_MODE.POSTMAN_DOORSTEP_DLC);

    const sparshErr = troubleshootJeevanPramaanFailure('pda mismatch error on sparsh pension');
    expect(sparshErr.cause).toContain('Pension Disbursing Agency');
    expect(sparshErr.solution).toContain('SPARSH PCDA');

    const bioErr = troubleshootJeevanPramaanFailure('elderly fingerprint scanner failure');
    expect(bioErr.fallbackChannel).toBe(SUBMISSION_MODE.DIGITAL_FACE_AUTHENTICATION);
  });

  it('generates an accessible family-helper checklist without collecting credentials', () => {
    const readiness = evaluatePensionReadiness({ pathway: PENSION_PATHWAY.CENTRAL_CIVIL, age: 75 });
    const checklist = generateFamilyHelperChecklist(readiness);

    expect(checklist.length).toBe(5);
    expect(checklist[0].label).toContain('PPO Number');
    expect(checklist[2].note).toContain('FaceRD');
    expect(checklist[3].note).toContain('Pramaan ID');
    expect(readiness.disclaimer).toBe(PENSION_DISCLAIMER);
  });

  it('validates 10-digit Pramaan ID and exports markdown readiness guide', () => {
    const validLookup = formatPramaanLookup('1234567890');
    expect(validLookup.isValid).toBe(true);
    expect(validLookup.lookupUrl).toContain('jeevanpramaan.gov.in');

    const invalidLookup = formatPramaanLookup('123');
    expect(invalidLookup.isValid).toBe(false);

    const readiness = evaluatePensionReadiness({ pathway: PENSION_PATHWAY.DEFENCE_SPARSH, age: 72 });
    const guide = exportPensionReadinessGuide(readiness);

    expect(guide).toContain('# Pension Life-Certificate Readiness Guide');
    expect(guide).toContain('Defence Pension (Armed Forces & Veterans)');
    expect(guide).toContain('SPARSH (PCDA Defence)');
    expect(guide).toContain(PENSION_DISCLAIMER);
  });
});
