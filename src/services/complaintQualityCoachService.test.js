import { describe, it, expect } from 'vitest';
import {
  COMPLAINT_CATEGORIES,
  SYNTHETIC_COMPLAINT_FIXTURES,
  COMPLAINT_COACH_SCHEMA_VERSION,
} from '../data/complaintQualityContract.js';
import {
  validateComplaintInput,
  detectDateCompleteness,
  detectLocationCompleteness,
  detectReferenceNumbers,
  detectEvidenceMentions,
  detectUnsupportedAllegations,
  generatePolishedDraft,
  analyzeComplaintQuality,
  ERROR_CODES,
} from './complaintQualityCoachService.js';

describe('complaintQualityCoachService', () => {
  describe('validateComplaintInput', () => {
    it('accepts valid complaint payload', () => {
      const res = validateComplaintInput({
        category: COMPLAINT_CATEGORIES.MUNICIPAL_SERVICES,
        rawText: 'There is a damaged pothole on 4th Main Road Indiranagar.',
        title: 'Road damage',
      });
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects invalid or missing category', () => {
      const res = validateComplaintInput({
        category: 'UNKNOWN_CATEGORY',
        rawText: 'Some text',
      });
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('Invalid or missing category');
    });

    it('rejects empty or whitespace rawText', () => {
      const res = validateComplaintInput({
        category: COMPLAINT_CATEGORIES.WATER_AND_SEWERAGE,
        rawText: '   ',
      });
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('rawText is required');
    });

    it('rejects payload exceeding maximum character length', () => {
      const res = validateComplaintInput({
        category: COMPLAINT_CATEGORIES.WATER_AND_SEWERAGE,
        rawText: 'x'.repeat(5001),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('exceeds maximum allowed length');
    });
  });

  describe('detectDateCompleteness', () => {
    it('detects ISO dates and English calendar dates', () => {
      const res1 = detectDateCompleteness('The issue started on 2026-11-04.');
      expect(res1.hasSpecificDate).toBe(true);
      expect(res1.foundDateMatch).toBe('2026-11-04');

      const res2 = detectDateCompleteness('Power failure on 14 October 2026 at noon.');
      expect(res2.hasSpecificDate).toBe(true);
      expect(res2.foundDateMatch).toBe('14 October 2026');
    });

    it('flags ambiguous date phrases', () => {
      const res = detectDateCompleteness('The water leak happened few days ago and continues.');
      expect(res.hasSpecificDate).toBe(false);
      expect(res.hasAmbiguousDate).toBe(true);
      expect(res.suggestions.length).toBeGreaterThan(0);
    });

    it('handles Hindi date formats', () => {
      const res = detectDateCompleteness('दिनांक 12 नवंबर 2026 को दोपहर बिजली गुल हुई।');
      expect(res.hasSpecificDate).toBe(true);
    });
  });

  describe('detectLocationCompleteness', () => {
    it('detects landmarks, wards, sectors, and pincodes', () => {
      const res = detectLocationCompleteness('Near SBI ATM opposite Indiranagar club, Ward 112, 560038');
      expect(res.hasSpecificLocation).toBe(true);
    });

    it('flags ambiguous location indicators', () => {
      const res = detectLocationCompleteness('Pothole near my house down the road.');
      expect(res.hasAmbiguousLocation).toBe(true);
      expect(res.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('detectReferenceNumbers', () => {
    it('extracts municipal reference tokens and checks category match', () => {
      const text = 'Earlier complaint registered under token MNC-98214-BLR has had no response.';
      const res = detectReferenceNumbers(text, COMPLAINT_CATEGORIES.MUNICIPAL_SERVICES);
      expect(res.hasReferenceNumber).toBe(true);
      expect(res.extractedReferences).toContain('MNC-98214-BLR');
      expect(res.categoryMatches).toContain('MNC-98214-BLR');
    });

    it('handles text without any reference number', () => {
      const res = detectReferenceNumbers('No reference provided here.', COMPLAINT_CATEGORIES.MUNICIPAL_SERVICES);
      expect(res.hasReferenceNumber).toBe(false);
      expect(res.extractedReferences).toHaveLength(0);
    });
  });

  describe('detectEvidenceMentions', () => {
    it('detects photo, receipt, document, or video references', () => {
      const res = detectEvidenceMentions('Attaching 2 geo-tagged photographs and electricity bill copy.');
      expect(res.hasEvidenceMention).toBe(true);
      expect(res.foundTypes).toContain('PHOTOGRAPH');
      expect(res.foundTypes).toContain('RECEIPT_OR_BILL');
    });

    it('returns empty when no evidence is mentioned', () => {
      const res = detectEvidenceMentions('Please take urgent action on this matter.');
      expect(res.hasEvidenceMention).toBe(false);
      expect(res.foundTypes).toHaveLength(0);
    });
  });

  describe('detectUnsupportedAllegations', () => {
    it('flags bribery or corruption allegations with guidance', () => {
      const res = detectUnsupportedAllegations('The clerk demanded a bribe of 500 rupees to process my file.');
      expect(res.hasUnsupportedAllegations).toBe(true);
      expect(res.allegations[0].type).toBe('BRIBERY_OR_CORRUPTION');
      expect(res.allegations[0].warning).toContain('Vigilance');
    });

    it('flags personal defamation statements', () => {
      const res = detectUnsupportedAllegations('The engineer is a thief and scammer who ruined the road.');
      expect(res.hasUnsupportedAllegations).toBe(true);
      expect(res.allegations[0].type).toBe('PERSONAL_DEFAMATION');
    });

    it('passes clean objective complaints without allegations', () => {
      const res = detectUnsupportedAllegations('The transformer has remained non-functional despite 48 hours elapsed.');
      expect(res.hasUnsupportedAllegations).toBe(false);
    });
  });

  describe('generatePolishedDraft', () => {
    it('generates an objective draft with provenance tags', () => {
      const draft = generatePolishedDraft({
        category: COMPLAINT_CATEGORIES.MUNICIPAL_SERVICES,
        dateInfo: { foundDateMatch: '2026-10-18', hasSpecificDate: true },
        locationInfo: { hasSpecificLocation: true },
        refInfo: { extractedReferences: ['MNC-12345'], hasReferenceNumber: true },
        evidenceInfo: { hasEvidenceMention: true, foundTypes: ['PHOTOGRAPH'] },
        cleanedText: 'Deep pothole outside the hospital gate.',
        allegationInfo: { hasUnsupportedAllegations: false, allegations: [] },
      });

      expect(draft.draftText).toContain('Date of Incident/Issue: 2026-10-18');
      expect(draft.draftText).toContain('MNC-12345');
      expect(draft.draftText).toContain('Enclosures: PHOTOGRAPH');
      expect(draft.provenance.generator).toBe('CivicHelpSetu-ComplaintCoach-Deterministic-v1');
      expect(draft.provenance.schemaVersion).toBe(COMPLAINT_COACH_SCHEMA_VERSION);
    });
  });

  describe('analyzeComplaintQuality (End-to-End Orchestrator)', () => {
    it('successfully evaluates complete municipal fixture SYNTH-MUNI-02 with high score', () => {
      const fixture = SYNTHETIC_COMPLAINT_FIXTURES.find((f) => f.id === 'SYNTH-MUNI-02');
      const res = analyzeComplaintQuality({
        category: fixture.category,
        rawText: fixture.rawText,
      });

      expect(res.success).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(85);
      expect(res.grade).toBe('EXCELLENT');
      expect(res.dateAnalysis.hasSpecificDate).toBe(true);
      expect(res.locationAnalysis.hasSpecificLocation).toBe(true);
      expect(res.evidenceAnalysis.hasEvidenceMention).toBe(true);
      expect(res.allegationAnalysis.hasUnsupportedAllegations).toBe(false);
      expect(res.humanApprovalRequired).toBe(true);
    });

    it('evaluates incomplete municipal fixture SYNTH-MUNI-01 and flags missing items', () => {
      const fixture = SYNTHETIC_COMPLAINT_FIXTURES.find((f) => f.id === 'SYNTH-MUNI-01');
      const res = analyzeComplaintQuality({
        category: fixture.category,
        rawText: fixture.rawText,
      });

      expect(res.success).toBe(true);
      expect(res.score).toBeLessThan(70);
      expect(res.dateAnalysis.hasAmbiguousDate).toBe(true);
      expect(res.locationAnalysis.hasAmbiguousLocation).toBe(true);
      expect(res.evidenceAnalysis.hasEvidenceMention).toBe(false);
    });

    it('blocks prompt injection attacks cleanly', () => {
      const fixture = SYNTHETIC_COMPLAINT_FIXTURES.find((f) => f.id === 'SYNTH-INJECTION-01');
      const res = analyzeComplaintQuality({
        category: fixture.category,
        rawText: fixture.rawText,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe(ERROR_CODES.PROMPT_INJECTION_DETECTED);
      expect(res.error).toContain('Prompt injection');
    });

    it('redacts sensitive PII in the privacy preview without storing raw data', () => {
      const res = analyzeComplaintQuality({
        category: COMPLAINT_CATEGORIES.MUNICIPAL_SERVICES,
        rawText: 'My phone 9876543210 and Aadhaar 2345 6789 0123 were submitted on 2026-10-18 at Indiranagar.',
      });

      expect(res.success).toBe(true);
      expect(res.privacyPreview.piiDetected).toBe(true);
      expect(res.privacyPreview.redactedText).toContain('[REDACTED_PHONE]');
      expect(res.privacyPreview.redactedText).toContain('[REDACTED_AADHAAR]');
      expect(res.privacyPreview.redactedText).not.toContain('9876543210');
      expect(res.privacyPreview.redactedText).not.toContain('2345 6789 0123');
    });

    it('penalizes unsupported allegations and generates objective replacement draft', () => {
      const fixture = SYNTHETIC_COMPLAINT_FIXTURES.find((f) => f.id === 'SYNTH-CORRUPT-01');
      const res = analyzeComplaintQuality({
        category: fixture.category,
        rawText: fixture.rawText,
      });

      expect(res.success).toBe(true);
      expect(res.allegationAnalysis.hasUnsupportedAllegations).toBe(true);
      expect(res.polishedDraft).not.toContain('demanded a bribe');
    });
  });
});
