import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGrievanceDraft,
  updateGrievanceDraft,
  deleteGrievanceDraft,
  getGrievanceDraftById,
  listGrievanceDrafts,
  addTimelineEvent,
  removeTimelineEvent,
  toggleEvidenceCheck,
  addCustomEvidenceItem,
  validateGrievanceDraft,
  exportGrievanceDossier,
  GRIEVANCE_EVIDENCE_STORAGE_KEY,
} from './grievanceEvidenceService.js';

const createMockStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
};

describe('grievanceEvidenceService (#143)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  describe('CRUD Operations & User Scoping', () => {
    it('creates, retrieves, and updates a grievance preparation draft', () => {
      const created = createGrievanceDraft(
        {
          title: 'Delayed Passport Dispatch',
          department: 'Regional Passport Office (RPO)',
          officialReferenceNumbers: ['ARN-1234567890'],
          issueSummary: 'Police verification cleared 40 days ago but dispatch is stalled without notice.',
          reliefSought: 'Expedited printing and dispatch of passport booklet.',
        },
        'user_1',
        mockStorage
      );

      expect(created.id).toMatch(/^GRV-DRAFT-/);
      expect(created.userId).toBe('user_1');
      expect(created.title).toBe('Delayed Passport Dispatch');
      expect(created.officialReferenceNumbers).toEqual(['ARN-1234567890']);
      expect(created.timeline.length).toBeGreaterThan(0);
      expect(created.evidenceChecklist.length).toBeGreaterThan(0);

      // Retrieve by ID
      const retrieved = getGrievanceDraftById(created.id, 'user_1', mockStorage);
      expect(retrieved).not.toBeNull();
      expect(retrieved.department).toBe('Regional Passport Office (RPO)');

      // Update draft
      const updated = updateGrievanceDraft(
        created.id,
        { reliefSought: 'Immediate dispatch and explanation for SLA breach.' },
        'user_1',
        mockStorage
      );
      expect(updated.reliefSought).toBe('Immediate dispatch and explanation for SLA breach.');
    });

    it('scopes draft access and prevents cross-user access', () => {
      const draftUser1 = createGrievanceDraft({ title: 'User 1 Complaint' }, 'user_1', mockStorage);
      const draftUser2 = createGrievanceDraft({ title: 'User 2 Complaint' }, 'user_2', mockStorage);

      const user1List = listGrievanceDrafts('user_1', mockStorage);
      expect(user1List.map((d) => d.id)).toContain(draftUser1.id);
      expect(user1List.map((d) => d.id)).not.toContain(draftUser2.id);

      // User 2 cannot access user 1's draft
      const crossAccess = getGrievanceDraftById(draftUser1.id, 'user_2', mockStorage);
      expect(crossAccess).toBeNull();
    });

    it('covers deletion of drafts correctly', () => {
      const draft = createGrievanceDraft({ title: 'To Be Deleted' }, 'user_1', mockStorage);
      expect(listGrievanceDrafts('user_1', mockStorage).length).toBe(1);

      // Delete draft
      const deleted = deleteGrievanceDraft(draft.id, 'user_1', mockStorage);
      expect(deleted).toBe(true);
      expect(listGrievanceDrafts('user_1', mockStorage).length).toBe(0);

      // Deleting already deleted or non-existent draft returns false
      const nonExistent = deleteGrievanceDraft('non-existent-id', 'user_1', mockStorage);
      expect(nonExistent).toBe(false);
    });
  });

  describe('Timeline & Evidence Checklist Management', () => {
    it('adds and removes dated events in chronological timeline', () => {
      const draft = createGrievanceDraft({ title: 'Timeline Test' }, 'user_1', mockStorage);
      const initialTimelineCount = draft.timeline.length;

      // Add event
      const updated = addTimelineEvent(
        draft.id,
        {
          date: '2026-03-01',
          title: 'Spoke with Public Grievance Officer',
          notes: 'Officer promised resolution within 3 days.',
        },
        'user_1',
        mockStorage
      );

      expect(updated.timeline.length).toBe(initialTimelineCount + 1);
      const addedEvent = updated.timeline.find((e) => e.title.includes('Spoke with Public Grievance'));
      expect(addedEvent).toBeDefined();
      expect(addedEvent.date).toBe('2026-03-01');

      // Remove event
      const afterRemoval = removeTimelineEvent(draft.id, addedEvent.id, 'user_1', mockStorage);
      expect(afterRemoval.timeline.length).toBe(initialTimelineCount);
    });

    it('toggles evidence checklist completion and adds custom evidence items', () => {
      const draft = createGrievanceDraft({ title: 'Evidence Test' }, 'user_1', mockStorage);
      const firstItem = draft.evidenceChecklist[0];
      expect(firstItem.completed).toBe(false);

      // Toggle complete
      const afterToggle = toggleEvidenceCheck(draft.id, firstItem.id, true, 'user_1', mockStorage);
      const updatedItem = afterToggle.evidenceChecklist.find((i) => i.id === firstItem.id);
      expect(updatedItem.completed).toBe(true);

      // Add custom item
      const afterCustom = addCustomEvidenceItem(draft.id, 'CCTV footage of enquiry counter', 'user_1', mockStorage);
      const customItem = afterCustom.evidenceChecklist.find((i) => i.label.includes('CCTV footage'));
      expect(customItem).toBeDefined();
      expect(customItem.completed).toBe(false);
    });
  });

  describe('Draft Validation & Empty Drafts', () => {
    it('covers empty drafts and reports validation errors', () => {
      const emptyNull = validateGrievanceDraft(null);
      expect(emptyNull.isValid).toBe(false);
      expect(emptyNull.errors.length).toBeGreaterThan(0);

      const emptyDraft = validateGrievanceDraft({
        title: '',
        department: '',
        issueSummary: '',
      });

      expect(emptyDraft.isValid).toBe(false);
      expect(emptyDraft.errors.some((e) => e.includes('Grievance title is required'))).toBe(true);
      expect(emptyDraft.errors.some((e) => e.includes('Department or public authority is required'))).toBe(true);
      expect(emptyDraft.errors.some((e) => e.includes('Issue summary must provide at least 10 characters'))).toBe(true);
    });
  });

  describe('Export Dossier - Privacy & Acceptance Criteria', () => {
    it('covers export with clear preparation disclaimers and structured details', () => {
      const draft = createGrievanceDraft(
        {
          title: 'Unlawful Fee Overcharge at Tehsil Office',
          department: 'Revenue & Land Records',
          officialReferenceNumbers: ['CHALLAN-8899', 'SLIP-102'],
          issueSummary: 'Citizen was charged ₹500 against official statutory fee of ₹50 without official receipt.',
          reliefSought: 'Refund of excess amount and departmental audit.',
        },
        'user_1',
        mockStorage
      );

      const dossier = exportGrievanceDossier(draft);
      expect(dossier).toContain('# GRIEVANCE EVIDENCE PREPARATION DOSSIER');
      expect(dossier).toContain('IMPORTANT NOTICE & LEGAL DISCLAIMER');
      // Verifies distinction from officially filed grievance
      expect(dossier).toContain('DOES NOT constitute an officially filed government grievance');
      expect(dossier).toContain('CPGRAMS (https://pgportal.gov.in)');
      expect(dossier).toContain('CHALLAN-8899, SLIP-102');
      expect(dossier).toContain('Chronological Event Timeline');
      expect(dossier).toContain('Supporting Evidence Checklist');
      expect(dossier).toContain('Prepared privately on device with Civic Help Setu');
    });

    it('returns empty string if draft is null', () => {
      expect(exportGrievanceDossier(null)).toBe('');
    });
  });
});
