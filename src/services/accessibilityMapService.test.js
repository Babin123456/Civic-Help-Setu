import { describe, it, expect } from 'vitest';
import {
  ACCESSIBILITY_FACILITIES,
  FACILITY_LABELS,
  normalizeAttributeStatus,
  getAttributeStatus,
  normalizeAccessibilityRecord,
  getFacilityAuditSummary,
  filterOfficesByAccessibilityAndLanguage,
  calculateOfficeAccessibilityScore,
  recordOfficeAccessibilityAudit,
  getOfficeAccessibilityAudits,
} from './accessibilityMapService';

describe('Civic Service Accessibility and Language Coverage Map Service (#146)', () => {
  const mockOfficeWithVerifiedData = {
    id: 'off-1',
    name: 'District Revenue Office - South Zone',
    city: 'New Delhi',
    district: 'South Delhi',
    state: 'Delhi',
    pincode: '110017',
    address: 'Saket District Center',
    accessibility: {
      wheelchairRamp: true,
      elevator: true,
      accessibleRestroom: false,
      brailleSignage: null, // explicitly unknown
      assistiveListening: null, // explicitly unknown
      signLanguageSupport: false,
      tactilePaving: true,
      accessibleParking: true,
    },
    languageCoverage: {
      supportedLanguages: ['Hindi', 'English', 'Punjabi'],
      helpdeskLanguages: ['Hindi', 'English'],
      formsAvailableLanguages: ['Hindi', 'English'],
      hasSignLanguageInterpreter: false,
    },
    auditMetadata: {
      verifiedBy: 'State Accessibility Audit Directorate',
      reviewDate: '2026-03-01',
      sourceUrl: 'https://delhi.gov.in/accessibility',
      verificationNotes: 'Ground floor inspected and verified by audit committee.',
    },
  };

  const mockOfficeIncompleteRecord = {
    id: 'off-2',
    name: 'Sub-Tehsil Facilitation Desk',
    city: 'Kolkata',
    district: 'Kolkata',
    state: 'West Bengal',
    pincode: '700001',
    // Missing accessibility, languageCoverage, and auditMetadata completely
  };

  const mockOfficeRegionalLanguages = {
    id: 'off-3',
    name: 'Bangalore One Civic Center',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '560001',
    accessibility: {
      wheelchairRamp: true,
      elevator: false,
      accessibleRestroom: true,
      brailleSignage: true,
      assistiveListening: true,
      signLanguageSupport: true,
      tactilePaving: true,
      accessibleParking: true,
    },
    languageCoverage: {
      supportedLanguages: ['Kannada', 'English', 'Tamil', 'Telugu'],
      helpdeskLanguages: ['Kannada', 'English'],
    },
  };

  describe('Attribute normalization and "Unknown" state preservation', () => {
    it('normalizes boolean values correctly', () => {
      expect(normalizeAttributeStatus(true)).toBe(true);
      expect(normalizeAttributeStatus(false)).toBe(false);
      expect(normalizeAttributeStatus('available')).toBe(true);
      expect(normalizeAttributeStatus('unavailable')).toBe(false);
    });

    it('strictly preserves null and undefined as unknown (never coerces to false or true)', () => {
      expect(normalizeAttributeStatus(null)).toBe(null);
      expect(normalizeAttributeStatus(undefined)).toBe(null);
      expect(normalizeAttributeStatus('not-specified')).toBe(null);

      expect(getAttributeStatus(true)).toBe('available');
      expect(getAttributeStatus(false)).toBe('unavailable');
      expect(getAttributeStatus(null)).toBe('unknown');
      expect(getAttributeStatus(undefined)).toBe('unknown');
    });

    it('normalizes office records with incomplete or missing attributes without throwing', () => {
      const normalized = normalizeAccessibilityRecord(mockOfficeIncompleteRecord);
      expect(normalized).toBeDefined();
      expect(normalized.id).toBe('off-2');

      // Unspecified facilities should be unknown (null), not false
      expect(normalized.accessibility.elevator).toBeNull();
      expect(normalized.accessibility.brailleSignage).toBeNull();
      expect(normalized.accessibility.accessibleRestroom).toBeNull();
      expect(normalized.accessibility.assistiveListening).toBeNull();

      // Language defaults to safe fallback
      expect(normalized.languageCoverage.supportedLanguages).toContain('English');
      expect(normalized.languageCoverage.supportedLanguages).toContain('Hindi');

      // Audit metadata has fallback
      expect(normalized.auditMetadata.verifiedBy).toBe('District Facilitation Audit');
      expect(normalized.auditMetadata.reviewDate).toBeNull();
    });

    it('preserves verified audit metadata when provided', () => {
      const normalized = normalizeAccessibilityRecord(mockOfficeWithVerifiedData);
      expect(normalized.auditMetadata.verifiedBy).toBe('State Accessibility Audit Directorate');
      expect(normalized.auditMetadata.reviewDate).toBe('2026-03-01');
      expect(normalized.auditMetadata.sourceUrl).toBe('https://delhi.gov.in/accessibility');
      expect(normalized.auditMetadata.verificationNotes).toContain('Ground floor inspected');
    });
  });

  describe('Audit and Facility Summaries', () => {
    it('computes accurate counts of available, unavailable, and unknown facilities', () => {
      const summary = getFacilityAuditSummary(mockOfficeWithVerifiedData);
      expect(summary.total).toBe(8);
      // wheelchairRamp (T), elevator (T), tactilePaving (T), accessibleParking (T) -> 4 available
      expect(summary.availableCount).toBe(4);
      // accessibleRestroom (F), signLanguageSupport (F) -> 2 unavailable
      expect(summary.unavailableCount).toBe(2);
      // brailleSignage (null), assistiveListening (null) -> 2 unknown
      expect(summary.unknownCount).toBe(2);
      expect(summary.reviewDate).toBe('2026-03-01');
    });

    it('handles empty or null office gracefully in summary helper', () => {
      const summary = getFacilityAuditSummary(null);
      expect(summary.total).toBe(0);
      expect(summary.availableCount).toBe(0);
      expect(summary.unknownCount).toBe(0);
    });
  });

  describe('Filtering by Facility, Language, and Locality', () => {
    const offices = [mockOfficeWithVerifiedData, mockOfficeIncompleteRecord, mockOfficeRegionalLanguages];

    it('filters strictly by required facility (only matches verified true)', () => {
      const rampResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredFacilities: [ACCESSIBILITY_FACILITIES.WHEELCHAIR_RAMP],
      });
      // off-1 has ramp=true, off-3 has ramp=true. off-2 has ramp=null (unknown), so excluded!
      expect(rampResults.map((o) => o.id)).toEqual(['off-1', 'off-3']);

      const brailleResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredFacilities: [ACCESSIBILITY_FACILITIES.BRAILLE_SIGNAGE],
      });
      // off-3 has braille=true. off-1 has braille=null, off-2 has braille=null.
      expect(brailleResults.map((o) => o.id)).toEqual(['off-3']);
    });

    it('does NOT treat unknown attributes as available when filtering', () => {
      const elevatorResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredFacilities: [ACCESSIBILITY_FACILITIES.ELEVATOR],
      });
      // off-1 has elevator=true, off-2 has elevator=null, off-3 has elevator=false
      expect(elevatorResults.map((o) => o.id)).toEqual(['off-1']);
    });

    it('filters by multiple combined required facilities', () => {
      const multiFacilityResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredFacilities: [
          ACCESSIBILITY_FACILITIES.WHEELCHAIR_RAMP,
          ACCESSIBILITY_FACILITIES.ASSISTIVE_LISTENING,
        ],
      });
      // only off-3 has both wheelchair ramp and assistive listening
      expect(multiFacilityResults.map((o) => o.id)).toEqual(['off-3']);
    });

    it('filters by supported languages', () => {
      const kannadaResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredLanguages: ['Kannada'],
      });
      expect(kannadaResults.map((o) => o.id)).toEqual(['off-3']);

      const hindiResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredLanguages: ['Hindi'],
      });
      // off-1 has Hindi, off-2 has fallback Hindi
      expect(hindiResults.map((o) => o.id)).toEqual(['off-1', 'off-2']);
    });

    it('searches by locality text query without needing GPS coordinates', () => {
      const saketResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        localityQuery: 'Saket',
      });
      expect(saketResults.length).toBe(1);
      expect(saketResults[0].id).toBe('off-1');

      const bengaluruPinResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        localityQuery: '560001',
      });
      expect(bengaluruPinResults.length).toBe(1);
      expect(bengaluruPinResults[0].id).toBe('off-3');
    });

    it('filters by state and district', () => {
      const delhiResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        state: 'Delhi',
        district: 'South Delhi',
      });
      expect(delhiResults.length).toBe(1);
      expect(delhiResults[0].id).toBe('off-1');
    });

    it('returns empty array when no offices match criteria', () => {
      const noResults = filterOfficesByAccessibilityAndLanguage({
        offices,
        requiredLanguages: ['Japanese'],
      });
      expect(noResults).toEqual([]);
    });
  });

  describe('Facility Labels and Definitions', () => {
    it('defines labels for all core facility keys', () => {
      for (const [key, val] of Object.entries(ACCESSIBILITY_FACILITIES)) {
        expect(FACILITY_LABELS[val]).toBeDefined();
        expect(typeof FACILITY_LABELS[val]).toBe('string');
      }
    });
  });
});


