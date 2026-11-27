/**
 * src/services/officeVerificationCampaignService.test.js
 *
 * Unit tests for Civic Office Contact Verification Campaign Manager (#1433).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLocalCampaign,
  listLocalCampaigns,
  submitLocalEvidence,
  reviewLocalVerification,
  computePublicBadge,
} from './officeVerificationCampaignService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('officeVerificationCampaignService (#1433)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('creates a batch verification campaign with UNVERIFIED offices', () => {
    const camp = createLocalCampaign({
      title: 'Q4 Collectorate Audit',
      assigneeId: 'verifier-1',
      officeIds: ['delhi-south-collectorate'],
      expiryPolicyDays: 90,
      customStorage: storage,
    });

    expect(camp.offices).toHaveLength(1);
    expect(camp.offices[0].verificationStatus).toBe('UNVERIFIED');
    expect(camp.offices[0].publicBadge).toBe('UNVERIFIED');
  });

  it('requires valid http(s) official source URL and rejects PII in notes', () => {
    const camp = createLocalCampaign({
      title: 'Source Test',
      officeIds: ['delhi-south-collectorate'],
      customStorage: storage,
    });

    expect(() =>
      submitLocalEvidence({
        campaignId: camp.campaignId,
        officeId: 'delhi-south-collectorate',
        sourceUrl: 'ftp://invalid.example',
        customStorage: storage,
      })
    ).toThrow(/official source URL/i);

    expect(() =>
      submitLocalEvidence({
        campaignId: camp.campaignId,
        officeId: 'delhi-south-collectorate',
        sourceUrl: 'https://edistrict.delhigovt.nic.in',
        notes: 'Officer Aadhaar 1234 5678 9012',
        customStorage: storage,
      })
    ).toThrow(/Aadhaar or PAN/i);
  });

  it('transitions through evidence submission -> approval -> VERIFIED_FRESH -> EXPIRING_SOON -> STALE_EXPIRED', () => {
    const camp = createLocalCampaign({
      title: 'Expiry Policy Test',
      officeIds: ['delhi-south-collectorate'],
      expiryPolicyDays: 30,
      customStorage: storage,
    });

    submitLocalEvidence({
      campaignId: camp.campaignId,
      officeId: 'delhi-south-collectorate',
      sourceUrl: 'https://edistrict.delhigovt.nic.in',
      effectiveDate: '2026-11-01',
      customStorage: storage,
    });

    const t0 = Date.UTC(2026, 10, 1); // Nov 1 2026
    const reviewed = reviewLocalVerification({
      campaignId: camp.campaignId,
      officeId: 'delhi-south-collectorate',
      decision: 'APPROVE',
      reviewerId: 'admin-1',
      nowMs: t0,
      customStorage: storage,
    });

    const office = reviewed.offices[0];
    expect(office.verificationStatus).toBe('VERIFIED');
    expect(office.publicBadge).toBe('VERIFIED_FRESH');

    // 20 days later (10 days left <= 14-day window) -> EXPIRING_SOON
    const t20 = t0 + 20 * 24 * 60 * 60 * 1000;
    expect(computePublicBadge(office, t20)).toBe('EXPIRING_SOON');

    // 31 days later -> STALE_EXPIRED
    const t31 = t0 + 31 * 24 * 60 * 60 * 1000;
    const staleList = listLocalCampaigns(storage, t31);
    expect(staleList[0].offices[0].publicBadge).toBe('STALE_EXPIRED');
  });
});
