import { describe, it, expect } from 'vitest';
import {
  calculateAdmissionAge,
  evaluateAdmissionReadiness,
  getAdmissionMilestones,
  exportSchoolAdmissionReport,
  ADMISSION_CHANNELS,
  RTE_CATEGORIES,
  DISTANCE_TIERS,
  STATUTORY_EVIDENCE
} from './schoolAdmissionRteNavigatorService';

describe('schoolAdmissionRteNavigatorService', () => {
  it('should calculate admission age accurately based on cutoff date', () => {
    // Born 2018-05-15, Cutoff 2024-03-31 -> 5 years, 10 months
    const age = calculateAdmissionAge('2018-05-15', '2024-03-31');
    expect(age).not.toBeNull();
    expect(age.years).toBe(5);
    expect(age.months).toBe(10);
    expect(age.decimalAge).toBeCloseTo(5.83, 1);
  });

  it('should return null for invalid date strings', () => {
    expect(calculateAdmissionAge('', '2024-03-31')).toBeNull();
    expect(calculateAdmissionAge('invalid-date', '2024-03-31')).toBeNull();
  });

  it('should evaluate regular government school admission readiness correctly', () => {
    const applicant = {
      childName: 'Aarav Sharma',
      parentName: 'Vikram Sharma',
      dob: '2017-06-10',
      cutoffDate: '2024-03-31',
      channel: 'govt_regular',
      distanceKm: 0.8,
      documents: ['child_dob_proof', 'parent_id_residence', 'child_passport_photo']
    };

    const res = evaluateAdmissionReadiness(applicant);
    expect(res.eligible).toBe(true);
    expect(res.calculatedAge.years).toBe(6);
    expect(res.distanceTier.priority).toBe(1);
    expect(res.errors).toHaveLength(0);
  });

  it('should flag errors when mandatory documents are missing in RTE application', () => {
    const applicant = {
      childName: 'Pooja Kumari',
      parentName: 'Suresh Kumar',
      dob: '2018-02-15',
      cutoffDate: '2024-03-31',
      channel: 'rte_private_quota',
      rteCategory: 'ews',
      distanceKm: 4.5,
      documents: []
    };

    const res = evaluateAdmissionReadiness(applicant);
    expect(res.eligible).toBe(false);
    expect(res.errors).toContain('Mandatory proof of date of birth is missing.');
    expect(res.errors).toContain('Mandatory parent residence proof is missing.');
    expect(res.warnings).toContain('Income certificate is required for EWS category application.');
    expect(res.warnings.some(w => w.includes('exceeds 6 km') || w.includes('neighbourhood'))).toBe(true);
  });

  it('should return milestones for different channels', () => {
    const rteMilestones = getAdmissionMilestones('rte_private_quota');
    const govtMilestones = getAdmissionMilestones('govt_regular');

    expect(rteMilestones.length).toBe(5);
    expect(govtMilestones.length).toBe(4);
    expect(rteMilestones[2].title).toContain('Lottery');
  });

  it('should export detailed markdown report', () => {
    const applicant = {
      childName: 'Meera Das',
      parentName: 'Subhash Das',
      dob: '2017-08-20',
      cutoffDate: '2024-03-31',
      channel: 'rte_private_quota',
      rteCategory: 'dg',
      distanceKm: 1.2,
      documents: ['child_dob_proof', 'parent_id_residence', 'caste_or_dg_certificate']
    };

    const report = exportSchoolAdmissionReport(applicant);
    expect(report).toContain('# Government School & RTE 12(1)(c) Admission Readiness Dossier');
    expect(report).toContain('Meera Das');
    expect(report).toContain('RTE Act 2009 Section 12(1)(c)');
    expect(report).toContain('ELIGIBLE TO PROCEED');
  });
});
