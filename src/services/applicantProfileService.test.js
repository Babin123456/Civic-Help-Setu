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
  normalizeApplicantProfile,
  countAssessmentsForProfile,
  toEligibilityAnswers,
  saveEligibilityAnswers,
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

describe('Applicant profiles keep their own answers (#255)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  it('holds different assessment inputs for two profiles without overwriting either', () => {
    const parent = createApplicantProfile({ name: 'Sunita', relationship: 'parent', age: 63 }, mockStorage);

    saveEligibilityAnswers('prof_self', { age: 28, annualIncome: 900000, employment: 'salaried', hasPan: true }, mockStorage);
    saveEligibilityAnswers(
      parent.id,
      { age: 63, annualIncome: 90000, employment: 'retired', hasPan: false, isStudent: false },
      mockStorage
    );

    const profiles = getApplicantProfiles(mockStorage);
    const self = toEligibilityAnswers(profiles.find((p) => p.id === 'prof_self'));
    const mother = toEligibilityAnswers(profiles.find((p) => p.id === parent.id));

    expect(self).toMatchObject({ age: 28, annualIncome: 900000, employment: 'salaried', hasPan: true });
    expect(mother).toMatchObject({ age: 63, annualIncome: 90000, employment: 'retired', hasPan: false });
  });

  it('restores the answers of the applicant that is selected again', () => {
    const child = createApplicantProfile({ name: 'Rohan', relationship: 'child', age: 17 }, mockStorage);
    saveEligibilityAnswers(child.id, { age: 17, annualIncome: 60000, isStudent: true, hasLearnerLicense: false }, mockStorage);

    setActiveProfileId('prof_self', mockStorage);
    setActiveProfileId(child.id, mockStorage);

    const answers = toEligibilityAnswers(getActiveApplicantProfile(mockStorage));
    expect(answers).toMatchObject({ age: 17, annualIncome: 60000, isStudent: true, hasLearnerLicense: false });
  });

  it('keeps the senior citizen flag in step with an edited age', () => {
    const created = createApplicantProfile({ name: 'Mohan', age: 58 }, mockStorage);
    expect(created.isSeniorCitizen).toBe(false);
    expect(updateApplicantProfile(created.id, { age: 61 }, mockStorage).isSeniorCitizen).toBe(true);
  });

  it('refuses to rename a profile to an empty name', () => {
    const created = createApplicantProfile({ name: 'Mohan' }, mockStorage);
    expect(() => updateApplicantProfile(created.id, { name: '  ' }, mockStorage)).toThrow('Applicant name is required');
    expect(getApplicantProfiles(mockStorage).find((p) => p.id === created.id).name).toBe('Mohan');
  });

  it('never lets the primary profile stop being "self" when edited', () => {
    const updated = updateApplicantProfile('prof_self', { relationship: 'parent', name: 'Me' }, mockStorage);
    expect(updated.relationship).toBe('self');
    expect(updated.name).toBe('Me');
  });
});

describe('Empty, missing and partial profiles (#255)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  it('turns a missing age and income into blanks instead of inventing numbers', () => {
    const profile = normalizeApplicantProfile({ id: 'prof_half', name: 'Half filled' });
    expect(profile.age).toBe('');
    expect(profile.annualIncome).toBe('');
    expect(profile.isSeniorCitizen).toBe(false);

    const answers = toEligibilityAnswers(profile);
    expect(answers.age).toBe('');
    expect(answers.annualIncome).toBe('');
    // nothing else is made up either, so the wizard keeps its own defaults for these
    expect(answers).not.toHaveProperty('employment');
    expect(answers).not.toHaveProperty('hasAadhaar');
  });

  it('rejects out-of-range, negative and non-numeric values', () => {
    expect(normalizeApplicantProfile({ id: 'a', age: 400, annualIncome: -5 })).toMatchObject({ age: '', annualIncome: '' });
    expect(normalizeApplicantProfile({ id: 'a', age: 'abc', annualIncome: '  ' })).toMatchObject({ age: '', annualIncome: '' });
    expect(normalizeApplicantProfile({ id: 'a', age: '0', annualIncome: '0' })).toMatchObject({ age: 0, annualIncome: 0 });
  });

  it('gives a nameless profile a readable name and an unknown relationship a safe one', () => {
    const profile = normalizeApplicantProfile({ id: 'prof_x', name: '   ', relationship: 'stranger' });
    expect(profile.name).toBe('Unnamed applicant');
    expect(profile.relationship).toBe('other');
  });

  it('drops entries that are not usable profiles and keeps the rest', () => {
    mockStorage.setItem(
      APPLICANT_PROFILES_STORAGE_KEY,
      JSON.stringify([null, 'text', 42, { name: 'no id' }, { id: '' }, { id: 'prof_ok', name: 'Valid', age: 40 }, { id: 'prof_ok', name: 'Duplicate' }])
    );
    const profiles = getApplicantProfiles(mockStorage);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: 'prof_ok', name: 'Valid', age: 40 });
  });

  it('falls back to the default profile for corrupt or unusable storage', () => {
    mockStorage.setItem(APPLICANT_PROFILES_STORAGE_KEY, '{not json');
    expect(getApplicantProfiles(mockStorage)[0].id).toBe('prof_self');

    mockStorage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify({ id: 'prof_self' }));
    expect(getApplicantProfiles(mockStorage)[0].id).toBe('prof_self');

    mockStorage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify([null, 5]));
    expect(getApplicantProfiles(mockStorage)).toHaveLength(1);
    expect(getApplicantProfiles(mockStorage)[0].id).toBe('prof_self');
  });

  it('selects the first usable profile when the stored active id no longer exists', () => {
    createApplicantProfile({ name: 'Temp' }, mockStorage);
    mockStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, 'prof_gone');
    expect(getActiveProfileId(mockStorage)).toBe('prof_self');
  });
});

describe('Counting what a profile delete removes (#255)', () => {
  it('counts a profile\'s assessments, with legacy records belonging to the primary profile', () => {
    const mockStorage = new MockStorage();
    mockStorage.setItem(
      'civicbridge_eligibility_assessments',
      JSON.stringify([
        { id: 'old' },
        { id: 'a', applicantId: 'prof_self' },
        { id: 'b', applicantId: 'prof_kid' },
        { id: 'c', applicantId: 'prof_kid' },
      ])
    );
    expect(countAssessmentsForProfile('prof_self', mockStorage)).toBe(2);
    expect(countAssessmentsForProfile('prof_kid', mockStorage)).toBe(2);
    expect(countAssessmentsForProfile('prof_nobody', mockStorage)).toBe(0);
  });

  it('returns 0 for missing, corrupt or non-list storage', () => {
    const mockStorage = new MockStorage();
    expect(countAssessmentsForProfile('prof_self', mockStorage)).toBe(0);
    mockStorage.setItem('civicbridge_eligibility_assessments', '{oops');
    expect(countAssessmentsForProfile('prof_self', mockStorage)).toBe(0);
    mockStorage.setItem('civicbridge_eligibility_assessments', JSON.stringify({ id: 'x' }));
    expect(countAssessmentsForProfile('prof_self', mockStorage)).toBe(0);
  });
});
