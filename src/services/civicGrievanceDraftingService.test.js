import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateGrievanceDraft,
  getStoredGrievanceDrafts,
  saveGrievanceDraft,
  deleteGrievanceDraft,
  GRIEVANCE_STORAGE_KEY,
  GRIEVANCE_CATEGORIES,
  RESOLUTION_TYPES,
} from './civicGrievanceDraftingService';

describe('civicGrievanceDraftingService (#404)', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => {
        store[key] = String(val);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    });
  });

  it('exports valid categories and resolution types', () => {
    expect(GRIEVANCE_CATEGORIES.length).toBeGreaterThan(5);
    expect(RESOLUTION_TYPES.length).toBeGreaterThan(3);
    expect(GRIEVANCE_CATEGORIES).toContain('Roads, Potholes & Footpaths');
  });

  it('rejects generation when issue description is missing', () => {
    const res = generateGrievanceDraft({ category: 'Roads, Potholes & Footpaths' });
    expect(res.isValid).toBe(false);
    expect(res.error).toMatch(/description/i);
    expect(res.draftText).toBe('');
  });

  it('rejects generation when issue description is only whitespace', () => {
    const res = generateGrievanceDraft({ issueDescription: '   \n  ' });
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('generates a complete draft when all facts are provided without hallucinations', () => {
    const facts = {
      category: 'Water Supply & Contamination',
      issueDescription: 'Pipeline broken near community center resulting in contaminated mud water for 4 days.',
      departmentName: 'Delhi Jal Board',
      location: 'Ward 45, Sector 12, Rohini',
      incidentDate: '28th October 2026',
      previousRefNumber: 'DJB-2026-9912',
      requestedResolution: 'Immediate dispatch of repair team and provision of clean drinking water tankers.',
      evidenceList: ['Water test report showing turbidity', 'Photographs of leaked pipeline'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    expect(draft.isValid).toBe(true);
    expect(draft.category).toBe('Water Supply & Contamination');
    expect(draft.draftText).toContain('Delhi Jal Board');
    expect(draft.draftText).toContain('Ward 45, Sector 12, Rohini');
    expect(draft.draftText).toContain('DJB-2026-9912');
    expect(draft.draftText).toContain('Pipeline broken near community center');
    expect(draft.draftText).toContain('Water test report showing turbidity');
    expect(draft.draftText).toContain('Ramesh Sharma');
    expect(draft.draftText).toContain('9876543210');
    expect(draft.hasUnstatedFacts).toBe(false);
    expect(draft.placeholdersCount).toBe(0);
    expect(draft.disclaimer).toMatch(/Drafting Tool Notice/i);
    expect(draft.disclaimer).toMatch(/does NOT submit/i);
  });

  it('converts missing or omitted facts into transparent bracketed placeholders', () => {
    const partialFacts = {
      issueDescription: 'Streetlights have been non-functional causing safety hazards at night.',
    };

    const draft = generateGrievanceDraft(partialFacts);
    expect(draft.isValid).toBe(true);
    expect(draft.hasUnstatedFacts).toBe(true);
    expect(draft.placeholdersCount).toBeGreaterThan(0);
    // Check that explicit bracketed guidance exists for unprovided details
    expect(draft.draftText).toContain('[Location unstated]');
    expect(draft.draftText).toContain('[Exact street, ward, or office address not specified');
    expect(draft.draftText).toContain('[Date or duration of problem not specified');
    expect(draft.draftText).toContain('[Specify remedy');
    expect(draft.draftText).toContain('[No documents listed by user');
    // Ensure citizen anonymity default
    expect(draft.draftText).toContain('[Name omitted by citizen]');
    expect(draft.draftText).not.toContain('Contact:');
  });

  it('persists, retrieves, and deletes drafts using registered localStorage key', () => {
    const draft1 = generateGrievanceDraft({
      issueDescription: 'Pothole issue on Main Road',
    });
    draft1.id = 'draft-test-1';

    const saveSuccess = saveGrievanceDraft(draft1);
    expect(saveSuccess).toBe(true);

    const stored = getStoredGrievanceDrafts();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('draft-test-1');
    expect(localStorage.getItem(GRIEVANCE_STORAGE_KEY)).toContain('draft-test-1');

    // Delete
    const deleteSuccess = deleteGrievanceDraft('draft-test-1');
    expect(deleteSuccess).toBe(true);
    expect(getStoredGrievanceDrafts().length).toBe(0);
  });
});
