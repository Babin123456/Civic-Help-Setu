/**
 * src/services/noticeOrderExplainerService.js
 *
 * Plain-Language Government Notice & Order Explainer (#1422).
 *
 * Extends `civicNoticeSummarizerService.js` and `civicTranslationMemoryService.js`:
 *   - Extracts sections with explicit Page / Paragraph citations.
 *   - Computes OCR confidence and surfaces low-confidence / uncertainty flags.
 *   - Renders side-by-side authoritative official text and plain-language summary.
 *   - Integrates human-reviewed translations with fallback to original wording.
 *   - Ensures official text remains authoritative; zero-PII guard.
 */

import { summarizeCivicNotice } from './civicNoticeSummarizerService.js';
import { getTranslationByTerm } from './civicTranslationMemoryService.js';

export const AUTHORITATIVE_TEXT_DISCLAIMER =
  'Official government notice text remains legally authoritative. Plain-language summaries and extracted deadlines are assistive aids only; verify every material claim against the cited page and paragraph.';

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function hasForbiddenPII(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  return AADHAAR_RE.test(s) || PAN_RE.test(s);
}

/**
 * Assesses OCR text quality (uses supplied OCR confidence or heuristic ratio).
 */
export function assessOcrConfidence(rawText = '', suppliedConfidence = null) {
  if (typeof suppliedConfidence === 'number' && !Number.isNaN(suppliedConfidence)) {
    const clamped = Math.max(0, Math.min(1, Number(suppliedConfidence)));
    return {
      ocrConfidence: Number(clamped.toFixed(2)),
      ocrLowConfidenceFlag: clamped < 0.7,
      ocrNote: clamped < 0.7 ? 'Low OCR confidence — inspect original scanned PDF carefully.' : 'Acceptable OCR quality.',
    };
  }
  const text = String(rawText || '');
  if (!text.trim()) {
    return { ocrConfidence: 0, ocrLowConfidenceFlag: true, ocrNote: 'Empty notice text.' };
  }
  const replacementChars = (text.match(/[\uFFFD~^|]/g) || []).length;
  const ratio = Math.max(0, Math.min(1, 1 - replacementChars / Math.max(10, text.length)));
  const score = Number(ratio.toFixed(2));
  return {
    ocrConfidence: score,
    ocrLowConfidenceFlag: score < 0.7,
    ocrNote: score < 0.7 ? 'Possible OCR artifacts detected — verify against original scan.' : 'Clear text input.',
  };
}

function simplifyPassage(passage = '') {
  return String(passage || '')
    .replace(/\bhereinafter referred to as\b/gi, 'called')
    .replace(/\bpursuant to\b/gi, 'under')
    .replace(/\bnotwithstanding anything contained in\b/gi, 'despite')
    .replace(/\bshall be liable to\b/gi, 'may face')
    .replace(/\bfurnish\b/gi, 'submit')
    .trim();
}

/**
 * Explains a government notice or order with section-level page/paragraph citations,
 * OCR confidence, uncertainty flags, and human-reviewed translation metadata.
 */
export function explainGovernmentNoticeOrOrder({
  title = '',
  text = '',
  sourceUrl = '',
  jurisdiction = '',
  effectiveDate = '',
  lastVerifiedAt = '',
  ocrConfidence = null,
  targetLanguage = 'en',
} = {}) {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Notice or order text is required.');
  }
  if (hasForbiddenPII({ title, text: cleanText })) {
    throw new Error('Notice text must not contain Aadhaar or PAN numbers.');
  }

  const ocr = assessOcrConfidence(cleanText, ocrConfidence);
  const baseSummary = summarizeCivicNotice({ title, text: cleanText, sourceUrl });

  // Split into pages (optional '---PAGE---' marker or single page) and paragraphs
  const pages = cleanText.split(/\n?---PAGE---\n?/i);
  const sections = [];

  pages.forEach((pageContent, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const paragraphs = pageContent
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    paragraphs.forEach((para, paraIdx) => {
      const paragraphNumber = paraIdx + 1;
      const citation = `Page ${pageNumber}, Para ${paragraphNumber}`;
      const plainSummary = simplifyPassage(para);

      // Check for uncertainty signals (missing dates/ambiguous terms or low OCR)
      const isUncertain = ocr.ocrLowConfidenceFlag || /\b(?:approx|may vary|subject to|to be notified)\b/i.test(para);

      let translatedNote = null;
      let humanReviewedTranslation = false;
      if (targetLanguage && targetLanguage !== 'en') {
        const languagePair = targetLanguage.includes('-') ? targetLanguage : `en-${targetLanguage}`;
        const sourceSnippet = para.slice(0, 60);
        const tm = getTranslationByTerm(sourceSnippet, languagePair);
        if (tm && tm.status === 'approved' && tm.approvedTranslation) {
          translatedNote = tm.approvedTranslation;
          humanReviewedTranslation = true;
        } else {
          translatedNote = sourceSnippet;
          humanReviewedTranslation = false;
        }
      }

      sections.push({
        sectionId: `sec-p${pageNumber}-${paragraphNumber}`,
        pageNumber,
        paragraphNumber,
        citation,
        originalPassage: para,
        plainLanguageSummary: plainSummary,
        uncertaintyFlag: isUncertain,
        uncertaintyReason: isUncertain
          ? (ocr.ocrLowConfidenceFlag ? 'Low OCR confidence on source scan' : 'Conditional or provisional wording in official text')
          : null,
        translatedNote,
        humanReviewedTranslation,
        provenance: 'ai_summary_verify',
      });
    });
  });

  const materialClaims = [
    {
      claimType: 'Primary Deadline',
      value: baseSummary.primaryDeadline || 'UNVERIFIED',
      uncertaintyFlag: !baseSummary.primaryDeadline || baseSummary.primaryDeadline === 'Unknown',
      citation: sections[0]?.citation || 'Page 1, Para 1',
    },
    {
      claimType: 'Jurisdiction',
      value: jurisdiction || baseSummary.jurisdiction || 'UNVERIFIED',
      uncertaintyFlag: !(jurisdiction || (baseSummary.jurisdiction && baseSummary.jurisdiction !== 'Unknown')),
      citation: sections[0]?.citation || 'Page 1, Para 1',
    },
  ];

  return {
    title: baseSummary.title || title || 'Government Notice / Order',
    sourceUrl: baseSummary.sourceUrl || sourceUrl || null,
    jurisdiction: jurisdiction || baseSummary.jurisdiction || 'UNVERIFIED',
    effectiveDate: effectiveDate || null,
    lastVerifiedAt: lastVerifiedAt || null,
    verificationStatus: effectiveDate && lastVerifiedAt ? 'VERIFIED' : 'UNVERIFIED',
    ocrConfidence: ocr.ocrConfidence,
    ocrLowConfidenceFlag: ocr.ocrLowConfidenceFlag,
    ocrNote: ocr.ocrNote,
    sections,
    materialClaims,
    officialTextAuthoritative: true,
    authoritativeDisclaimer: AUTHORITATIVE_TEXT_DISCLAIMER,
  };
}