describe('Community Accessibility Audits & Score Calculation', () => {
  const sampleOffice = {
    id: 'off-test-100',
    name: 'Tehsil Seva Kendra',
    accessibility: {
      wheelchairRamp: true,
      elevator: true,
      accessibleRestroom: true,
      accessibleParking: true,
      tactilePaving: false,
    },
  };

  it('calculates score based on facility weights', () => {
    const { score, level, color } = calculateOfficeAccessibilityScore(sampleOffice);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(level).toBe('HIGH');
    expect(color).toBe('#10b981');
  });

  it('records citizen ground-truth audits and updates office score', () => {
    const saved = recordOfficeAccessibilityAudit('off-test-100', {
      facilities: {
        wheelchairRamp: false, // Broken ramp reported by citizen
      },
      notes: 'Ramp is under construction and unusable.',
    });

    expect(saved).not.toBeNull();
    expect(saved.officeId).toBe('off-test-100');

    const audits = getOfficeAccessibilityAudits('off-test-100');
    expect(audits).toHaveLength(1);
    expect(audits[0].notes).toContain('under construction');

    // Re-evaluating score reflects the latest citizen audit override
    const updatedScore = calculateOfficeAccessibilityScore(sampleOffice);
    expect(updatedScore.score).toBeLessThan(70);
    expect(updatedScore.communityAuditsCount).toBe(1);
  });
});
