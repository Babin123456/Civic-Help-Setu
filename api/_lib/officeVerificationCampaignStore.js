/**
 * api/_lib/officeVerificationCampaignStore.js
 *
 * Bounded in-memory store for the Civic Office Contact Verification Campaign Manager (#1433).
 *
 * Invariants:
 *  - Max 500 campaigns; max 2,000 audit log entries.
 *  - Batch assignment of office contact records with configurable expiry policies.
 *  - Official-source evidence tracking (sourceUrl, jurisdiction, effectiveDate).
 *  - Reviewer approval workflow (admin / municipal_officer only).
 *  - Public stale badge computation based on expiry policy.
 */

import { randomBytes } from 'node:crypto';

const MAX_CAMPAIGNS = 500;
const MAX_AUDIT_LOGS = 2000;
const EXPIRING_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const PUBLIC_STALE_BADGE = Object.freeze({
  VERIFIED_FRESH: 'VERIFIED_FRESH',
  EXPIRING_SOON: 'EXPIRING_SOON',
  STALE_EXPIRED: 'STALE_EXPIRED',
  UNVERIFIED: 'UNVERIFIED',
});

export function computePublicStaleBadge(officeRecord, nowMs = Date.now()) {
  if (!officeRecord || officeRecord.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    return PUBLIC_STALE_BADGE.UNVERIFIED;
  }
  const expiresMs = officeRecord.expiresAt ? new Date(officeRecord.expiresAt).getTime() : 0;
  if (!expiresMs || expiresMs <= nowMs) {
    return PUBLIC_STALE_BADGE.STALE_EXPIRED;
  }
  if (expiresMs - nowMs <= EXPIRING_SOON_WINDOW_MS) {
    return PUBLIC_STALE_BADGE.EXPIRING_SOON;
  }
  return PUBLIC_STALE_BADGE.VERIFIED_FRESH;
}

export class InMemoryOfficeVerificationCampaignStore {
  constructor() {
    this._campaigns = new Map();
    this._auditLogs = [];
  }

  _evictIfFull() {
    if (this._campaigns.size >= MAX_CAMPAIGNS) {
      const oldestKey = this._campaigns.keys().next().value;
      if (oldestKey) this._campaigns.delete(oldestKey);
    }
  }

  _appendAudit(entry) {
    if (this._auditLogs.length >= MAX_AUDIT_LOGS) {
      this._auditLogs.shift();
    }
    this._auditLogs.push({
      auditId: `aud_${randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }

  createCampaign({
    title,
    jurisdiction = 'All',
    assigneeId,
    officeIds = [],
    expiryPolicyDays = 180,
    createdBy,
  }) {
    this._evictIfFull();
    const campaignId = `camp_${randomBytes(6).toString('hex')}`;
    const createdAt = new Date().toISOString();

    const offices = {};
    for (const id of officeIds) {
      offices[id] = {
        officeId: id,
        verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
        evidence: null,
        lastVerifiedAt: null,
        expiresAt: null,
        reviewedBy: null,
        reviewRationale: null,
      };
    }

    const campaign = {
      campaignId,
      title,
      jurisdiction,
      assigneeId,
      expiryPolicyDays: Number(expiryPolicyDays || 180),
      createdBy,
      createdAt,
      offices,
    };

    this._campaigns.set(campaignId, campaign);
    this._appendAudit({
      action: 'CAMPAIGN_CREATED',
      campaignId,
      actorId: createdBy,
      assigneeId,
      officeCount: officeIds.length,
      expiryPolicyDays: campaign.expiryPolicyDays,
    });

    return this._formatCampaign(campaign);
  }

  _formatCampaign(campaign, nowMs = Date.now()) {
    const officeList = Object.values(campaign.offices).map((o) => ({
      ...o,
      publicBadge: computePublicStaleBadge(o, nowMs),
    }));
    return {
      ...campaign,
      offices: officeList,
    };
  }

  listCampaigns({ jurisdiction = null, nowMs = Date.now() } = {}) {
    const list = [];
    for (const c of this._campaigns.values()) {
      if (jurisdiction && c.jurisdiction !== jurisdiction) continue;
      list.push(this._formatCampaign(c, nowMs));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  submitEvidence({
    campaignId,
    officeId,
    verifierId,
    sourceUrl,
    effectiveDate,
    jurisdiction,
    provenanceKind = 'official_record',
    notes = '',
  }) {
    const campaign = this._campaigns.get(campaignId);
    if (!campaign) return { ok: false, status: 404, error: 'Campaign not found' };
    const office = campaign.offices[officeId];
    if (!office) return { ok: false, status: 404, error: 'Office not assigned to this campaign' };

    office.verificationStatus = VERIFICATION_STATUS.PENDING_REVIEW;
    office.evidence = {
      sourceUrl,
      effectiveDate,
      jurisdiction: jurisdiction || campaign.jurisdiction,
      provenanceKind,
      notes,
      submittedBy: verifierId,
      submittedAt: new Date().toISOString(),
    };

    this._appendAudit({
      action: 'EVIDENCE_SUBMITTED',
      campaignId,
      officeId,
      actorId: verifierId,
      sourceUrl,
      provenanceKind,
    });

    return { ok: true, status: 200, campaign: this._formatCampaign(campaign) };
  }

  reviewVerification({
    campaignId,
    officeId,
    reviewerId,
    decision,
    rationale = '',
    nowMs = Date.now(),
  }) {
    const campaign = this._campaigns.get(campaignId);
    if (!campaign) return { ok: false, status: 404, error: 'Campaign not found' };
    const office = campaign.offices[officeId];
    if (!office) return { ok: false, status: 404, error: 'Office not assigned to this campaign' };
    if (!office.evidence) {
      return { ok: false, status: 400, error: 'Official-source evidence must be submitted before review' };
    }

    const approved = decision === 'APPROVE';
    office.verificationStatus = approved ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.REJECTED;
    office.reviewedBy = reviewerId;
    office.reviewRationale = rationale;

    if (approved) {
      office.lastVerifiedAt = new Date(nowMs).toISOString();
      office.expiresAt = new Date(nowMs + campaign.expiryPolicyDays * 24 * 60 * 60 * 1000).toISOString();
    } else {
      office.expiresAt = null;
    }

    this._appendAudit({
      action: approved ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      campaignId,
      officeId,
      actorId: reviewerId,
      expiresAt: office.expiresAt,
      rationale,
    });

    return { ok: true, status: 200, campaign: this._formatCampaign(campaign, nowMs) };
  }

  getAuditLog({ limit = 100 } = {}) {
    return [...this._auditLogs].reverse().slice(0, limit);
  }

  clear() {
    this._campaigns.clear();
    this._auditLogs.length = 0;
  }
}

let _prodStore = null;
export function getProductionOfficeVerificationCampaignStore() {
  if (!_prodStore) {
    _prodStore = new InMemoryOfficeVerificationCampaignStore();
  }
  return _prodStore;
}
