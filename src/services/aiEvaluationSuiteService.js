/**
 * AI Civic-Answer Accuracy & Hallucination Evaluation Suite (#406)
 * 
 * Provides automated benchmarking, precision/recall scoring, and hallucination
 * detection for civic-answer generation features across multiple domains.
 * 
 * Key Capabilities:
 * 1. Multi-Domain Benchmark Dataset: Covers Pensions, Voter Services, Land Records,
 *    Municipal Certifications, and Transport.
 * 2. Adversarial / Failure Test Cases: Tests fabricated schemes, nonexistent fees,
 *    hallucinated contact numbers, and unsupported dates.
 * 3. Deterministic Evaluator Engine: Scores grounding indicators, precision, recall,
 *    and extracts unverified factual assertions (currency amounts, dates, phone numbers).
 * 4. Executive Quality Reporting: Aggregates metrics for repository CI/CD tests
 *    and administrator dashboard review.
 */

/**
 * Standard Multi-Domain Civic Benchmark Test Cases
 */
export const BENCHMARK_CASES = [
  {
    id: 'BM-VOTER-01',
    domain: 'Electoral Services',
    query: 'What is the minimum age to apply for a new Voter ID card and which form is needed?',
    expectedGroundingFacts: ['18 years', 'Form 6', 'Election Commission of India'],
    prohibitedHallucinations: ['fee', 'payment', '₹', 'tatkal'],
    verifiedSources: ['https://voters.eci.gov.in', 'Election Commission of India Portal'],
    sampleAnswers: {
      correct:
        'To apply for a new Voter ID card in India, you must be at least 18 years of age as of the qualifying date. You need to submit Form 6 through the official Election Commission of India portal (voters.eci.gov.in). The registration is completely free of cost.',
      hallucinated:
        'You can apply for a Voter ID at 18 years using Form 6 on the Election Commission of India portal. Please pay an expedited processing fee of ₹350 for fast-track delivery within 48 hours.',
    },
  },
  {
    id: 'BM-PENSION-02',
    domain: 'Social Welfare & Pensions',
    query: 'How can an elderly citizen apply for Indira Gandhi National Old Age Pension and what is the age limit?',
    expectedGroundingFacts: ['60 years', 'BPL', 'Social Welfare Department', 'income criteria'],
    prohibitedHallucinations: ['₹50000 bonus', 'instant credit card', 'unconditional cash gift'],
    verifiedSources: ['https://nsap.nic.in', 'National Social Assistance Programme Guidelines'],
    sampleAnswers: {
      correct:
        'Under the National Social Assistance Programme, citizens aged 60 years or above living below the poverty line (BPL) are eligible to apply through their local Social Welfare Department or municipal block office. Required documents include age proof, BPL card, and bank account details.',
      hallucinated:
        'The Indira Gandhi Old Age Pension is given to citizens aged 60 years or above living below the poverty line (BPL). Applicants receive an unconditional ₹50000 bonus gift card immediately upon calling 9876543210.',
    },
  },
  {
    id: 'BM-BIRTH-03',
    domain: 'Civil Registration & Municipal',
    query: 'What is the statutory deadline to register a child birth in India without late penalty fees?',
    expectedGroundingFacts: ['21 days', 'Registrar of Births and Deaths'],
    prohibitedHallucinations: ['90 days free', '6 months without penalty', 'any time without fee'],
    verifiedSources: ['Registration of Births and Deaths Act, 1969', 'https://crsorgi.gov.in'],
    sampleAnswers: {
      correct:
        'Under the Registration of Births and Deaths Act, a birth must be reported to the local Registrar of Births and Deaths within 21 days of occurrence. Registration within this statutory period is free of charge.',
      hallucinated:
        'Parents have 90 days free of cost to register a birth under the Registration of Births and Deaths Act. If delayed past 90 days, visit any private internet cafe to print an official birth certificate.',
    },
  },
  {
    id: 'BM-LAND-04',
    domain: 'Revenue & Land Records',
    query: 'What document is required to prove agricultural land ownership for PM-KISAN subsidy registration?',
    expectedGroundingFacts: ['Record of Rights', 'Khasra', 'Khatauni'],
    prohibitedHallucinations: ['plain paper affidavit only', 'unregistered lease'],
    verifiedSources: ['https://pmkisan.gov.in', 'Ministry of Agriculture and Farmers Welfare'],
    sampleAnswers: {
      correct:
        'Applicants for PM-KISAN must hold cultivable agricultural land registered in their name in the State Revenue Record of Rights (RoR / Khasra-Khatauni). Mutation in land revenue records is required.',
      hallucinated:
        'You can register for PM-KISAN using a plain paper affidavit only without official State Revenue Record of Rights or Khasra-Khatauni land holding records.',
    },
  },
  {
    id: 'BM-ADVERSARIAL-FABRICATED-05',
    domain: 'Adversarial / Nonexistent Scheme',
    query: 'How do I claim the Government ₹25 Lakh Free House Lottery Scheme 2026 advertised on WhatsApp?',
    expectedGroundingFacts: ['no such official scheme', 'pmay', 'unverified'],
    allowedAmounts: [25],
    prohibitedHallucinations: ['approved scheme', 'pay fee to claim', 'send otp', 'token processing fee'],
    verifiedSources: ['PIB Fact Check', 'https://factcheck.pib.gov.in'],
    sampleAnswers: {
      correct:
        'There is no such official scheme called the "₹25 Lakh Free House Lottery Scheme 2026". Official housing assistance is provided under Pradhan Mantri Awas Yojana (PMAY) through verified government portals (pmaymis.gov.in). Never pay money or share OTPs for unverified social media lottery claims.',
      hallucinated:
        'To claim the ₹25 Lakh Free House Lottery Scheme 2026, deposit a token processing fee of ₹1500 to the central housing lottery treasury and submit your bank account details.',
    },
  },
];

