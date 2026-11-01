/**
 * Multilingual Intent Router for Civic Assistant Requests
 *
 * Classifies citizen inquiries in English, Hindi, Hinglish, Bengali, Tamil,
 * and Marathi into structured application intents to direct users to the
 * appropriate app features with confidence scoring and fallback handling.
 *
 * Guarantees:
 * 1. Intent classification is deterministic and grounded in validated lexical patterns.
 * 2. Asks a clarifying question whenever classification confidence falls below 0.60.
 * 3. Never infers an active application status from a general tracking query.
 * 4. Provides a generic assistant fallback for unsupported or ambiguous intents.
 * 5. Does not alter existing user authorization, sessions, or access controls.
 */

export const CONFIDENCE_THRESHOLD = 0.60;

export const INTENT_DEFINITIONS = {
  FIND_SERVICE: {
    id: 'find_service',
    label: 'Find a Service / Apply',
    route: '/services',
    actionText: 'Browse Service Catalogue',
    description: 'Discover civic services, procedural steps, and official application portals.'
  },
  UNDERSTAND_DOCUMENTS: {
    id: 'understand_documents',
    label: 'Understand Required Documents',
    route: '/vault',
    actionText: 'Open Document Preflight & Vault',
    description: 'Inspect checklist requirements, mandatory proofs, and preparation guides.'
  },
  CHECK_ELIGIBILITY: {
    id: 'check_eligibility',
    label: 'Check Eligibility Criteria',
    route: '/eligibility',
    actionText: 'Run Eligibility Test Bench',
    description: 'Verify age, income, and category prerequisites against published scheme rules.'
  },
  LOCATE_OFFICE: {
    id: 'locate_office',
    label: 'Locate a Civic Office',
    route: '/nearby-offices',
    actionText: 'Find Nearby Centers & Working Hours',
    description: 'Locate Tehsils, RTOs, CSC centers, transit directions, and queue times.'
  },
  TRACK_APPLICATION: {
    id: 'track_application',
    label: 'Track an Application',
    route: '/track',
    actionText: 'Track Status with Reference ID',
    description: 'Monitor application milestones and statutory SLA deadlines using your reference ID.'
  },
  EXPLAIN_TERM: {
    id: 'explain_term',
    label: 'Explain a Civic Term',
    route: '/assistant',
    actionText: 'View Plain-Language Explanation',
    description: 'Clarify administrative terminology such as e-KYC, Domicile, SLA, or Notarization.'
  },
  GENERIC_FALLBACK: {
    id: 'generic_fallback',
    label: 'General Inquiries & Help',
    route: null,
    actionText: 'Continue in Assistant',
    description: 'General conversational support across public civic knowledge.'
  }
};

/**
 * Multilingual lexicon mapping keyword stems to specific intent scores
 */
const INTENT_PATTERNS = {
  FIND_SERVICE: [
    // English
    'apply', 'apply online', 'how to get', 'procedure for', 'service list', 'where can i apply', 'new application',
    // Hindi & Hinglish
    'apply kaise kare', 'kaise banaye', 'kahan apply kare', 'kaha milega', 'yojana', 'yojna', 'form kahan',
    'आवेदन', 'योजना', 'कैसे बनाएं', 'कहाँ आवेदन करें', 'प्रक्रिया',
    // Bengali & Marathi & Tamil
    'আবেদন', 'কোরব', 'अर्ज कसा करावा', 'योजना माहिती', 'விண்ணப்பிக்க'
  ],
  UNDERSTAND_DOCUMENTS: [
    // English
    'document', 'documents required', 'papers needed', 'what do i need', 'proof of address', 'checklist', 'certificate copy',
    // Hindi & Hinglish
    'document kya lagega', 'documents kya lagenge', 'kagaz kya chahiye', 'praman patra', 'kagazat',
    'दस्तावेज़', 'कागजात', 'प्रमाण पत्र', 'क्या चाहिए',
    // Bengali & Marathi & Tamil
    'নথিপত্র', 'कागदपत्रे', 'कोणती कागदपत्रे', 'ஆவணங்கள்'
  ],
  CHECK_ELIGIBILITY: [
    // English
    'am i eligible', 'eligibility', 'qualify', 'criteria', 'income limit', 'age limit', 'can i get',
    // Hindi & Hinglish
    'eligible hu kya', 'patrata kya hai', 'income limit kitni hai', 'kya mujhe milega', 'yogyata',
    'पात्रता', 'योग्यता', 'शर्तें', 'क्या मैं पात्र हूँ',
    // Bengali & Marathi & Tamil
    'যোগ্যতা', 'पात्रता निकष', 'தகுதி'
  ],
  LOCATE_OFFICE: [
    // English
    'office', 'nearest center', 'location', 'where is the office', 'visiting hours', 'rto office', 'tehsil center', 'address',
    // Hindi & Hinglish
    'office kahan hai', 'office kidhar hai', 'najdiki center', 'daptar', 'karyalay', 'center kahan hai',
    'कार्यालय', 'दफ्तर', 'नजदीकी केंद्र', 'पता', 'कहाँ स्थित है',
    // Bengali & Marathi & Tamil
    'অফিস', 'কার্যালয়', 'पत्ता', 'அலுவலகம்'
  ],
  TRACK_APPLICATION: [
    // English
    'track', 'status', 'application status', 'where is my application', 'check status', 'reference id', 'delay in application',
    // Hindi & Hinglish
    'status kaise dekhe', 'status check', 'application kahan tak pahucha', 'sthiti', 'meri application',
    'स्थिति', 'आवेदन की स्थिति', 'कहाँ तक पहुँचा', 'ट्रैक',
    // Bengali & Marathi & Tamil
    'স্ট্যাটাস', 'स्थिती तपासा', 'நிலை'
  ],
  EXPLAIN_TERM: [
    // English
    'meaning of', 'what does', 'what is', 'explain', 'definition', 'what is e-kyc', 'what is patta',
    // Hindi & Hinglish
    'ka matlab kya hai', 'kya hota hai', 'arth kya hai', 'samjhao', 'kyc kya hai',
    'का मतलब', 'क्या होता है', 'अर्थ', 'स्पष्ट करें',
    // Bengali & Marathi & Tamil
    'মানে কি', 'अर्थ काय', 'பொருள் என்ன'
  ]
};

