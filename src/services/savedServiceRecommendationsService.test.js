import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRelatedServiceRecommendations,
  dismissRecommendation,
  restoreRecommendation,
  clearDismissedRecommendations,
  getDismissedRecommendations
} from './savedServiceRecommendationsService';

describe('savedServiceRecommendationsService', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear()
    });
  });

  const mockCatalogue = [
    {
      id: 'caste-certificate',
      name: 'Caste Certificate',
      category: 'Certificates',
      department: 'Revenue & Social Welfare'
    },
    {
      id: 'non-creamy-layer-certificate',
      name: 'Non-Creamy Layer Certificate',
      category: 'Certificates',
      department: 'Revenue & Social Welfare'
    },
    {
      id: 'income-certificate',
      name: 'Income Certificate',
      category: 'Certificates',
      department: 'Revenue Department'
    },
    {
      id: 'ration-card',
      name: 'Ration Card',
      category: 'Social Welfare',
      department: 'Food & Civil Supplies'
    },
    {
      id: 'driving-license',
      name: 'Driving License',
      category: 'Transport',
      department: 'Transport Department'
    },
    {
      id: 'incomplete-service',
      name: 'Incomplete Service Record'
      // Missing category and department
    }
  ];

  it('recommends curated follow-up service with verified relationship wording', () => {
    const saved = [{ id: 'caste-certificate', name: 'Caste Certificate' }];
    const recs = getRelatedServiceRecommendations(saved, mockCatalogue);

    expect(recs.length).toBeGreaterThan(0);
    const ncl = recs.find((r) => r.service.id === 'non-creamy-layer-certificate');
    expect(ncl).toBeDefined();
    expect(ncl.relationshipLabel).toContain('Often needed after');
    expect(ncl.evidenceGrounding).toBe('curated_rule');
  });

  it('recommends curated prerequisite when downstream service is saved', () => {
    const saved = [{ id: 'non-creamy-layer-certificate', name: 'Non-Creamy Layer Certificate' }];
    const recs = getRelatedServiceRecommendations(saved, mockCatalogue);

    const caste = recs.find((r) => r.service.id === 'caste-certificate');
    expect(caste).toBeDefined();
    expect(caste.relationshipLabel).toContain('Often needed before');
  });

  it('uses neutral wording for category matches and never infers legal prerequisite from similarity alone', () => {
    // Both Driving License and another transport service
    const transportCatalogue = [
      ...mockCatalogue,
      {
        id: 'road-tax-payment',
        name: 'Road Tax Payment',
        category: 'Transport',
        department: 'Transport Department'
      }
    ];

    const saved = [{ id: 'driving-license', name: 'Driving License', category: 'Transport', department: 'Transport Department' }];
    const recs = getRelatedServiceRecommendations(saved, transportCatalogue);

    const roadTax = recs.find((r) => r.service.id === 'road-tax-payment');
    expect(roadTax).toBeDefined();
    // Must be neutral wording, NOT "prerequisite" or "needed before"
    expect(roadTax.relationshipLabel).toBe('Similar Category & Department');
    expect(roadTax.evidenceGrounding).toBe('metadata');
    expect(roadTax.relationshipLabel).not.toContain('prerequisite');
  });

  it('never recommends services that are already saved by the user', () => {
    const saved = [
      { id: 'caste-certificate', name: 'Caste Certificate' },
      { id: 'non-creamy-layer-certificate', name: 'Non-Creamy Layer Certificate' }
    ];

    const recs = getRelatedServiceRecommendations(saved, mockCatalogue);
    const recommendedIds = recs.map((r) => r.service.id);
    expect(recommendedIds).not.toContain('caste-certificate');
    expect(recommendedIds).not.toContain('non-creamy-layer-certificate');
  });

  it('does not recommend incomplete or unrelated records when evidence is insufficient', () => {
    const saved = [{ id: 'unrelated-scheme', name: 'Random Scheme', category: 'Space Research', department: 'ISRO' }];
    const recs = getRelatedServiceRecommendations(saved, mockCatalogue);

    // No curated match and no matching department/category
    expect(recs.find((r) => r.service.id === 'incomplete-service')).toBeUndefined();
    expect(recs).toHaveLength(0);
  });

  it('allows users to dismiss recommendations and preserves dismissals in storage', () => {
    dismissRecommendation('non-creamy-layer-certificate');
    expect(getDismissedRecommendations()).toContain('non-creamy-layer-certificate');

    const saved = [{ id: 'caste-certificate', name: 'Caste Certificate' }];
    const recs = getRelatedServiceRecommendations(saved, mockCatalogue);
    expect(recs.find((r) => r.service.id === 'non-creamy-layer-certificate')).toBeUndefined();

    restoreRecommendation('non-creamy-layer-certificate');
    const restoredRecs = getRelatedServiceRecommendations(saved, mockCatalogue);
    expect(restoredRecs.find((r) => r.service.id === 'non-creamy-layer-certificate')).toBeDefined();
  });
});
