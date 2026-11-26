import { describe, it, expect } from 'vitest';
import {
  verifyTokenPreservation,
  extractTerminologyGlossary,
  reportMistranslation,
  exportAlignedInstructionDossier,
  getCanonicalSynonyms,
  auditTranslationQuality,
  SUPPORTED_INDIAN_LANGUAGES,
  TRANSLATION_REVIEW_STATUSES,
  SAMPLE_ALIGNED_INSTRUCTION
} from './multilingualInstructionService';

describe('multilingualInstructionService', () => {
  it('should define supported Indian languages and review states', () => {
    expect(SUPPORTED_INDIAN_LANGUAGES.HI.name).toBe('Hindi');
    expect(SUPPORTED_INDIAN_LANGUAGES.TA.name).toBe('Tamil');
    expect(TRANSLATION_REVIEW_STATUSES.REVIEWED_HUMAN_VERIFIED).toBe('REVIEWED_HUMAN_VERIFIED');
  });

  it('should verify critical token preservation across translation', () => {
    const src = 'Fee is ₹250 under Section 14 within 7 days.';
    const validTarget = 'धारा 14 के तहत शुल्क ₹250 है जो 7 दिनों के भीतर देय है।';

    const validAudit = verifyTokenPreservation(src, validTarget);
    expect(validAudit.isPreserved).toBe(true);
    expect(validAudit.missingTokens).toHaveLength(0);

    // Corrupted translation missing ₹250 and Section 14
    const badTarget = 'शुल्क का भुगतान करें।';
    const badAudit = verifyTokenPreservation(src, badTarget);
    expect(badAudit.isPreserved).toBe(false);
    expect(badAudit.missingTokens.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract aligned terminology glossary from document paragraphs', () => {
    const glossary = extractTerminologyGlossary(SAMPLE_ALIGNED_INSTRUCTION);
    expect(glossary.length).toBeGreaterThanOrEqual(4);

    const secToken = glossary.find(g => g.sourceTerm === 'Section 14');
    expect(secToken).toBeDefined();
    expect(secToken.targetTerm).toBe('धारा 14');
    expect(secToken.type).toBe('STATUTORY_SECTION');
  });

  it('should record citizen mistranslation reports', () => {
    const report = reportMistranslation('doc_water_bilingual_guide', 'p1', {
      reportedTerm: 'घरेलू जल आपूर्ति',
      suggestedCorrection: 'आवासीय नल कनेक्शन'
    });

    expect(report.success).toBe(true);
    expect(report.reportId).toBeDefined();
    expect(report.status).toBe('PENDING_LINGUISTIC_REVIEW');
  });

  it('should look up canonical multi-lingual synonyms', () => {
    const aff = getCanonicalSynonyms('AFFIDAVIT');
    expect(aff.hindi).toBe('शपथ पत्र');
    expect(aff.bengali).toBe('হলফনামা');

    const mut = getCanonicalSynonyms('MUTATION');
    expect(mut.tamil).toBe('பட்டா மாறுதல்');
  });

  it('should audit overall translation quality metrics', () => {
    const audit = auditTranslationQuality(SAMPLE_ALIGNED_INSTRUCTION);
    expect(audit.isPublishable).toBe(true);
    expect(audit.verdict).toBe('APPROVED_FOR_PUBLIC_RELEASE');
    expect(audit.preservationRatio).toBe(1.0);
  });

  it('should export formatted markdown side-by-side dossier', () => {
    const doc = exportAlignedInstructionDossier(SAMPLE_ALIGNED_INSTRUCTION);
    expect(doc).toContain('# Multilingual Synchronized Civic Instructions');
    expect(doc).toContain('**Languages:** EN ➔ HI');
    expect(doc).toContain('REVIEWED_HUMAN_VERIFIED');
    expect(doc).toContain('Section 14');
    expect(doc).toContain('धारा 14');
  });
});
