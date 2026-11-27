import { describe, it, expect } from 'vitest';
import {
  resolveJurisdiction,
  buildHandOffGraph,
  getAuthorityDetails,
  getTextOnlyHandOff,
  getKeyboardAccessibleInfo,
  requiresReview,
  getPlainLanguageExplanation,
} from './jurisdictionHandoffService';
import { SAMPLE_SERVICES, SAMPLE_AUTHORITIES } from '../data/jurisdictionTestData';
import { AuthorityRecord } from '../data/jurisdictionBoundaries';

describe('jurisdiction hand-off service (#815)', () => {
  const birthCertService = SAMPLE_SERVICES.find((s) => s.id === 'birth-certificate');
  const drivingLicenceService = SAMPLE_SERVICES.find((s) => s.id === 'driving-licence');
  const propertyTaxService = SAMPLE_SERVICES.find((s) => s.id === 'property-tax');
  const deathCertService = SAMPLE_SERVICES.find((s) => s.id === 'death-certificate');
  const nationalService = {
    id: 'national-test',
    name: 'National Service',
    category: 'Identity',
    jurisdiction: { level: 'national' },
  };

  describe('resolveJurisdiction', () => {
    it('resolves jurisdiction for a service with valid locality', () => {
      const result = resolveJurisdiction(birthCertService, 'chennai');
      expect(result.success).toBe(true);
      expect(result.stage).toBe('local');
      expect(result.authority).toBeDefined();
      expect(result.ambiguity).toBe(false);
      expect(result.resolvedLocality).toBe('chennai');
      expect(result.resolvedState).toBe('tamil-nadu');
    });

    it('resolves jurisdiction for PIN code', () => {
      const result = resolveJurisdiction(birthCertService, '600001');
      expect(result.success).toBe(true);
      expect(result.stage).toBe('local');
      expect(result.authority).toBeDefined();
      expect(result.ambiguity).toBe(false);
    });

    it('handles ambiguous jurisdiction', () => {
      // 'north delhi' is in the edge cases as ambiguous
      const result = resolveJurisdiction(birthCertService, 'north delhi');
      expect(result.ambiguity).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });

    it('handles unavailable jurisdiction', () => {
      const result = resolveJurisdiction(birthCertService, '999999');
      expect(result.unavailable).toBe(true);
      expect(result.success).toBe(false);
      expect(result.ambiguity).toBe(false);
    });

    it('handles unknown service', () => {
      const result = resolveJurisdiction({ id: 'unknown', name: 'Unknown', category: 'Test' }, 'chennai');
      expect(result.success).toBe(false);
      expect(result.error.includes('verified')).toBe(true);
    });

    it('handles empty locality', () => {
      const result = resolveJurisdiction(birthCertService, '');
      expect(result.success).toBe(false);
      expect(result.error.includes('Locality')).toBe(true);
    });
  });

  describe('buildHandOffGraph', () => {
    it('builds hand-off graph for resolved jurisdiction', () => {
      const graph = buildHandOffGraph(birthCertService, 'chennai');
      expect(graph.stages).toBeDefined();
      expect(graph.summary).toBeDefined();
      expect(typeof graph.ambiguity).toBe('boolean');
    });

    it('builds hand-off graph with ambiguity', () => {
      const graph = buildHandOffGraph(birthCertService, 'north delhi');
      expect(graph.ambiguity).toBe(true);
      expect(graph.requiresConfirmation).toBe(true);
      expect(graph.stages.length).toBeGreaterThan(0);
    });

    it('builds hand-off graph for national service', () => {
      const graph = buildHandOffGraph(nationalService, 'chennai');
      expect(graph.stages.length).toBeGreaterThan(0);
      expect(graph.stages[0].authority.name).toBe('Central Government');
      expect(graph.stages[0].authority.level).toBe('national');
    });

    it('builds hand-off graph for service with no locality', () => {
      const graph = buildHandOffGraph(birthCertService);
      expect(graph.stages.length).toBeGreaterThan(0);
      expect(graph.summary).toBeDefined();
    });
  });

  describe('getAuthorityDetails', () => {
    it('returns authority details', () => {
      const auth = SAMPLE_AUTHORITIES.find((a) => a.id === 'central-government');
      const details = getAuthorityDetails(auth);
      expect(details.contact).toBeDefined();
      expect(details.portal).toBeDefined();
      expect(details.escalation).toBeDefined();
      expect(details.source).toBeDefined();
    });

    it('handles null authority', () => {
      const details = getAuthorityDetails(null);
      expect(details.contact).toBeDefined();
      expect(details.portal).includes('#');
    });
  });

  describe('getTextOnlyHandOff', () => {
    it('generates text-only representation', () => {
      const graph = buildHandOffGraph(birthCertService, 'chennai');
      const text = getTextOnlyHandOff(graph);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain('Hand-off Journey');
      expect(text).toContain('chennai');
    });

    it('handles empty graph', () => {
      const text = getTextOnlyHandOff({
        stages: [],
        summary: 'No jurisdiction resolved.',
        ambiguity: false,
      });
      expect(typeof text).toBe('string');
    });
  });

  describe('getKeyboardAccessibleInfo', () => {
    it('generates keyboard accessible info', () => {
      const graph = buildHandOffGraph(birthCertService, 'chennai');
      const info = getKeyboardAccessibleInfo(graph);
      expect(Array.isArray(info)).toBe(true);
      expect(info.length).toBeGreaterThan(0);
      
      // Check that info items have required fields
      info.forEach((item) => {
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('value');
      });
    });

    it('handles empty graph', () => {
      const info = getKeyboardAccessibleInfo({
        stages: [],
        summary: 'No hand-off path available.',
      });
      expect(Array.isArray(info)).toBe(true);
      expect(info.length).toBeGreaterThan(0);
    });
  });

  describe('requiresReview', () => {
    it('returns true for ambiguous jurisdiction', () => {
      const resolution = {
        ambiguity: true,
        requiresConfirmation: true,
        unavailable: false,
        success: false,
      };
      expect(requiresReview(resolution)).toBe(true);
    });

    it('returns true for unavailable jurisdiction', () => {
      const resolution = {
        ambiguity: false,
        requiresConfirmation: false,
        unavailable: true,
        success: false,
      };
      expect(requiresReview(resolution)).toBe(true);
    });

    it('returns true for failed resolution', () => {
      const resolution = {
        ambiguity: false,
        requiresConfirmation: false,
        unavailable: false,
        success: false,
        error: 'Some error',
      };
      expect(requiresReview(resolution)).toBe(true);
    });

    it('returns false for successful resolution', () => {
      const resolution = {
        ambiguity: false,
        requiresConfirmation: false,
        unavailable: false,
        success: true,
      };
      expect(requiresReview(resolution)).toBe(false);
    });
  });

  describe('getPlainLanguageExplanation', () => {
    it('generates plain language explanation for confirmed result', () => {
      const resolution = {
        success: true,
        stage: 'local',
        authority: { name: 'Chennai Corporation' },
        resolvedLocality: 'chennai',
        resolvedState: 'tamil-nadu',
      };
      
      const explanation = getPlainLanguageExplanation(resolution, true);
      expect(explanation.text).toBeDefined();
      expect(explanation.isSuggestion).toBe(false); // Confirmed = not a suggestion
      expect(explanation.requiresConfirmation).toBe(false);
      expect(explanation.aiLabel).toContain('Confirmed');
    });

    it('generates plain language explanation as AI suggestion', () => {
      const resolution = {
        success: true,
        stage: 'local',
        authority: { name: 'Chennai Corporation' },
        resolvedLocality: 'chennai',
        resolvedState: 'tamil-nadu',
      };
      
      const explanation = getPlainLanguageExplanation(resolution, false);
      expect(explanation.isSuggestion).toBe(true); // Not confirmed = suggestion
      expect(explanation.requiresConfirmation).toBe(true);
      expect(explanation.aiLabel).toContain('AI suggestion');
    });

    it('handles failed resolution', () => {
      const explanation = getPlainLanguageExplanation({
        success: false,
        error: 'Could not resolve jurisdiction',
      });
      expect(explanation.text).toBeDefined();
      expect(explanation.requiresConfirmation).toBe(true);
    });
  });
});