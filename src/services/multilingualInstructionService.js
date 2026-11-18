/**
 * Multilingual Side-by-Side Civic Instruction Reader with Terminology Alignment Service
 * 
 * Implements synchronized bilingual side-by-side reading of official civic procedures:
 * - Aligns translated paragraphs with original English/official gazette source text
 * - Pinned terminology alignment glossary linking translated legal phrases to canonical statutory terms
 * - Token invariant preservation checks: ensures amounts (₹), statutory section numbers,
 *   dates, and official authority names are never corrupted by machine translation
 * - Translation review state tracking: DRAFT_AI_SUGGESTION vs REVIEWED_HUMAN_VERIFIED
 * - Citizen mistranslation reporting workflow
 */

export const SUPPORTED_INDIAN_LANGUAGES = {
  HI: { code: 'HI', name: 'Hindi', script: 'Devanagari', nativeName: 'हिन्दी' },
  BN: { code: 'BN', name: 'Bengali', script: 'Bengali', nativeName: 'বাংলা' },
  TA: { code: 'TA', name: 'Tamil', script: 'Tamil', nativeName: 'தமிழ்' },
  TE: { code: 'TE', name: 'Telugu', script: 'Telugu', nativeName: 'తెలుగు' },
  KN: { code: 'KN', name: 'Kannada', script: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  MR: { code: 'MR', name: 'Marathi', script: 'Devanagari', nativeName: 'मराठी' }
};

export const TRANSLATION_REVIEW_STATUSES = {
  DRAFT_AI_SUGGESTION: 'DRAFT_AI_SUGGESTION',
  REVIEWED_HUMAN_VERIFIED: 'REVIEWED_HUMAN_VERIFIED',
  FLAGGED_MISTRANSLATION: 'FLAGGED_MISTRANSLATION'
};

export const TRANSLATION_ESCALATION_TARGETS = {
  OFFICIAL_LANGUAGE_CELL: 'State Official Language Directorate / Rajbhasha Prabhag',
  MUNICIPAL_PUBLIC_RELATIONS: 'Municipal Information & Public Relations Wing'
};

/**
 * Returns linguistic escalation contacts.
 * @returns {Object}
 */
export function getLinguisticEscalationInfo() {
  return TRANSLATION_ESCALATION_TARGETS;
}

export const LINGUISTIC_QUALITY_METRICS = {
  MIN_TOKEN_ALIGNMENT_RATIO: 0.85,
  MAX_ALLOWED_NUMERIC_DROP_COUNT: 0,
  ACCEPTED_DATE_FORMATS: ['DD/MM/YYYY', 'YYYY-MM-DD', 'DD Month YYYY']
};

/**
 * Assesses overall bilingual document quality score.
 * @param {Object} doc 
 * @returns {Object} scoreReport
 */
export function auditTranslationQuality(doc = {}) {
  const paragraphs = doc.paragraphs || [];
  let totalPreserved = 0;

  paragraphs.forEach(p => {
    const audit = verifyTokenPreservation(p.sourceText, p.targetText);
    if (audit.isPreserved) totalPreserved++;
  });

  const ratio = paragraphs.length > 0 ? +(totalPreserved / paragraphs.length).toFixed(2) : 1.0;
  const isPublishable = ratio >= LINGUISTIC_QUALITY_METRICS.MIN_TOKEN_ALIGNMENT_RATIO;

  return {
    documentId: doc.documentId,
    totalParagraphs: paragraphs.length,
    fullyPreservedParagraphs: totalPreserved,
    preservationRatio: ratio,
    isPublishable,
    verdict: isPublishable ? 'APPROVED_FOR_PUBLIC_RELEASE' : 'WITHHELD_TOKEN_ANOMALY_DETECTED'
  };
}

export const GLOSSARY_CANONICAL_SYNONYMS = {
  AFFIDAVIT: { canonical: 'Affidavit', hindi: 'शपथ पत्र', bengali: 'হলফনামা', tamil: 'பிரமாண பத்திரம்' },
  ENCUMBRANCE: { canonical: 'Encumbrance Certificate', hindi: 'भारमुक्त प्रमाण पत्र', bengali: 'দাবিমুক্ত শংসাপত্র', tamil: 'வில்லங்க சான்றிதழ்' },
  MUTATION: { canonical: 'Mutation / Name Transfer', hindi: 'दाखिल खारिज / नामांतरण', bengali: 'নামজারি', tamil: 'பட்டா மாறுதல்' }
};

/**
 * Returns canonical multi-lingual term definitions.
 * @param {string} termKey 
 * @returns {Object}
 */
export function getCanonicalSynonyms(termKey) {
  return GLOSSARY_CANONICAL_SYNONYMS[termKey] || null;
}

export const SAMPLE_ALIGNED_INSTRUCTION = {
  documentId: 'doc_water_bilingual_guide',
  serviceId: 'water-connection',
  sourceLanguage: 'EN',
  targetLanguage: 'HI',
  reviewStatus: TRANSLATION_REVIEW_STATUSES.REVIEWED_HUMAN_VERIFIED,
  lastReviewedDate: '2024-02-15',
  paragraphs: [
    {
      id: 'p1',
      sourceText: 'Every applicant seeking a domestic water supply connection must deposit an application fee of ₹250 under Section 14 of the Municipal Water Act.',
      targetText: 'घरेलू जल आपूर्ति कनेक्शन के लिए आवेदन करने वाले प्रत्येक नागरिक को नगर पालिका जल अधिनियम की धारा 14 के तहत ₹250 का आवेदन शुल्क जमा करना होगा।',
      alignedTokens: [
        { source: 'Section 14', target: 'धारा 14', type: 'STATUTORY_SECTION' },
        { source: '₹250', target: '₹250', type: 'CURRENCY_AMOUNT' },
        { source: 'domestic water supply', target: 'घरेलू जल आपूर्ति', type: 'GLOSSARY_TERM' }
      ]
    },
    {
      id: 'p2',
      sourceText: 'The Junior Engineer shall conduct a site inspection within 7 working days to verify proximity to the main distribution pipeline.',
      targetText: 'कनिष्ठ अभियंता मुख्य वितरण पाइपलाइन की निकटता सत्यापित करने के लिए 7 कार्य दिवसों के भीतर साइट निरीक्षण करेंगे।',
      alignedTokens: [
        { source: 'Junior Engineer', target: 'कनिष्ठ अभियंता', type: 'AUTHORITY_ROLE' },
        { source: '7 working days', target: '7 कार्य दिवसों', type: 'TIMELINE_DAYS' }
      ]
    }
  ]
};

/**
 * Validates that essential numeric and legal tokens are strictly preserved across translation.
 * @param {string} sourceText 
 * @param {string} targetText 
 * @returns {Object} auditResult
 */
export function verifyTokenPreservation(sourceText = '', targetText = '') {
  const missingTokens = [];

  // 1. Currency preservation (₹...)
  const currencyMatches = sourceText.match(/₹\s*\d+(?:,\d+)*(?:\.\d+)?/g) || [];
  currencyMatches.forEach(curr => {
    if (!targetText.includes(curr)) {
      missingTokens.push({ type: 'CURRENCY', token: curr });
    }
  });

  // 2. Numbers preservation (\d+)
  const numberMatches = sourceText.match(/\b\d+\b/g) || [];
  numberMatches.forEach(num => {
    // Check Arabic numerals in target
    if (!targetText.includes(num)) {
      missingTokens.push({ type: 'NUMERIC_VALUE', token: num });
    }
  });

  // 3. Section references (Section \d+)
  const sectionMatches = sourceText.match(/Section\s+\d+[A-Za-z]?/gi) || [];
  sectionMatches.forEach(sec => {
    const secNum = sec.match(/\d+[A-Za-z]?/)[0];
    if (!targetText.includes(secNum) && !targetText.includes(`धारा ${secNum}`)) {
      missingTokens.push({ type: 'STATUTORY_SECTION', token: sec });
    }
  });

  const isPreserved = missingTokens.length === 0;

  return {
    isPreserved,
    missingTokens,
    warning: isPreserved ? null : 'Warning: Machine translation failed to preserve critical legal numbers or currency tokens.'
  };
}

/**
 * Extracts a consolidated bilingual glossary from aligned paragraph tokens.
 * @param {Object} alignedDoc 
 * @returns {Array<Object>} glossaryEntries
 */
export function extractTerminologyGlossary(alignedDoc = {}) {
  const glossaryMap = new Map();

  (alignedDoc.paragraphs || []).forEach(p => {
    (p.alignedTokens || []).forEach(token => {
      if (!glossaryMap.has(token.source)) {
        glossaryMap.set(token.source, {
          sourceTerm: token.source,
          targetTerm: token.target,
          type: token.type
        });
      }
    });
  });

  return Array.from(glossaryMap.values());
}

/**
 * Records a citizen mistranslation report for editorial scrutiny.
 * @param {string} documentId 
 * @param {string} paragraphId 
 * @param {Object} reportDetails 
 * @returns {Object} report
 */
export function reportMistranslation(documentId, paragraphId, reportDetails = {}) {
  if (!reportDetails.suggestedCorrection) {
    return { success: false, error: 'Suggested corrected phrasing is required.' };
  }

  return {
    success: true,
    reportId: 'trans_err_' + Math.random().toString(36).substring(2, 9),
    documentId,
    paragraphId,
    reportedTerm: reportDetails.reportedTerm || 'Paragraph Text',
    suggestedCorrection: reportDetails.suggestedCorrection.trim(),
    submittedAt: new Date().toISOString(),
    status: 'PENDING_LINGUISTIC_REVIEW'
  };
}

/**
 * Exports side-by-side synchronized instruction guide in markdown.
 * @param {Object} alignedDoc 
 * @returns {string} markdown
 */
export function exportAlignedInstructionDossier(alignedDoc = SAMPLE_ALIGNED_INSTRUCTION) {
  const glossary = extractTerminologyGlossary(alignedDoc);

  const paragraphsMarkdown = (alignedDoc.paragraphs || []).map((p, idx) => {
    return [
      `### Paragraph ${idx + 1}`,
      `| Source (${alignedDoc.sourceLanguage}) | Translated (${alignedDoc.targetLanguage}) |`,
      `| :--- | :--- |`,
      `| ${p.sourceText} | ${p.targetText} |`,
      ``
    ].join('\n');
  });

  return [
    `# Multilingual Synchronized Civic Instructions`,
    `**Document ID:** ${alignedDoc.documentId || 'N/A'}`,
    `**Languages:** ${alignedDoc.sourceLanguage || 'EN'} ➔ ${alignedDoc.targetLanguage || 'HI'}`,
    `**Review State:** \`${alignedDoc.reviewStatus || 'UNVERIFIED'}\` (Audited: ${alignedDoc.lastReviewedDate || 'Current'})`,
    ``,
    `## Side-by-Side Aligned Text`,
    ...paragraphsMarkdown,
    `## Verified Legal & Technical Terminology Glossary`,
    ...glossary.map(g => `- **${g.sourceTerm}** ➔ **${g.targetTerm}** *[${g.type}]*`),
    ``,
    `---`,
    `*Notice: Machine-suggested translations are verified by bilingual civic editors. Report mistranslations to enhance accuracy.*`
  ].join('\n');
}
