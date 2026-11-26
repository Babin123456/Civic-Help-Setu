/**
 * civicContradictionDetectionEngine.js
 *
 * Deterministic Contradiction and Near-Match Detection Engine for the Civic Evidence Graph (#1165).
 * Evaluates typed facts with document provenance and OCR confidence.
 *
 * Governance & Engineering Guardrails:
 * - Pure deterministic rules outside LLM prompts.
 * - Categorizes conflicts into CRITICAL, WARNING, and INFORMATIONAL tiers.
 * - Handles Indian name phonetic transliterations (Lakshmi/Laxmi, Choudhary/Chowdhury).
 * - Distinguishes suspect OCR errors (O/0, I/1, S/5, B/8) from true fraud/discrepancies.
 * - Detects chronological sequence violations (e.g. issuance date predating birth date).
 * - Never makes autonomous legal determinations; findings are advisory alerts for citizen self-review.
 */

import {
  FACT_TYPES,
  CONFLICT_TYPES,
  CONFLICT_SEVERITIES,
  RESOLUTION_STATUSES,
} from './civicEvidenceGraphSchemas';

// Known OCR visual glyph confusion pairs
const OCR_GLYPH_CONFUSIONS = [
  ['O', '0'],
  ['I', '1'],
  ['L', '1'],
  ['S', '5'],
  ['B', '8'],
  ['Z', '2'],
  ['G', '6'],
  ['D', '0'],
];

/**
 * Standardize and parse dates into ISO YYYY-MM-DD format
 * Supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
 * @param {string} rawDate
 * @returns {{ isoDate: string | null, day: number, month: number, year: number } | null}
 */
export function parseAndNormalizeDate(rawDate = '') {
  if (!rawDate || typeof rawDate !== 'string') return null;
  const str = rawDate.trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate: iso, day, month, year };
    }
  }

  // Pattern 2: YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate: iso, day, month, year };
    }
  }

  // Fallback native Date
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth() + 1;
    const day = parsed.getUTCDate();
    if (year >= 1900 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate: iso, day, month, year };
    }
  }

  return null;
}

/**
 * Normalizes an Indian personal name by removing titles/honorifics and extra spaces.
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(name = '') {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/\b(shri|smt|shrimati|mr|mrs|ms|dr|kumari|late|master)\b\.?/gi, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Approximate phonetic transformer tuned for common Indic Latin transliteration variations.
 * @param {string} str
 * @returns {string}
 */
export function indicPhoneticKey(str = '') {
  const norm = normalizeName(str);
  if (!norm) return '';

  return norm
    .replace(/kshi|ksha|kxi|ksh/g, 'ks')
    .replace(/x/g, 'ks')
    .replace(/ou|ow/g, 'au')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/sh/g, 's')
    .replace(/w/g, 'v')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/bh/g, 'b')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/ch/g, 'c')
    .replace(/ury|ary|ari|ery/g, 'ari')
    .replace(/ph/g, 'f')
    .replace(/(\w)\1+/g, '$1'); // deduplicate double letters
}

/**
 * Checks if two names represent an initial expansion (e.g. "K. Suresh" vs "Kumar Suresh" or "Suresh K").
 * @param {string} nameA
 * @param {string} nameB
 * @returns {boolean}
 */
export function isInitialsExpansion(nameA = '', nameB = '') {
  const tokensA = normalizeName(nameA).split(' ').filter(Boolean);
  const tokensB = normalizeName(nameB).split(' ').filter(Boolean);

  if (tokensA.length === 0 || tokensB.length === 0) return false;
  if (tokensA.length === tokensB.length && tokensA.join(' ') === tokensB.join(' ')) return false;

  // Check if one has single-letter tokens that match the first character of the other
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  let matches = 0;
  for (const sTok of shorter) {
    if (sTok.length === 1) {
      if (longer.some((lTok) => lTok.startsWith(sTok))) {
        matches++;
      }
    } else {
      if (longer.includes(sTok)) {
        matches++;
      }
    }
  }

  return matches >= shorter.length && shorter.length >= 2;
}

/**
 * Levenshtein distance calculation
 */
export function computeLevenshteinDistance(a = '', b = '') {
  const s1 = String(a);
  const s2 = String(b);
  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[s2.length][s1.length];
}

/**
 * Checks whether differing characters between two strings can be attributed to known OCR visual glyph confusion.
 * @param {string} strA
 * @param {string} strB
 * @returns {boolean}
 */
