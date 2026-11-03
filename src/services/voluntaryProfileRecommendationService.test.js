import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isVoluntaryProfileOptedIn,
  setVoluntaryProfileOptIn,
  getVoluntaryProfileAttributes,
  saveVoluntaryProfileAttributes,
  clearVoluntaryProfileAttributes,
  getAnonymousFallbackRecommendations,
  getVoluntaryProfileRecommendations,
} from './voluntaryProfileRecommendationService.js';

describe('voluntaryProfileRecommendationService', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    });
  });

  const mockCatalog = [
    {
      id: 'kisan-credit',
      name: 'Kisan Credit Card (KCC) Scheme',
      category: 'Agriculture',
      department: 'Department of Agriculture',
      description: 'Provides credit support to farmers for crop production and agricultural needs.',
      eligibility: ['Must be an active farmer or cultivator'],
    },
    {
      id: 'national-scholarship',
      name: 'National Scholarship Scheme for Students',
      category: 'Education',
      department: 'Ministry of Education',
      description: 'Financial assistance for meritorious students pursuing college education.',
      eligibility: ['Enrolled in recognized educational institution'],
    },
    {
      id: 'senior-citizen-pension',
      name: 'National Old Age Pension Scheme (NOAPS)',
      category: 'Social Welfare',
      department: 'Ministry of Social Justice',
      description: 'Monthly pension for senior citizens aged 60 years or above from BPL households.',
      eligibility: ['Age 60 years and above', 'BPL category'],
    },
    {
      id: 'karnataka-ration',
      name: 'Karnataka Anna Bhagya Scheme',
      category: 'Food Security',
      state: 'Karnataka',
      department: 'Food & Civil Supplies Karnataka',
      description: 'Subsidized food grain distribution for BPL families in Karnataka.',
      eligibility: ['Resident of Karnataka'],
    },
    {
      id: 'voter-id',
      name: 'Voter ID Registration',
      category: 'Elections',
      description: 'Registration for voter identity card.',
      eligibility: ['Citizen 18 years or above'],
    },
  ];

  it('defaults to opted out and returns anonymous fallback recommendations', () => {
    expect(isVoluntaryProfileOptedIn()).toBe(false);

    const result = getVoluntaryProfileRecommendations(null, { catalog: mockCatalog });
    expect(result.isPersonalized).toBe(false);
    expect(result.optedIn).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].isFallback).toBe(true);
    expect(result.recommendations[0].matchReason).toContain('Essential civic baseline');
  });

  it('supports opt-in toggle and persists voluntary attributes', () => {
    setVoluntaryProfileOptIn(true);
    expect(isVoluntaryProfileOptedIn()).toBe(true);

    const saved = saveVoluntaryProfileAttributes({
      state: 'Karnataka',
      occupation: 'Farmer',
      ageGroup: 'Adult',
    });

    expect(saved.state).toBe('Karnataka');
    const retrieved = getVoluntaryProfileAttributes();
    expect(retrieved.occupation).toBe('Farmer');
  });

  it('matches occupation accurately and generates transparent explanations', () => {
    setVoluntaryProfileOptIn(true);
    saveVoluntaryProfileAttributes({
      occupation: 'Farmer',
    });

    const result = getVoluntaryProfileRecommendations(null, { catalog: mockCatalog });
    expect(result.isPersonalized).toBe(true);
    expect(result.optedIn).toBe(true);

    const farmerMatch = result.recommendations.find((r) => r.serviceId === 'kisan-credit');
    expect(farmerMatch).toBeDefined();
    expect(farmerMatch.matchReason).toContain('Agriculture & Farming');
    expect(farmerMatch.influencingAttributes).toContain('Occupation (Farmer)');
  });

  it('matches multiple attributes including State and Category with explanation', () => {
    setVoluntaryProfileOptIn(true);
    saveVoluntaryProfileAttributes({
      state: 'Karnataka',
      category: 'BPL',
      ageGroup: 'Senior Citizen (60+)',
    });

    const result = getVoluntaryProfileRecommendations(null, { catalog: mockCatalog });
    expect(result.isPersonalized).toBe(true);

    const karnatakaMatch = result.recommendations.find((r) => r.serviceId === 'karnataka-ration');
    expect(karnatakaMatch).toBeDefined();
    expect(karnatakaMatch.matchReason).toContain('Karnataka');
    expect(karnatakaMatch.influencingAttributes).toContain('State (Karnataka)');

    const seniorMatch = result.recommendations.find((r) => r.serviceId === 'senior-citizen-pension');
    expect(seniorMatch).toBeDefined();
    expect(seniorMatch.matchReason).toContain('60+ years');
    expect(seniorMatch.influencingAttributes).toContain('Age Group (Senior Citizen (60+))');
  });

  it('allows citizen to opt-out and resets attributes cleanly', () => {
    setVoluntaryProfileOptIn(true);
    saveVoluntaryProfileAttributes({ state: 'Karnataka', occupation: 'Student' });

    clearVoluntaryProfileAttributes();
    setVoluntaryProfileOptIn(false);

    expect(isVoluntaryProfileOptedIn()).toBe(false);
    expect(getVoluntaryProfileAttributes()).toEqual({});

    const result = getVoluntaryProfileRecommendations(null, { catalog: mockCatalog });
    expect(result.isPersonalized).toBe(false);
    expect(result.recommendations[0].isFallback).toBe(true);
  });

  it('provides standalone fallback recommendations without error', () => {
    const fallbacks = getAnonymousFallbackRecommendations(3);
    expect(fallbacks.length).toBe(3);
    expect(fallbacks[0].isFallback).toBe(true);
    expect(fallbacks[0].influencingAttributes).toContain('Universal Baseline');
  });
});