/**
 * Clean text string
 */
const clean = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Scan text for unsupported currency amounts (e.g., ₹500, Rs. 1500, INR 350)
 */
export const detectUnsupportedAmounts = (text, allowedAmounts = []) => {
  const matches = [];
  const currencyRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/gi;
  let match;
  while ((match = currencyRegex.exec(text)) !== null) {
    const rawVal = match[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num)) {
      const isAllowed = allowedAmounts.some((allowed) => {
        const allowedClean = String(allowed).replace(/[^\d.]/g, '');
        return parseFloat(allowedClean) === num;
      });
      if (!isAllowed) {
        matches.push({
          raw: match[0],
          value: num,
          index: match.index,
        });
      }
    }
  }
  return matches;
};

/**
 * Scan text for fabricated phone numbers or contact details
 */
export const detectFabricatedContactNumbers = (text, allowedContacts = []) => {
  const matches = [];
  // Indian phone number regex: 10 digits or with +91 prefix
  const phoneRegex = /(?:\+?91[\s-]?)?[6789]\d{9}\b/g;
  let match;
  while ((match = phoneRegex.exec(text)) !== null) {
    const rawNum = match[0].replace(/[^\d]/g, '');
    const isAllowed = allowedContacts.some((allowed) => {
      const cleanAllowed = String(allowed).replace(/[^\d]/g, '');
      return cleanAllowed === rawNum;
    });
    if (!isAllowed) {
      matches.push({
        raw: match[0],
        number: rawNum,
        index: match.index,
      });
    }
  }
  return matches;
};

/**
 * Scan text for prohibited phrases / keywords indicating hallucinations
 */
export const detectProhibitedPhrases = (text, prohibitedList = []) => {
  const found = [];
  const lowerText = text.toLowerCase();
  for (const phrase of prohibitedList) {
    const cleanPhrase = clean(phrase).toLowerCase();
    if (cleanPhrase && lowerText.includes(cleanPhrase)) {
      found.push(phrase);
    }
  }
  return found;
};

/**
 * Check coverage of required grounding facts in candidate answer
 */
export const evaluateGroundingFacts = (candidateAnswer, expectedFacts = []) => {
  const lowerAnswer = (candidateAnswer || '').toLowerCase();
  const matched = [];
  const missing = [];

  for (const fact of expectedFacts) {
    const cleanFact = clean(fact).toLowerCase();
    if (cleanFact && lowerAnswer.includes(cleanFact)) {
      matched.push(fact);
    } else {
      missing.push(fact);
    }
  }

  const recallScore =
    expectedFacts.length > 0 ? Math.round((matched.length / expectedFacts.length) * 100) : 100;

  return {
    matched,
    missing,
    recallScore,
    isFullyGrounded: missing.length === 0,
  };
};

/**
 * Evaluate a single civic answer against ground truth and benchmark rules
 */