export function isSuspectOcrConfusion(strA = '', strB = '') {
  const s1 = String(strA).toUpperCase().replace(/[\s\-_/]/g, '');
  const s2 = String(strB).toUpperCase().replace(/[\s\-_/]/g, '');

  if (s1 === s2) return false;
  if (Math.abs(s1.length - s2.length) > 1) return false;

  const dist = computeLevenshteinDistance(s1, s2);
  if (dist > 2) return false;

  // Check if diff is one or two substitutions matching OCR pairs
  let unmatchingPairFound = false;
  const minLen = Math.min(s1.length, s2.length);

  for (let i = 0; i < minLen; i++) {
    if (s1[i] !== s2[i]) {
      const c1 = s1[i];
      const c2 = s2[i];
      const isKnownPair = OCR_GLYPH_CONFUSIONS.some(
        ([g1, g2]) => (c1 === g1 && c2 === g2) || (c1 === g2 && c2 === g1)
      );
      if (isKnownPair) {
        unmatchingPairFound = true;
      }
    }
  }

  return unmatchingPairFound;
}

/**
 * Detect contradictions between two DATE_OF_BIRTH facts.
 * @param {object} factA
 * @param {object} factB
 * @returns {object | null}
 */
export function compareBirthDates(factA, factB) {
  const dateA = parseAndNormalizeDate(factA.normalizedValue || factA.rawValue);
  const dateB = parseAndNormalizeDate(factB.normalizedValue || factB.rawValue);

  if (!dateA || !dateB) return null;
  if (dateA.isoDate === dateB.isoDate) return null;

  // Check day-month transposition (e.g. 12/06 vs 06/12)
  const isTransposition =
    dateA.day === dateB.month &&
    dateA.month === dateB.day &&
    dateA.year === dateB.year &&
    dateA.day <= 12 &&
    dateB.day <= 12;

  const minOcrConfidence = Math.min(
    factA.provenance?.ocrConfidence ?? 1,
    factB.provenance?.ocrConfidence ?? 1
  );

  if (isTransposition && minOcrConfidence < 0.85) {
    return {
      conflictType: CONFLICT_TYPES.SUSPECT_OCR_CONFUSION,
      severity: CONFLICT_SEVERITIES.WARNING,
      ruleId: 'RULE_DATE_DAY_MONTH_TRANSPOSITION',
      diagnosticMessage: `Possible day-month interpretation ambiguity between ${factA.rawValue} and ${factB.rawValue} (OCR confidence ${Math.round(minOcrConfidence * 100)}%).`,
      suggestedResolution: 'Verify whether the document uses DD/MM/YYYY or MM/DD/YYYY format.',
      isFalseContradiction: true,
    };
  }

  return {
    conflictType: CONFLICT_TYPES.EXACT_VALUE_MISMATCH,
    severity: CONFLICT_SEVERITIES.CRITICAL,
    ruleId: 'RULE_DOB_EXACT_MISMATCH',
    diagnosticMessage: `Conflicting Dates of Birth: '${dateA.isoDate}' on ${factA.provenance.documentType} vs '${dateB.isoDate}' on ${factB.provenance.documentType}.`,
    suggestedResolution: 'Select the authoritative document (such as Municipal Birth Certificate or Aadhaar) to avoid counter-rejection.',
    isFalseContradiction: false,
  };
}

/**
 * Detect contradictions or near matches between two FULL_NAME or PARENT_SPOUSE_NAME facts.
 * @param {object} factA
 * @param {object} factB
 * @returns {object | null}
 */
