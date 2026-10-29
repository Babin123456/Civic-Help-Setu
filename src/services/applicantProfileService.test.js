import { describe, it, expect, beforeEach } from 'vitest';
import {
  getApplicantProfiles,
  getActiveProfileId,
  setActiveProfileId,
  getActiveApplicantProfile,
  createApplicantProfile,
  updateApplicantProfile,
  deleteApplicantProfile,
  filterAssessmentsByProfile,
  DEFAULT_SELF_PROFILE,
  APPLICANT_PROFILES_STORAGE_KEY,
  ACTIVE_PROFILE_STORAGE_KEY,
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
  clear() {
    this.store = {};
  }
}

describe('Applicant Profile Service (#255)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  it('initializes default self profile when storage is empty', () => {
    const profiles = getApplicantProfiles(mockStorage);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('prof_self');
    expect(profiles[0].relationship).toBe('self');
    expect(getActiveProfileId(mockStorage)).toBe('prof_self');
  });

  it('creates a new family member profile and selects it', () => {
    const created = createApplicantProfile(
      {
        name: 'Sunita Sharma',
        relationship: 'parent',
        age: 63,
        employment: 'retired',
        annualIncome: 120000,
        category: 'OBC',
        state: 'Uttar Pradesh',
        hasAadhaar: true,
      },
      mockStorage
    );

    expect(created.id).toMatch(/^prof_/);
    expect(created.name).toBe('Sunita Sharma');
    expect(created.isSeniorCitizen).toBe(true);

    const activeId = getActiveProfileId(mockStorage);
    expect(activeId).toBe(created.id);

    const active = getActiveApplicantProfile(mockStorage);
    expect(active.name).toBe('Sunita Sharma');
  });

  it('rejects profile creation without a valid name', () => {
    expect(() => {
      createApplicantProfile({ name: '   ' }, mockStorage);
    }).toThrow('Applicant name is required');
  });

  it('updates profile details correctly', () => {
    const created = createApplicantProfile({ name: 'Rohan Sharma', age: 17, relationship: 'child' }, mockStorage);
    const updated = updateApplicantProfile(created.id, { age: 18, employment: 'student' }, mockStorage);

    expect(updated.age).toBe(18);
    expect(updated.employment).toBe('student');
  });

  it('switches active profile successfully', () => {
    const p1 = createApplicantProfile({ name: 'Member 1', relationship: 'sibling' }, mockStorage);
    setActiveProfileId('prof_self', mockStorage);
    expect(getActiveProfileId(mockStorage)).toBe('prof_self');

    setActiveProfileId(p1.id, mockStorage);
    expect(getActiveProfileId(mockStorage)).toBe(p1.id);
  });

  it('throws when trying to select a non-existent profile', () => {
    expect(() => {
      setActiveProfileId('non_existent', mockStorage);
    }).toThrow('does not exist');
  });

  it('prevents deleting the primary self profile', () => {
    expect(() => {
      deleteApplicantProfile('prof_self', mockStorage);
    }).toThrow('primary applicant profile (Self) cannot be deleted');
  });

  it('deletes a profile, resets active profile, and cascades assessment removal', () => {
    const created = createApplicantProfile({ name: 'Dependent', relationship: 'child' }, mockStorage);

    // Staged assessments
    mockStorage.setItem(
      'civicbridge_eligibility_assessments',
      JSON.stringify([
        { id: 'eval-1', applicantId: 'prof_self', schemeName: 'Passport' },
        { id: 'eval-2', applicantId: created.id, schemeName: 'Child Education Aid' },
      ])
    );

    const remaining = deleteApplicantProfile(created.id, mockStorage);
    expect(remaining).toHaveLength(1);
    expect(getActiveProfileId(mockStorage)).toBe('prof_self');

    const remainingAssessments = JSON.parse(mockStorage.getItem('civicbridge_eligibility_assessments'));
    expect(remainingAssessments).toHaveLength(1);
    expect(remainingAssessments[0].id).toBe('eval-1');
  });

  it('scopes and filters assessments per applicant profile', () => {
    const assessments = [
      { id: 'a1', schemeName: 'S1' }, // Legacy without applicantId -> belongs to prof_self
      { id: 'a2', applicantId: 'prof_self', schemeName: 'S2' },
      { id: 'a3', applicantId: 'prof_parent', schemeName: 'S3' },
    ];

    const selfAssessments = filterAssessmentsByProfile(assessments, 'prof_self');
    expect(selfAssessments).toHaveLength(2);
    expect(selfAssessments.map((a) => a.id)).toEqual(['a1', 'a2']);

    const parentAssessments = filterAssessmentsByProfile(assessments, 'prof_parent');
    expect(parentAssessments).toHaveLength(1);
    expect(parentAssessments[0].id).toBe('a3');
  });
});
