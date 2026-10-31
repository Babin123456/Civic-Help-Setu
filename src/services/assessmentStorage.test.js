import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveAssessment,
  getSavedAssessments,
  getAssessmentsForApplicant,
  deleteAssessment,
  evaluateAllSchemes,
} from './assessmentStorage';
import {
  createApplicantProfile,
  deleteApplicantProfile,
  getActiveApplicantProfile,
  setActiveProfileId,
} from './applicantProfileService';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

const answers = { age: 30, annualIncome: 200000, category: 'General', employment: 'salaried', state: 'Delhi', hasAadhaar: true };

describe('Assessments are saved against the applicant they were run for (#255)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records the selected applicant on a saved assessment', () => {
    const mother = createApplicantProfile({ name: 'Sunita', relationship: 'parent', age: 63 });
    const entry = saveAssessment(answers, evaluateAllSchemes(answers), getActiveApplicantProfile());

    expect(entry.applicantId).toBe(mother.id);
    expect(entry.applicantName).toBe('Sunita');
    expect(getSavedAssessments()[0].applicantId).toBe(mother.id);
  });

  it('defaults to the active applicant when none is passed', () => {
    createApplicantProfile({ name: 'Rohan', relationship: 'child', age: 17 });
    setActiveProfileId('prof_self');
    expect(saveAssessment(answers, evaluateAllSchemes(answers)).applicantId).toBe('prof_self');
  });

  it('shows each applicant only their own assessments', () => {
    const mother = createApplicantProfile({ name: 'Sunita' });
    saveAssessment(answers, evaluateAllSchemes(answers), { id: 'prof_self', name: 'Me' });
    saveAssessment(answers, evaluateAllSchemes(answers), mother);
    saveAssessment(answers, evaluateAllSchemes(answers), mother);

    expect(getAssessmentsForApplicant('prof_self')).toHaveLength(1);
    expect(getAssessmentsForApplicant(mother.id)).toHaveLength(2);
    expect(getSavedAssessments()).toHaveLength(3);
  });

  it('treats an old assessment with no applicant as belonging to the primary profile', () => {
    localStorage.setItem('civicbridge_eligibility_assessments', JSON.stringify([{ id: 'eval-old', profileSummary: {}, results: [] }]));
    expect(getAssessmentsForApplicant('prof_self')).toHaveLength(1);
    expect(getAssessmentsForApplicant('prof_other')).toHaveLength(0);
  });

  it('removes only that applicant\'s assessments when the profile is deleted', () => {
    const mother = createApplicantProfile({ name: 'Sunita' });
    saveAssessment(answers, evaluateAllSchemes(answers), { id: 'prof_self', name: 'Me' });
    saveAssessment(answers, evaluateAllSchemes(answers), mother);

    deleteApplicantProfile(mother.id);

    expect(getSavedAssessments()).toHaveLength(1);
    expect(getAssessmentsForApplicant('prof_self')).toHaveLength(1);
    expect(getAssessmentsForApplicant(mother.id)).toHaveLength(0);
  });

  it('deleting one assessment leaves the others, including other applicants\'', () => {
    const mother = createApplicantProfile({ name: 'Sunita' });
    const mine = saveAssessment(answers, evaluateAllSchemes(answers), { id: 'prof_self', name: 'Me' });
    saveAssessment(answers, evaluateAllSchemes(answers), mother);

    deleteAssessment(mine.id);

    expect(getAssessmentsForApplicant('prof_self')).toHaveLength(0);
    expect(getAssessmentsForApplicant(mother.id)).toHaveLength(1);
  });

  it('copes with corrupt or non-list assessment storage', () => {
    localStorage.setItem('civicbridge_eligibility_assessments', '{oops');
    expect(getSavedAssessments()).toEqual([]);
    localStorage.setItem('civicbridge_eligibility_assessments', JSON.stringify({ id: 'x' }));
    expect(getSavedAssessments()).toEqual([]);
    expect(getAssessmentsForApplicant('prof_self')).toEqual([]);
  });
});