export function compareNames(factA, factB) {
  const normA = normalizeName(factA.normalizedValue || factA.rawValue);
  const normB = normalizeName(factB.normalizedValue || factB.rawValue);

  if (!normA || !normB) return null;
  if (normA === normB) return null;

  // Inverted name order (e.g. "Sharma Rahul" vs "Rahul Sharma")
  const tokensA = normA.split(' ').sort().join(' ');
  const tokensB = normB.split(' ').sort().join(' ');
  if (tokensA === tokensB) {
    return {
      conflictType: CONFLICT_TYPES.PHONETIC_NEAR_MATCH,
      severity: CONFLICT_SEVERITIES.INFORMATIONAL,
      ruleId: 'RULE_NAME_INVERTED_ORDER',
      diagnosticMessage: `Name components match in reversed order ('${factA.rawValue}' vs '${factB.rawValue}').`,
      suggestedResolution: 'Confirm your First Name and Surname order as per official application guidelines.',
      isFalseContradiction: true,
    };
  }

  // Initials expansion check (e.g. "K Suresh" vs "Kumar Suresh")
  if (isInitialsExpansion(normA, normB)) {
    return {
      conflictType: CONFLICT_TYPES.INITIALS_EXPANSION_VARIATION,
      severity: CONFLICT_SEVERITIES.WARNING,
      ruleId: 'RULE_NAME_INITIALS_EXPANSION',
      diagnosticMessage: `Initials expansion detected between '${factA.rawValue}' and '${factB.rawValue}'.`,
      suggestedResolution: 'Government portals may require full expanded names. Keep an affidavit or gazette notice ready if requested.',
      isFalseContradiction: true,
    };
  }

  // Indic Phonetic similarity (e.g. "Lakshmi" vs "Laxmi", "Choudhary" vs "Chowdhury")
  const keyA = indicPhoneticKey(normA);
  const keyB = indicPhoneticKey(normB);
  if (keyA === keyB) {
    return {
      conflictType: CONFLICT_TYPES.PHONETIC_NEAR_MATCH,
      severity: CONFLICT_SEVERITIES.WARNING,
      ruleId: 'RULE_NAME_INDIC_PHONETIC_MATCH',
      diagnosticMessage: `Phonetic transliteration near-match ('${factA.rawValue}' vs '${factB.rawValue}'). Common in Indic English transliteration.`,
      suggestedResolution: 'Verify if your primary photo ID spelling matches your application submission exactly.',
      isFalseContradiction: true,
    };
  }

  // Small Levenshtein typo (edit distance <= 2 on longer names)
  const dist = computeLevenshteinDistance(normA, normB);
  if (dist <= 2 && Math.min(normA.length, normB.length) >= 6) {
    return {
      conflictType: CONFLICT_TYPES.PHONETIC_NEAR_MATCH,
      severity: CONFLICT_SEVERITIES.WARNING,
      ruleId: 'RULE_NAME_MINOR_SPELLING_TYPO',
      diagnosticMessage: `Minor spelling variation between '${factA.rawValue}' and '${factB.rawValue}' (${dist} character difference).`,
      suggestedResolution: 'Inspect original documents for typographical errors before submission.',
      isFalseContradiction: true,
    };
  }

  // Definite name mismatch
  return {
    conflictType: CONFLICT_TYPES.EXACT_VALUE_MISMATCH,
    severity: CONFLICT_SEVERITIES.CRITICAL,
    ruleId: 'RULE_NAME_EXACT_MISMATCH',
    diagnosticMessage: `Substantially different names detected: '${factA.rawValue}' vs '${factB.rawValue}'.`,
    suggestedResolution: 'Ensure identity documents belong to the same citizen or provide marriage certificate / name change gazette.',
    isFalseContradiction: false,
  };
}

/**
 * Detect contradictions or OCR confusions between DOCUMENT_IDENTIFIER or APPLICATION_ACK_NUMBER facts.
 * @param {object} factA
 * @param {object} factB
 * @returns {object | null}
 */
export function compareReferenceNumbers(factA, factB) {
  const rawA = String(factA.normalizedValue || factA.rawValue).trim();
  const rawB = String(factB.normalizedValue || factB.rawValue).trim();

  // If referencing different types of document IDs (e.g. PAN vs Aadhaar), they shouldn't match
  const docTypeA = factA.provenance?.documentType;
  const docTypeB = factB.provenance?.documentType;

  // Only compare if they are claimed to be the same identifier type or same document type
  if (factA.factType === FACT_TYPES.DOCUMENT_IDENTIFIER && docTypeA && docTypeB && docTypeA !== docTypeB) {
    return null; // Different documents legitimately have different IDs (e.g. PAN vs Passport)
  }

  const cleanA = rawA.replace(/[\s\-_/]/g, '').toUpperCase();
  const cleanB = rawB.replace(/[\s\-_/]/g, '').toUpperCase();

  if (!cleanA || !cleanB || cleanA === cleanB) return null;

  // Check OCR glyph confusion (e.g. 'O' vs '0')
  if (isSuspectOcrConfusion(cleanA, cleanB)) {
    return {
      conflictType: CONFLICT_TYPES.SUSPECT_OCR_CONFUSION,
      severity: CONFLICT_SEVERITIES.WARNING,
      ruleId: 'RULE_REF_SUSPECT_OCR_GLYPH',
      diagnosticMessage: `Likely OCR character scan confusion between '${rawA}' and '${rawB}' (e.g., O/0, I/1, S/5).`,
      suggestedResolution: 'Manually inspect original physical scan to confirm correct numeral/letter.',
      isFalseContradiction: true,
    };
  }

  return {
    conflictType: CONFLICT_TYPES.EXACT_VALUE_MISMATCH,
    severity: CONFLICT_SEVERITIES.CRITICAL,
    ruleId: 'RULE_REF_EXACT_MISMATCH',
    diagnosticMessage: `Mismatched reference / identifier numbers: '${rawA}' vs '${rawB}'.`,
    suggestedResolution: 'Verify the application acknowledgement receipt matches your official tracking number.',
    isFalseContradiction: false,
  };
}

/**
 * Compare chronological facts (e.g. birth date vs issue date or expiry date).
 * @param {object} factA
 * @param {object} factB
 * @returns {object | null}
 */
