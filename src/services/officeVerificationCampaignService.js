/**
 * src/services/officeVerificationCampaignService.js
 *
 * Client-side service for Civic Office Contact Verification Campaigns (#1433).
 * Integrates with CIVIC_OFFICES (locationOffices.js) and provides batch
 * assignment, official-source evidence tracking, reviewer approval, expiry
 * policies, public stale badges, and zero-PII enforcement.
 */

import { CIVIC_OFFICES } from '../data/locationOffices.js';

export const CAMPAIGN_STORAGE_KEY = 'civicbridge_office_verification_campaigns_v1';
export const EXPIRY_POLICY_PRESETS = Object.freeze([
  { days: 30, label: '30 days (High-change offices)' },
  { days: 90, label: '90 days (Quarterly)' },
  { days: 180, label: '180 days (Standard)' },
  { days: 365, label: '365 days (Annual)' },
]);

export const PUBLIC_BADGE_LABELS = Object.freeze({
  VERIFIED_FRESH: 'Verified & Fresh',
  EXPIRING_SOON: 'Expiring Soon',
  STALE_EXPIRED: 'Stale — Re-verification Due',
  UNVERIFIED: 'Unverified',
});

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function hasForbiddenPII(text = '') {
  const s = String(text || '');
  return AADHAAR_RE.test(s) || PAN_RE.test(s);
}

export function isOfficialSourceUrl(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function computePublicBadge(officeRecord, nowMs = Date.now()) {
  if (!officeRecord || officeRecord.verificationStatus !== 'VERIFIED') {
    return 'UNVERIFIED';
  }
  const exp = officeRecord.expiresAt ? new Date(officeRecord.expiresAt).getTime() : 0;
  if (!exp || exp <= nowMs) return 'STALE_EXPIRED';
  if (exp - nowMs <= 14 * 24 * 60 * 60 * 1000) return 'EXPIRING_SOON';
  return 'VERIFIED_FRESH';
}

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listLocalCampaigns(customStorage = null, nowMs = Date.now()) {
  const store = getStorage(customStorage);
  if (!store) return [];
  try {
    const raw = store.getItem(CAMPAIGN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      ...c,
      offices: (c.offices || []).map((o) => ({
        ...o,
        publicBadge: computePublicBadge(o, nowMs),
      })),
    }));
  } catch {
    return [];
  }
}

function saveLocalCampaigns(campaigns, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return false;
  try {
    store.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaigns));
    return true;
  } catch {
    return false;
  }
}

export function createLocalCampaign({
  title,
  jurisdiction = 'All',
  assigneeId = 'verifier_team_1',
  officeIds = [],
  expiryPolicyDays = 180,
  customStorage = null,
}) {
  if (!title || !title.trim()) throw new Error('Campaign title is required.');
  if (!Array.isArray(officeIds) || officeIds.length === 0) {
    throw new Error('Select at least one office for batch assignment.');
  }
  if (hasForbiddenPII(title)) throw new Error('Campaign title must not contain Aadhaar or PAN.');

  const offices = officeIds.map((id) => {
    const match = CIVIC_OFFICES.find((o) => o.id === id);
    return {
      officeId: id,
      officeName: match?.name || id,
      jurisdiction: match?.state || jurisdiction,
      verificationStatus: 'UNVERIFIED',
      evidence: null,
      lastVerifiedAt: null,
      expiresAt: null,
      publicBadge: 'UNVERIFIED',
    };
  });

  const campaign = {
    campaignId: `camp_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    title: title.trim(),
    jurisdiction,
    assigneeId,
    expiryPolicyDays: Number(expiryPolicyDays || 180),
    createdAt: new Date().toISOString(),
    offices,
  };

  const all = listLocalCampaigns(customStorage);
  all.unshift(campaign);
  saveLocalCampaigns(all, customStorage);
  return campaign;
}

export function submitLocalEvidence({
  campaignId,
  officeId,
  sourceUrl,
  effectiveDate,
  notes = '',
  provenanceKind = 'official_record',
  customStorage = null,
}) {
  if (!isOfficialSourceUrl(sourceUrl)) {
    throw new Error('Valid http(s) official source URL is required.');
  }
  if (hasForbiddenPII(notes)) {
    throw new Error('Evidence notes must not contain Aadhaar or PAN.');
  }

  const all = listLocalCampaigns(customStorage);
  const c = all.find((x) => x.campaignId === campaignId);
  if (!c) throw new Error('Campaign not found.');
  const o = c.offices.find((x) => x.officeId === officeId);
  if (!o) throw new Error('Office not found in campaign.');

  o.verificationStatus = 'PENDING_REVIEW';
  o.evidence = {
    sourceUrl: sourceUrl.trim(),
    effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
    provenanceKind,
    notes: notes.trim(),
    submittedAt: new Date().toISOString(),
  };

  saveLocalCampaigns(all, customStorage);
  return c;
}

export function reviewLocalVerification({
  campaignId,
  officeId,
  decision,
  reviewerId = 'admin_local',
  rationale = '',
  nowMs = Date.now(),
  customStorage = null,
}) {
  const all = listLocalCampaigns(customStorage, nowMs);
  const c = all.find((x) => x.campaignId === campaignId);
  if (!c) throw new Error('Campaign not found.');
  const o = c.offices.find((x) => x.officeId === officeId);
  if (!o) throw new Error('Office not found in campaign.');
  if (!o.evidence) throw new Error('Official-source evidence is required before review.');

  if (decision === 'APPROVE') {
    o.verificationStatus = 'VERIFIED';
    o.lastVerifiedAt = new Date(nowMs).toISOString();
    o.expiresAt = new Date(nowMs + c.expiryPolicyDays * 24 * 60 * 60 * 1000).toISOString();
  } else {
    o.verificationStatus = 'REJECTED';
    o.expiresAt = null;
  }
  o.reviewedBy = reviewerId;
  o.reviewRationale = rationale;
  o.publicBadge = computePublicBadge(o, nowMs);

  saveLocalCampaigns(all, customStorage);
  return c;
}
