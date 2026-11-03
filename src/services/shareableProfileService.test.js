import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createShareableProfile,
  getPublicSharedProfile,
  revokeSharedProfile,
  updateSharedProfileVisibility,
  getActiveShareForUser,
  SHARE_EXPIRY_OPTIONS,
} from './shareableProfileService';

describe('shareableProfileService (#455)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const mockProfile = {
    fullName: 'Sunita Sharma',
    state: 'Rajasthan',
    district: 'Jaipur',
    category: 'General',
    occupation: 'Self-employed Artisan',
    savedServices: [{ id: 'srv-1', title: 'PMAY-G Rural Housing', category: 'Housing' }],
    applications: [{ serviceName: 'Solar Rooftop Subsidy', stage: 'Field Verification' }],
    readinessScore: 92,
    // Sensitive fields that MUST NEVER leak
    aadhaarNumber: '1234-5678-9012',
    privateNotes: 'Confidential case history',
  };

  it('generates a hard-to-guess token and stores privacy snapshot', () => {
    const share = createShareableProfile('user-101', mockProfile, {
      expiry: SHARE_EXPIRY_OPTIONS.DAYS_7,
    });

    expect(share.token).toBeDefined();
    expect(share.token.length).toBeGreaterThanOrEqual(16);
    expect(share.userId).toBe('user-101');
    expect(share.revoked).toBe(false);
  });

  it('allows unauthenticated visitors to fetch active shared profile without private fields', () => {
    const share = createShareableProfile('user-101', mockProfile, {
      visibility: {
        showFullName: true,
        showLocation: true,
        showSavedServices: true,
      },
    });

    const res = getPublicSharedProfile(share.token);
    expect(res.status).toBe('ACTIVE');
    expect(res.readOnly).toBe(true);
    expect(res.profile.fullName).toBe('Sunita Sharma');
    expect(res.profile.location).toBe('Jaipur, Rajasthan');
    expect(res.profile.savedServices).toHaveLength(1);

    // Verify sensitive fields are not in the response
    expect(res.profile.aadhaarNumber).toBeUndefined();
    expect(res.profile.privateNotes).toBeUndefined();
  });

  it('hides fields when visibility is toggled off', () => {
    const share = createShareableProfile('user-101', mockProfile, {
      visibility: {
        showFullName: false,
        showLocation: false,
        showSavedServices: false,
      },
    });

    const res = getPublicSharedProfile(share.token);
    expect(res.profile.fullName).toBe('Citizen Applicant');
    expect(res.profile.location).toBeNull();
    expect(res.profile.savedServices).toEqual([]);
  });

  it('prevents access when share link is revoked', () => {
    const share = createShareableProfile('user-101', mockProfile);
    const revokeSuccess = revokeSharedProfile(share.token);
    expect(revokeSuccess).toBe(true);

    const res = getPublicSharedProfile(share.token);
    expect(res.status).toBe('REVOKED');
    expect(res.profile).toBeUndefined();
    expect(res.error).toContain('revoked');
  });

  it('rejects expired share links', () => {
    const share = createShareableProfile('user-101', mockProfile);
    // Artificially expire the record
    share.expiresAt = Date.now() - 10000;
    const all = JSON.parse(localStorage.getItem('civicbridge_shareable_citizen_profiles'));
    all[share.token] = share;
    localStorage.setItem('civicbridge_shareable_citizen_profiles', JSON.stringify(all));

    const res = getPublicSharedProfile(share.token);
    expect(res.status).toBe('EXPIRED');
    expect(res.error).toContain('expired');
  });

  it('dynamically updates visibility settings for an existing link', () => {
    const share = createShareableProfile('user-101', mockProfile, {
      visibility: { showOccupation: false },
    });

    let res = getPublicSharedProfile(share.token);
    expect(res.profile.occupation).toBeNull();

    updateSharedProfileVisibility(share.token, { showOccupation: true });
    res = getPublicSharedProfile(share.token);
    expect(res.profile.occupation).toBe('Self-employed Artisan');
  });

  it('retrieves active share record for user', () => {
    createShareableProfile('user-xyz', mockProfile);
    const active = getActiveShareForUser('user-xyz');
    expect(active).not.toBeNull();
    expect(active.userId).toBe('user-xyz');
  });
});
