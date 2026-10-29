import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CLAIM_FIELDS,
  CONFLICT_STATUS,
  getAllSourceConflicts,
  getUnresolvedConflictsForService,
  recordSourceConflict,
  resolveSourceConflict,
  reopenSourceConflict,
  getConflictAuditLogs,
  SOURCE_CONFLICTS_STORAGE_KEY,
  CONFLICT_AUDIT_LOGS_KEY,
} from './sourceConflictService';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

const makeStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, val) => store.set(key, String(val))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
};

describe('Civic Source Conflict and Confidence Review Queue Service (#149)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('Multi-Source Reference Storage & Conflict Registration', () => {
    it('records multiple source citations per key claim and marks as unresolved', () => {
      const conflict = recordSourceConflict(
        {
          serviceId: 'birth-certificate',
          serviceName: 'Birth Certificate',
          claimField: CLAIM_FIELDS.FEES,
          description: 'Gazette notification 2025 contradicts older 2020 municipal order.',
          sources: [
            {
              sourceName: 'Delhi Gazette Notification No. 44/2025',
              claimedValue: '₹50 flat statutory fee',
              sourceUrl: 'https://delhi.gov.in/gazette-2025.pdf',
              publicationDate: '2025-10-12',
              confidenceTier: 'high',
            },
            {
              sourceName: 'e-District Delhi Citizen Charter',
              claimedValue: '₹100 + ₹20 service charge',
              sourceUrl: 'https://edistrict.delhigovt.nic.in/fees',
              publicationDate: '2023-01-05',
              confidenceTier: 'medium',
            },
          ],
          actor: 'Senior Civic Researcher',
        },
        mockStorage
      );

      expect(conflict).toBeDefined();
      expect(conflict.id).toMatch(/^conflict_\d+/);
      expect(conflict.serviceId).toBe('birth-certificate');
      expect(conflict.claimField).toBe(CLAIM_FIELDS.FEES);
      expect(conflict.status).toBe(CONFLICT_STATUS.UNRESOLVED);
      expect(conflict.requiresManualReview).toBe(true);
      expect(conflict.sources).toHaveLength(2);
      expect(conflict.sources[0].sourceName).toContain('Gazette Notification');
      expect(conflict.sources[1].claimedValue).toContain('₹100');

      // Verify persistence
      const all = getAllSourceConflicts(mockStorage);
      expect(all).toHaveLength(1);
    });

    it('rejects conflict registration with fewer than 2 sources or invalid fields', () => {
      expect(() =>
        recordSourceConflict(
          {
            serviceId: 'driving-license',
            claimField: CLAIM_FIELDS.FEES,
            sources: [{ sourceName: 'Single Source', claimedValue: '₹500' }],
          },
          mockStorage
        )
      ).toThrow('A conflict requires at least two conflicting source references');

      expect(() =>
        recordSourceConflict(
          {
            serviceId: '',
            claimField: CLAIM_FIELDS.FEES,
            sources: [
              { sourceName: 'S1', claimedValue: 'A' },
              { sourceName: 'S2', claimedValue: 'B' },
            ],
          },
          mockStorage
        )
      ).toThrow('Service ID is required');
    });
  });

  describe('Unresolved Caution Banner Triggering', () => {
    it('detects unresolved conflicts for a specific service to trigger UI caution banner', () => {
      recordSourceConflict(
        {
          serviceId: 'driving-license',
          claimField: CLAIM_FIELDS.PROCESSING_TIME,
          sources: [
            { sourceName: 'Parivahan SLA Manual', claimedValue: '7 working days' },
            { sourceName: 'State Transport FAQ', claimedValue: '30 working days' },
          ],
        },
        mockStorage
      );

      const unresolved = getUnresolvedConflictsForService('driving-license', mockStorage);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].claimField).toBe(CLAIM_FIELDS.PROCESSING_TIME);

      // Clean service without conflicts returns empty array
      const cleanService = getUnresolvedConflictsForService('unrelated-service', mockStorage);
      expect(cleanService).toEqual([]);
    });
  });

  describe('Human Review Adjudication & Prevention of Scraped Auto-Resolution', () => {
    it('allows a human reviewer to resolve conflict with authoritative value, rationale, and review date', () => {
      const conflict = recordSourceConflict(
        {
          serviceId: 'passport-renewal',
          claimField: CLAIM_FIELDS.FEES,
          sources: [
            { sourceName: 'MEA Official Notification 2026', claimedValue: '₹1,500' },
            { sourceName: 'Outdated Regional Portal FAQ', claimedValue: '₹2,000' },
          ],
        },
        mockStorage
      );

      const resolved = resolveSourceConflict(
        {
          conflictId: conflict.id,
          chosenValue: '₹1,500 (Standard 36-page booklet)',
          resolutionNotes:
            'MEA Gazette 2026 takes precedence over third-party circular; verified with Regional Passport Officer.',
          reviewerName: 'Priya Sharma',
          reviewerRole: 'Editorial Lead',
          isAutomatedScraper: false,
        },
        mockStorage
      );

      expect(resolved.status).toBe(CONFLICT_STATUS.RESOLVED);
      expect(resolved.resolvedValue).toBe('₹1,500 (Standard 36-page booklet)');
      expect(resolved.resolvedBy).toBe('Priya Sharma (Editorial Lead)');
      expect(resolved.resolvedAt).toBeDefined();

      // Ensure it no longer appears as unresolved on service page
      const unresolvedAfter = getUnresolvedConflictsForService('passport-renewal', mockStorage);
      expect(unresolvedAfter).toHaveLength(0);
    });

    it('strictly forbids automated scrapers from resolving conflicts without human review', () => {
      const conflict = recordSourceConflict(
        {
          serviceId: 'passport-renewal',
          claimField: CLAIM_FIELDS.DEADLINE_OR_RENEWAL,
          sources: [
            { sourceName: 'Doc A', claimedValue: '1 Year' },
            { sourceName: 'Doc B', claimedValue: '3 Years' },
          ],
        },
        mockStorage
      );

      expect(() =>
        resolveSourceConflict(
          {
            conflictId: conflict.id,
            chosenValue: '1 Year',
            resolutionNotes: 'Scraper picked the most frequent string in crawl',
            isAutomatedScraper: true, // Automated scraper attempt
          },
          mockStorage
        )
      ).toThrow(/Automated resolution based solely on scraped text is strictly prohibited/);
    });

    it('requires resolution notes of sufficient length', () => {
      const conflict = recordSourceConflict(
        {
          serviceId: 'pan-card',
          claimField: CLAIM_FIELDS.FEES,
          sources: [
            { sourceName: 'A', claimedValue: '₹107' },
            { sourceName: 'B', claimedValue: '₹101' },
          ],
        },
        mockStorage
      );

      expect(() =>
        resolveSourceConflict(
          {
            conflictId: conflict.id,
            chosenValue: '₹107',
            resolutionNotes: '', // Missing rationale
          },
          mockStorage
        )
      ).toThrow('Reviewer resolution notes explaining the decision rationale are mandatory');
    });
  });

  describe('Auditable Verification State History', () => {
    it('creates immutable audit trail entries upon conflict creation and resolution', () => {
      const conflict = recordSourceConflict(
        {
          serviceId: 'income-certificate',
          claimField: CLAIM_FIELDS.ELIGIBILITY_CRITERIA,
          sources: [
            { sourceName: 'Source 1', claimedValue: 'Annual income under ₹1,00,000' },
            { sourceName: 'Source 2', claimedValue: 'Annual income under ₹2,50,000' },
          ],
          actor: 'Auditor Alpha',
        },
        mockStorage
      );

      let logs = getConflictAuditLogs(mockStorage);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].action).toBe('CONFLICT_RECORDED');
      expect(logs[0].actor).toBe('Auditor Alpha');

      resolveSourceConflict(
        {
          conflictId: conflict.id,
          chosenValue: 'Annual income under ₹2,50,000',
          resolutionNotes: 'Updated by social welfare ministry amendment in 2026.',
          reviewerName: 'Reviewer Beta',
        },
        mockStorage
      );

      logs = getConflictAuditLogs(mockStorage);
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs[0].action).toBe('CONFLICT_RESOLVED');
      expect(logs[0].chosenValue).toBe('Annual income under ₹2,50,000');
      expect(logs[0].actor).toBe('Reviewer Beta');
    });

    it('supports reopening a resolved conflict when new conflicting evidence is surfaced', () => {
      const conflict = recordSourceConflict(
        {
          serviceId: 'caste-certificate',
          claimField: CLAIM_FIELDS.MANDATORY_DOCUMENTS,
          sources: [
            { sourceName: 'Portal A', claimedValue: '1950 proof required' },
            { sourceName: 'Portal B', claimedValue: 'Self-attested affidavit suffices' },
          ],
        },
        mockStorage
      );

      resolveSourceConflict(
        {
          conflictId: conflict.id,
          chosenValue: '1950 proof required',
          resolutionNotes: 'Standard court directive.',
        },
        mockStorage
      );

      reopenSourceConflict(
        {
          conflictId: conflict.id,
          reopenReason: 'New High Court stay order issued on 1950 requirement.',
          actor: 'Legal Researcher',
        },
        mockStorage
      );

      const unresolved = getUnresolvedConflictsForService('caste-certificate', mockStorage);
      expect(unresolved).toHaveLength(1);

      const logs = getConflictAuditLogs(mockStorage);
      expect(logs[0].action).toBe('CONFLICT_REOPENED');
      expect(logs[0].notes).toContain('High Court stay order');
    });
  });
});