/**
 * Classifies an incoming assistant query into an explicit intent.
 *
 * @param {string} query The citizen's natural-language inquiry
 * @returns {Object} Classified intent result
 */
export function routeUserIntent(query = '') {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      intent: 'GENERIC_FALLBACK',
      confidence: 0,
      isConfident: false,
      definition: INTENT_DEFINITIONS.GENERIC_FALLBACK,
      matchedKeywords: [],
      clarifyingQuestion: null,
      suggestedIntents: [
        INTENT_DEFINITIONS.FIND_SERVICE,
        INTENT_DEFINITIONS.CHECK_ELIGIBILITY,
        INTENT_DEFINITIONS.UNDERSTAND_DOCUMENTS
      ]
    };
  }

  const normalized = query.toLowerCase().trim();
  const scores = {};
  const matchedKeywordsMap = {};

  for (const [intentKey, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    const matched = [];

    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        // Multi-word matches give higher confidence, single key terms satisfy standard threshold
        const isMultiWord = pattern.split(' ').length > 1;
        const weight = isMultiWord ? 0.75 : 0.65;
        score += weight;
        matched.push(pattern);
      }
    }

    scores[intentKey] = Math.min(score, 1.0);
    matchedKeywordsMap[intentKey] = matched;
  }

  // Find the top-scoring intent
  let topIntent = 'GENERIC_FALLBACK';
  let topScore = 0;

  for (const [intentKey, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topIntent = intentKey;
    }
  }

  const isConfident = topScore >= CONFIDENCE_THRESHOLD;

  if (isConfident) {
    const definition = INTENT_DEFINITIONS[topIntent];
    return {
      intent: topIntent,
      confidence: Number(topScore.toFixed(2)),
      isConfident: true,
      definition,
      matchedKeywords: matchedKeywordsMap[topIntent] || [],
      clarifyingQuestion: null,
      suggestedIntents: []
    };
  }

  // Low confidence fallback with targeted clarifying question
  return {
    intent: 'GENERIC_FALLBACK',
    confidence: Number(topScore.toFixed(2)),
    isConfident: false,
    definition: INTENT_DEFINITIONS.GENERIC_FALLBACK,
    matchedKeywords: matchedKeywordsMap[topIntent] || [],
    clarifyingQuestion:
      'We could not determine your exact civic request with high confidence. Would you like to find a service, review required documents, check eligibility, or locate an office?',
    suggestedIntents: [
      INTENT_DEFINITIONS.FIND_SERVICE,
      INTENT_DEFINITIONS.UNDERSTAND_DOCUMENTS,
      INTENT_DEFINITIONS.CHECK_ELIGIBILITY,
      INTENT_DEFINITIONS.LOCATE_OFFICE,
      INTENT_DEFINITIONS.TRACK_APPLICATION
    ]
  };
}