export function compareChronology(factA, factB) {
  // Check DOB vs ISSUANCE_DATE or EXPIRY_DATE
  const isBirthVsIssuance =
    factA.factType === FACT_TYPES.DATE_OF_BIRTH && factB.factType === FACT_TYPES.ISSUANCE_DATE;
  const isBirthVsExpiry =
    factA.factType === FACT_TYPES.DATE_OF_BIRTH && factB.factType === FACT_TYPES.EXPIRY_DATE;
  const isIssuanceVsExpiry =
    factA.factType === FACT_TYPES.ISSUANCE_DATE && factB.factType === FACT_TYPES.EXPIRY_DATE;

  if (!isBirthVsIssuance && !isBirthVsExpiry && !isIssuanceVsExpiry) return null;

  const dateA = parseAndNormalizeDate(factA.normalizedValue || factA.rawValue);
  const dateB = parseAndNormalizeDate(factB.normalizedValue || factB.rawValue);

  if (!dateA || !dateB) return null;

  if (isBirthVsIssuance && dateA.isoDate >= dateB.isoDate) {
    return {
      conflictType: CONFLICT_TYPES.CHRONOLOGY_VIOLATION,
      severity: CONFLICT_SEVERITIES.CRITICAL,
      ruleId: 'RULE_CHRONOLOGY_BIRTH_AFTER_ISSUANCE',
      diagnosticMessage: `Chronology error: Date of birth (${dateA.isoDate}) is on or after document issuance date (${dateB.isoDate}).`,
      suggestedResolution: 'Verify document issue dates; a document cannot be issued before the citizen birth date.',
      isFalseContradiction: false,
    };
  }

  if (isIssuanceVsExpiry && dateA.isoDate >= dateB.isoDate) {
    return {
      conflictType: CONFLICT_TYPES.CHRONOLOGY_VIOLATION,
      severity: CONFLICT_SEVERITIES.CRITICAL,
      ruleId: 'RULE_CHRONOLOGY_EXPIRY_BEFORE_ISSUANCE',
      diagnosticMessage: `Chronology error: Document issuance date (${dateA.isoDate}) is on or after its expiry date (${dateB.isoDate}).`,
      suggestedResolution: 'Check validity period on certificate or licence.',
      isFalseContradiction: false,
    };
  }

  return null;
}

/**
 * Run all contradiction rules across a list of typed fact nodes.
 * @param {Array<object>} facts
 * @returns {Array<object>} List of ConflictEdge objects
 */
export function detectAllContradictions(facts = []) {
  if (!Array.isArray(facts) || facts.length < 2) return [];

  const conflicts = [];
  let edgeCounter = 1;

  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const factA = facts[i];
      const factB = facts[j];

      // Avoid comparing facts from the exact same field extraction on the same document
      if (factA.id === factB.id || factA.provenance?.documentId === factB.provenance?.documentId) {
        // We still check chronology within the same document (e.g. birth date vs issue date)
        const chronologyCheck = compareChronology(factA, factB);
        if (chronologyCheck) {
          conflicts.push({
            id: `conflict-edge-${edgeCounter++}`,
            sourceFactId: factA.id,
            targetFactId: factB.id,
            factType: factA.factType,
            ...chronologyCheck,
            resolutionStatus: RESOLUTION_STATUSES.UNRESOLVED,
          });
        }
        continue;
      }

      let finding;

      if (factA.factType === FACT_TYPES.DATE_OF_BIRTH && factB.factType === FACT_TYPES.DATE_OF_BIRTH) {
        finding = compareBirthDates(factA, factB);
      } else if (
        (factA.factType === FACT_TYPES.FULL_NAME && factB.factType === FACT_TYPES.FULL_NAME) ||
        (factA.factType === FACT_TYPES.PARENT_SPOUSE_NAME && factB.factType === FACT_TYPES.PARENT_SPOUSE_NAME)
      ) {
        finding = compareNames(factA, factB);
      } else if (
        factA.factType === FACT_TYPES.DOCUMENT_IDENTIFIER &&
        factB.factType === FACT_TYPES.DOCUMENT_IDENTIFIER
      ) {
        finding = compareReferenceNumbers(factA, factB);
      } else if (
        factA.factType === FACT_TYPES.APPLICATION_ACK_NUMBER &&
        factB.factType === FACT_TYPES.APPLICATION_ACK_NUMBER
      ) {
        finding = compareReferenceNumbers(factA, factB);
      } else {
        finding = compareChronology(factA, factB);
      }

      if (finding) {
        conflicts.push({
          id: `conflict-edge-${edgeCounter++}`,
          sourceFactId: factA.id,
          targetFactId: factB.id,
          factType: factA.factType,
          ...finding,
          resolutionStatus: RESOLUTION_STATUSES.UNRESOLVED,
        });
      }
    }
  }

  return conflicts;
}
