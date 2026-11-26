import { describe, it, expect, beforeEach } from 'vitest';
import {
  createShare,
  resolveShare,
  recordDownload,
  revokeShare,
  listShares,
  getShareAuditLog,
  validateCollaborationRequest,
  COLLAB_ERRORS,
  __testables,
} from './civicCaseCollaborationService.js';
import { listCases, listCaseItems, listRecipients, listShareTemplates, listScopes, listExpiryOptions, SHARE_STATUS } from '../data/civicCaseCollaborationData.js';

const { hashPasscode, constantTimeEqual, generateShareToken } = __testables;

const localStorageStore = {};
const mockLocalStorage = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => { localStorageStore[key] = value; },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

const ACTOR = { id: 'citizen-demo-001', username: 'citizen-demo', fullName: 'Citizen Demo', email: 'citizen@example.in' };
const VIEWER = { id: 'recipient-helper-001', username: 'helper-demo', fullName: 'Helper Demo', email: 'helper@example.in' };

describe('civicCaseCollaborationService', () => {
  describe('listings', () => {
    it('lists cases, items, recipients, templates, scopes, expiry', () => {
      expect(listCases().length).toBeGreaterThan(0);
      expect(listCaseItems().length).toBeGreaterThan(0);
      expect(listRecipients().length).toBeGreaterThan(0);
      expect(listShareTemplates().length).toBeGreaterThan(0);
      expect(listScopes().length).toBeGreaterThan(0);
      expect(Object.values(listExpiryOptions()).length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('rejects non-object', () => {
      expect(validateCollaborationRequest('x').valid).toBe(false);
    });
    it('rejects sensitive keys', () => {
      const r = validateCollaborationRequest({ aadhaar_number: '1234' });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.code === COLLAB_ERRORS.SENSITIVE_FIELD)).toBe(true);
    });
    it('rejects sensitive text', () => {
      const r = validateCollaborationRequest({ title: 'pan ABCDE1234F' });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.code === COLLAB_ERRORS.SENSITIVE_VALUE)).toBe(true);
    });
    it('rejects unknown item', () => {
      const r = validateCollaborationRequest({ itemIds: ['item-unknown'] });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.code === COLLAB_ERRORS.ITEM_NOT_FOUND)).toBe(true);
    });
    it('rejects bad scope', () => {
      expect(validateCollaborationRequest({ scope: 'full' }).valid).toBe(false);
    });
    it('accepts valid request', () => {
      expect(validateCollaborationRequest({ title: 'T', itemIds: ['item-income-cert-application'], scope: 'view-download' }).valid).toBe(true);
    });
  });

  describe('createShare', () => {
    it('requires auth', () => {
      const r = createShare({ title: 'T', itemIds: ['item-income-cert-application'] });
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe(COLLAB_ERRORS.AUTHENTICATION_REQUIRED);
    });
    it('creates a share', () => {
      const r = createShare({
        title: 'Test Share',
        caseId: 'case-income-certificate-2026',
        itemIds: ['item-income-cert-application', 'item-income-proof-payslip'],
        recipientEmail: 'helper@example.in',
        recipientId: 'recipient-helper-001',
        scope: 'view-download',
        expiryOption: '7d',
        maxViews: 5,
        accessPin: 'abcd1234',
        actor: ACTOR,
      });
      expect(r.ok).toBe(true);
      expect(r.share.id).toMatch(/^share-/);
      expect(r.share.noCitizenData).toBe(true);
      expect(r.share.illustrative).toBe(true);
      expect(r.share.status).toBe('ACTIVE');
    });
    it('rejects duplicate share id', () => {
      const r1 = createShare({ title: 'A', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], actor: ACTOR, shareId: 'share-dup' });
      const r2 = createShare({ title: 'B', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], actor: ACTOR, shareId: 'share-dup' });
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(false);
      expect(r2.error.code).toBe(COLLAB_ERRORS.VALIDATION_FAILED);
    });
  });

  describe('resolveShare', () => {
    let shareId;
    beforeEach(() => {
      const r = createShare({ title: 'Resolve', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], recipientEmail: 'helper@example.in', scope: 'view-download', maxViews: 3, actor: ACTOR });
      shareId = r.share.shareId;
    });

    it('resolves active share', () => {
      const r = resolveShare({ shareId, viewerId: VIEWER.id, viewerRole: 'recipient', actor: VIEWER });
      expect(r.ok).toBe(true);
      expect(r.status).toBe(SHARE_STATUS.ACTIVE);
      expect(r.view.itemSnapshot.length).toBeGreaterThan(0);
      expect(r.view.watermark).toContain('Civic Help Setu');
      expect(r.view.readOnly).toBe(true);
    });

    it('increments views and decrements remaining', () => {
      resolveShare({ shareId, viewerId: VIEWER.id, actor: VIEWER });
      const r2 = resolveShare({ shareId, viewerId: VIEWER.id, actor: VIEWER });
      expect(r2.view.viewCount).toBe(2);
      expect(r2.view.viewsRemaining).toBe(1);
    });

    it('blocks at view limit', () => {
      const one = createShare({ title: '1V', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], maxViews: 1, actor: ACTOR });
      resolveShare({ shareId: one.share.shareId, viewerId: VIEWER.id, actor: VIEWER });
      const r = resolveShare({ shareId: one.share.shareId, viewerId: VIEWER.id, actor: VIEWER });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(SHARE_STATUS.VIEW_LIMIT_REACHED);
    });

    it('requires passcode when set', () => {
      const p = createShare({ title: 'PIN', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], accessPin: 'abcd1234', actor: ACTOR });
      const r = resolveShare({ shareId: p.share.shareId, viewerId: VIEWER.id, actor: VIEWER });
      expect(r.ok).toBe(false);
      expect(r.pinRequired).toBe(true);
    });

    it('unlocks with correct passcode', () => {
      const p = createShare({ title: 'PIN2', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], accessPin: 'abcd1234', actor: ACTOR });
      const r = resolveShare({ shareId: p.share.shareId, viewerId: VIEWER.id, actor: VIEWER, pin: 'abcd1234' });
      expect(r.ok).toBe(true);
    });

    it('locks after max failed attempts', () => {
      const p = createShare({ title: 'LOCK', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], accessPin: 'abcd1234', actor: ACTOR });
      for (let i = 0; i < 5; i++) resolveShare({ shareId: p.share.shareId, viewerId: VIEWER.id, actor: VIEWER, pin: 'wrong' });
      const r = resolveShare({ shareId: p.share.shareId, viewerId: VIEWER.id, actor: VIEWER, pin: 'wrong' });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(SHARE_STATUS.LOCKED);
    });

    it('rejects revoked share', () => {
      revokeShare({ shareId, actor: ACTOR });
      const r = resolveShare({ shareId, viewerId: VIEWER.id, actor: VIEWER });
      expect(r.ok).toBe(false);
      expect(r.status).toBe(SHARE_STATUS.REVOKED);
    });

    it('rejects unknown share', () => {
      const r = resolveShare({ shareId: 'share-unknown', viewerId: VIEWER.id, actor: VIEWER });
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe(COLLAB_ERRORS.SHARE_NOT_FOUND);
    });
  });

  describe('recordDownload', () => {
    let shareId;
    beforeEach(() => {
      const r = createShare({ title: 'DL', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], scope: 'view-download', actor: ACTOR });
      shareId = r.share.shareId;
    });
    it('records download for view-download scope', () => {
      const r = recordDownload({ shareId, itemId: 'item-income-cert-application', viewerId: VIEWER.id, viewerRole: 'recipient', actor: VIEWER });
      expect(r.ok).toBe(true);
      expect(r.downloadCount).toBe(1);
      expect(r.watermark).toContain('Civic Help Setu');
    });
    it('denies download for view-only', () => {
      const vo = createShare({ title: 'VO', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], scope: 'view-only', actor: ACTOR });
      const r = recordDownload({ shareId: vo.share.shareId, itemId: 'item-income-cert-application', viewerId: VIEWER.id, actor: VIEWER });
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe(COLLAB_ERRORS.SCOPE_DENIED);
    });
  });

  describe('revokeShare', () => {
    it('requires auth', () => {
      expect(revokeShare({ shareId: 'share-x' }).ok).toBe(false);
    });
    it('revokes a share', () => {
      const r = createShare({ title: 'RV', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], actor: ACTOR });
      const rev = revokeShare({ shareId: r.share.shareId, actor: ACTOR });
      expect(rev.ok).toBe(true);
      expect(rev.status).toBe(SHARE_STATUS.REVOKED);
    });
  });

  describe('listShares / audit', () => {
    it('lists owner shares', () => {
      createShare({ title: 'L1', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], actor: ACTOR });
      const shares = listShares({ ownerId: ACTOR.id });
      expect(shares.length).toBeGreaterThan(0);
      expect(shares[0].illustrative).toBe(true);
    });
    it('returns audit log', () => {
      const r = createShare({ title: 'AU', caseId: 'case-income-certificate-2026', itemIds: ['item-income-cert-application'], actor: ACTOR });
      const log = getShareAuditLog({ shareId: r.share.shareId, actor: ACTOR });
      expect(log.ok).toBe(true);
      expect(Array.isArray(log.accessLog)).toBe(true);
    });
    it('requires auth for audit', () => {
      expect(getShareAuditLog({ shareId: 'share-x' }).ok).toBe(false);
    });
  });

  describe('crypto testables', () => {
    it('hashPasscode / constantTimeEqual / token', () => {
      const h1 = hashPasscode('abcd1234', 'salt');
      expect(hashPasscode('abcd1234', 'salt')).toBe(h1);
      expect(constantTimeEqual(h1, h1)).toBe(true);
      expect(constantTimeEqual(h1, 'x')).toBe(false);
      const t = generateShareToken();
      expect(t.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(t)).toBe(true);
    });
  });
});
