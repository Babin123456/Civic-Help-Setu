/**
 * Applicant Profile Service
 * Enables maintaining multiple applicant profiles (e.g. Self, Parent, Spouse, Dependent)
 * so that eligibility evaluations and assessments can be conducted with distinct criteria
 * without cross-contaminating citizen demographic data.
 */

export const APPLICANT_PROFILES_STORAGE_KEY = 'civicbridge_applicant_profiles_v1';
export const ACTIVE_PROFILE_STORAGE_KEY = 'civicbridge_active_applicant_profile_id_v1';

export const RELATIONSHIP_TYPES = [
  { id: 'self', label: 'Self' },
  { id: 'parent', label: 'Parent (Father / Mother)' },
  { id: 'spouse', label: 'Spouse' },
  { id: 'child', label: 'Child / Dependent Minor' },
  { id: 'sibling', label: 'Sibling' },
  { id: 'other', label: 'Other Family Member' },
];

export const DEFAULT_SELF_PROFILE = {
  id: 'prof_self',
  name: 'Primary Applicant (Self)',
  relationship: 'self',
  age: 32,
  employment: 'salaried',
  annualIncome: 450000,
  category: 'General',
  state: 'Delhi',
  hasAadhaar: true,
  ownsAgriculturalLand: false,
  hasDisability: false,
  isStudent: false,
  isSeniorCitizen: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const safeStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Retrieve all configured applicant profiles.
 */
export function getApplicantProfiles(storage = safeStorage()) {
  if (!storage) return [DEFAULT_SELF_PROFILE];
  try {
    const raw = storage.getItem(APPLICANT_PROFILES_STORAGE_KEY);
    if (!raw) {
      storage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify([DEFAULT_SELF_PROFILE]));
      return [DEFAULT_SELF_PROFILE];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    storage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify([DEFAULT_SELF_PROFILE]));
    return [DEFAULT_SELF_PROFILE];
  } catch {
    return [DEFAULT_SELF_PROFILE];
  }
}

/**
 * Get the ID of the currently selected applicant profile.
 */
export function getActiveProfileId(storage = safeStorage()) {
  const profiles = getApplicantProfiles(storage);
  if (!storage) return profiles[0].id;

  try {
    const activeId = storage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    const exists = profiles.some((p) => p.id === activeId);
    if (activeId && exists) {
      return activeId;
    }
    const fallbackId = profiles[0].id;
    storage.setItem(ACTIVE_PROFILE_STORAGE_KEY, fallbackId);
    return fallbackId;
  } catch {
    return profiles[0].id;
  }
}

/**
 * Set the currently selected applicant profile.
 */
export function setActiveProfileId(profileId, storage = safeStorage()) {
  const profiles = getApplicantProfiles(storage);
  const target = profiles.find((p) => p.id === profileId);
  if (!target) {
    throw new Error(`Applicant profile with ID "${profileId}" does not exist.`);
  }

  if (storage) {
    try {
      storage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
    } catch {
      // storage unavailable
    }
  }
  return target;
}

/**
 * Get the active applicant profile entity.
 */
export function getActiveApplicantProfile(storage = safeStorage()) {
  const profiles = getApplicantProfiles(storage);
  const activeId = getActiveProfileId(storage);
  return profiles.find((p) => p.id === activeId) || profiles[0] || DEFAULT_SELF_PROFILE;
}

/**
 * Create a new applicant profile.
 */
export function createApplicantProfile(data = {}, storage = safeStorage()) {
  const name = String(data.name || '').trim();
  if (!name) {
    throw new Error('Applicant name is required.');
  }

  const relationship = data.relationship || 'other';
  const age = Number(data.age) || 30;
  const isSenior = age >= 60;
  const isStudent = Boolean(data.isStudent || data.employment === 'student');

  const newProfile = {
    id: `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    relationship,
    age,
    employment: data.employment || 'unemployed',
    annualIncome: Number(data.annualIncome) || 0,
    category: data.category || 'General',
    state: data.state || 'Delhi',
    hasAadhaar: data.hasAadhaar !== undefined ? Boolean(data.hasAadhaar) : true,
    ownsAgriculturalLand: Boolean(data.ownsAgriculturalLand),
    hasDisability: Boolean(data.hasDisability),
    isStudent,
    isSeniorCitizen: isSenior,
    notes: String(data.notes || '').trim().slice(0, 300),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const profiles = getApplicantProfiles(storage);
  const updated = [...profiles, newProfile];

  if (storage) {
    try {
      storage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify(updated));
      storage.setItem(ACTIVE_PROFILE_STORAGE_KEY, newProfile.id);
    } catch {
      // storage quota or failure
    }
  }

  return newProfile;
}

/**
 * Update an existing applicant profile.
 */
export function updateApplicantProfile(profileId, updates = {}, storage = safeStorage()) {
  const profiles = getApplicantProfiles(storage);
  const index = profiles.findIndex((p) => p.id === profileId);
  if (index === -1) {
    throw new Error(`Profile "${profileId}" not found.`);
  }

  const existing = profiles[index];
  const age = updates.age !== undefined ? Number(updates.age) : existing.age;

  const updatedProfile = {
    ...existing,
    ...updates,
    id: existing.id, // Immutable ID
    relationship: existing.id === 'prof_self' ? 'self' : (updates.relationship || existing.relationship),
    age,
    isSeniorCitizen: age >= 60,
    updatedAt: new Date().toISOString(),
  };

  profiles[index] = updatedProfile;

  if (storage) {
    try {
      storage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // storage unavailable
    }
  }

  return updatedProfile;
}

/**
 * Delete an applicant profile and cascade delete its linked assessment evaluations.
 */
export function deleteApplicantProfile(profileId, storage = safeStorage()) {
  if (profileId === 'prof_self') {
    throw new Error('The primary applicant profile (Self) cannot be deleted.');
  }

  const profiles = getApplicantProfiles(storage);
  const filtered = profiles.filter((p) => p.id !== profileId);
  if (filtered.length === profiles.length) {
    return profiles;
  }

  if (storage) {
    try {
      storage.setItem(APPLICANT_PROFILES_STORAGE_KEY, JSON.stringify(filtered));

      // Cascade remove assessments linked to this profile
      const rawAssessments = storage.getItem('civicbridge_eligibility_assessments');
      if (rawAssessments) {
        const assessments = JSON.parse(rawAssessments);
        if (Array.isArray(assessments)) {
          const cleanedAssessments = assessments.filter((a) => a.applicantId !== profileId);
          storage.setItem('civicbridge_eligibility_assessments', JSON.stringify(cleanedAssessments));
        }
      }

      // If active profile was deleted, revert active to primary self
      const activeId = storage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
      if (activeId === profileId) {
        storage.setItem(ACTIVE_PROFILE_STORAGE_KEY, filtered[0]?.id || 'prof_self');
      }
    } catch {
      // storage unavailable
    }
  }

  return filtered;
}

/**
 * Filter assessments scoped to an applicant profile.
 */
export function filterAssessmentsByProfile(assessments = [], profileId = 'prof_self') {
  if (!Array.isArray(assessments)) return [];
  return assessments.filter((item) => {
    if (!item.applicantId) {
      // Legacy assessments without an applicantId are assumed to belong to 'prof_self'
      return profileId === 'prof_self';
    }
    return item.applicantId === profileId;
  });
}