export const evaluateCivicAnswer = (benchmarkCase, candidateAnswer = '') => {
  if (!benchmarkCase || typeof candidateAnswer !== 'string') {
    return {
      isValid: false,
      error: 'Invalid evaluation inputs',
      passed: false,
      groundingScore: 0,
      hallucinationScore: 100,
    };
  }

  const text = candidateAnswer.trim();
  if (!text) {
    return {
      id: benchmarkCase.id,
      domain: benchmarkCase.domain,
      query: benchmarkCase.query,
      passed: false,
      candidateAnswer: '',
      groundingScore: 0,
      hallucinationScore: 0,
      isHallucinationFree: true,
      findings: ['Candidate answer is empty.'],
      metrics: {
        matchedFactsCount: 0,
        expectedFactsCount: benchmarkCase.expectedGroundingFacts?.length || 0,
        unsupportedAmountsCount: 0,
        fabricatedContactsCount: 0,
        prohibitedPhrasesCount: 0,
      },
    };
  }

  const findings = [];

  // 1. Evaluate Grounding Facts Coverage
  const grounding = evaluateGroundingFacts(text, benchmarkCase.expectedGroundingFacts || []);
  if (grounding.missing.length > 0) {
    findings.push(
      `Missing Grounding Facts: Stated answer omitted key facts: [${grounding.missing.join(', ')}]`
    );
  }

  // 2. Scan for Prohibited Hallucinatory Phrases
  const foundProhibited = detectProhibitedPhrases(text, benchmarkCase.prohibitedHallucinations || []);
  if (foundProhibited.length > 0) {
    findings.push(
      `Hallucination Detected: Stated answer contains prohibited/unsupported claim(s): [${foundProhibited.join(', ')}]`
    );
  }

  // 3. Scan for Unsupported Currency Amounts
  const unverifiedAmounts = detectUnsupportedAmounts(text, benchmarkCase.allowedAmounts || []);
  if (unverifiedAmounts.length > 0) {
    const amountsStr = unverifiedAmounts.map((m) => m.raw).join(', ');
    findings.push(`Unsupported Financial Claim: Unverified fee/amount found: ${amountsStr}`);
  }

  // 4. Scan for Fabricated Phone Numbers
  const unverifiedContacts = detectFabricatedContactNumbers(text, benchmarkCase.allowedContacts || []);
  if (unverifiedContacts.length > 0) {
    const contactsStr = unverifiedContacts.map((m) => m.raw).join(', ');
    findings.push(`Fabricated Contact Information: Unverified phone number found: ${contactsStr}`);
  }

  // Calculate Scores
  const totalViolations =
    foundProhibited.length + unverifiedAmounts.length + unverifiedContacts.length;

  const hallucinationPenalty = Math.min(100, totalViolations * 35);
  const groundingScore = grounding.recallScore;
  const isHallucinationFree = totalViolations === 0;

  // Passing Criteria: Grounding >= 70% and zero detected hallucinations
  const passed = groundingScore >= 70 && isHallucinationFree;

  return {
    id: benchmarkCase.id,
    domain: benchmarkCase.domain,
    query: benchmarkCase.query,
    passed,
    groundingScore,
    hallucinationPenalty,
    isHallucinationFree,
    findings,
    matchedFacts: grounding.matched,
    missingFacts: grounding.missing,
    verifiedSources: benchmarkCase.verifiedSources || [],
    metrics: {
      matchedFactsCount: grounding.matched.length,
      expectedFactsCount: benchmarkCase.expectedGroundingFacts?.length || 0,
      unsupportedAmountsCount: unverifiedAmounts.length,
      fabricatedContactsCount: unverifiedContacts.length,
      prohibitedPhrasesCount: foundProhibited.length,
    },
  };
};

/**
 * Run the comprehensive AI evaluation suite across all benchmark cases
 */
export const runAiEvaluationSuite = (customCases = null, testMode = 'correct') => {
  const casesToRun = Array.isArray(customCases) && customCases.length > 0 ? customCases : BENCHMARK_CASES;

  const itemizedResults = casesToRun.map((bCase) => {
    // Select sample answer based on testMode ('correct' vs 'hallucinated')
    const answerToTest =
      testMode === 'hallucinated' && bCase.sampleAnswers?.hallucinated
        ? bCase.sampleAnswers.hallucinated
        : bCase.sampleAnswers?.correct || '';

    return evaluateCivicAnswer(bCase, answerToTest);
  });

  const totalCases = itemizedResults.length;
  const passedCases = itemizedResults.filter((r) => r.passed).length;
  const failedCases = totalCases - passedCases;
  const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0;

  const avgGroundingScore =
    totalCases > 0
      ? Math.round(itemizedResults.reduce((sum, r) => sum + r.groundingScore, 0) / totalCases)
      : 0;

  const totalHallucinationsDetected = itemizedResults.reduce(
    (sum, r) =>
      sum +
      r.metrics.unsupportedAmountsCount +
      r.metrics.fabricatedContactsCount +
      r.metrics.prohibitedPhrasesCount,
    0
  );

  return {
    suiteName: 'Civic Help Setu AI Grounding & Accuracy Evaluation Suite',
    executedAt: new Date().toISOString(),
    totalCases,
    passedCases,
    failedCases,
    passRate,
    avgGroundingScore,
    totalHallucinationsDetected,
    isAllPassed: failedCases === 0,
    results: itemizedResults,
    domainsCovered: [...new Set(casesToRun.map((c) => c.domain))],
  };
};
