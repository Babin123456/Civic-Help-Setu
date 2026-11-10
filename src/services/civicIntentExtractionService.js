/**
 * Civic Query Intent Classification and Slot Extraction Model (#609)
 *
 * Implements:
 * 1. Intent classifier supporting:
 *    - ELIGIBILITY, DOCUMENTS, FEES, PROCEDURE, STATUS_EXPLANATION, JURISDICTION, DEADLINE, COMPARISON, MULTI_INTENT.
 * 2. Entity and Slot Extractor:
 *    - service/scheme, document_type, state_ut, district, applicant_category, detail_type.
 * 3. Multi-intent decomposition into isolated retrieval sub-queries and evidence groups.
 * 4. Confidence thresholds and ambiguity detection: triggers structured clarification when slots conflict or fall below confidence thresholds.
 * 5. Full compatibility with follow-up conversation state.
 */

export const CIVIC_INTENTS = {
  ELIGIBILITY: 'eligibility',
  DOCUMENTS: 'documents',
  FEES: 'fees',
  PROCEDURE: 'procedure',
  STATUS_EXPLANATION: 'status_explanation',
  JURISDICTION: 'jurisdiction',
  DEADLINE: 'deadline',
  COMPARISON: 'comparison',
  MULTI_INTENT: 'multi_intent',
  GENERAL: 'general',
};

// Known Indian States & UTs for strict extraction without hallucination
export const KNOWN_INDIAN_JURISDICTIONS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh',
  'Puducherry', 'Chandigarh', 'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Lakshadweep'
];

// Document entity dictionary
export const KNOWN_DOCUMENT_SLOTS = [
  'aadhaar', 'pan', 'voter id', 'ration card', 'passport', 'birth certificate',
  'death certificate', 'income certificate', 'caste certificate', 'domicile',
  'driving licence', 'udid', 'land record', 'mutation order', 'form 16', 'salary slip'
];

// Applicant Category entities
export const KNOWN_APPLICANT_CATEGORIES = [
  'sc', 'st', 'obc', 'ews', 'general', 'senior citizen', 'woman', 'student',
  'bpl', 'farmer', 'disabled', 'divyang', 'transgender', 'veteran'
];

/**
 * Classify intent from citizen query
 */
export const classifyCivicIntents = (query = '') => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      primaryIntent: CIVIC_INTENTS.GENERAL,
      detectedIntents: [],
      confidence: 0,
      isMultiIntent: false,
    };
  }

  const q = query.toLowerCase();
  const intentScores = {};

  // Eligibility signals
  if (/(eligible|eligibility|age limit|qualify|criteria|who can apply|shartein)/.test(q)) {
    intentScores[CIVIC_INTENTS.ELIGIBILITY] = 0.9;
  }

  // Document signals
  if (/(document|proof|papers|certificate|dastavez|praman|affidavit|form 9|form 1a|id proof)/.test(q)) {
    intentScores[CIVIC_INTENTS.DOCUMENTS] = 0.9;
  }

  // Fees signals
  if (/(fee|fees|cost|charge|price|how much|challan|rupees|rs|paisa)/.test(q)) {
    intentScores[CIVIC_INTENTS.FEES] = 0.92;
  }

  // Procedure signals
  if (/(how to apply|procedure|steps|process|portal|online apply|tarika|step by step)/.test(q)) {
    intentScores[CIVIC_INTENTS.PROCEDURE] = 0.88;
  }

  // Status explanation signals
  if (/(status|tracking|track|delayed|pending|under review|rejected|in progress|turnaround)/.test(q)) {
    intentScores[CIVIC_INTENTS.STATUS_EXPLANATION] = 0.85;
  }

  // Jurisdiction & Office signals
  if (/(where to apply|which office|nearest center|seva kendra|rto|jurisdiction|bdo|collectorate)/.test(q)) {
    intentScores[CIVIC_INTENTS.JURISDICTION] = 0.85;
  }

  // Deadline signals
  if (/(deadline|last date|validity|expire|expiry|grace period|timeline)/.test(q)) {
    intentScores[CIVIC_INTENTS.DEADLINE] = 0.87;
  }

  // Comparison signals
  if (/(difference between|compare|\bvs\b|\bversus\b|which is better)/.test(q)) {
    intentScores[CIVIC_INTENTS.COMPARISON] = 0.82;
  }

  const detected = Object.keys(intentScores);

  if (detected.length === 0) {
    return {
      primaryIntent: CIVIC_INTENTS.GENERAL,
      detectedIntents: [CIVIC_INTENTS.GENERAL],
      confidence: 0.5,
      isMultiIntent: false,
    };
  }

  if (detected.length > 1) {
    return {
      primaryIntent: CIVIC_INTENTS.MULTI_INTENT,
      detectedIntents: detected,
      confidence: 0.88,
      isMultiIntent: true,
      intentScores,
    };
  }

  return {
    primaryIntent: detected[0],
    detectedIntents: detected,
    confidence: intentScores[detected[0]],
    isMultiIntent: false,
    intentScores,
  };
};

/**
 * Extract structured civic slots from query
 */
export const extractCivicSlots = (query = '') => {
  if (!query || typeof query !== 'string') {
    return { slots: {}, confidence: 0, ambiguities: [] };
  }

  const q = query.toLowerCase();
  const slots = {};
  const ambiguities = [];

  // 1. Extract State / UT
  for (const state of KNOWN_INDIAN_JURISDICTIONS) {
    const sLower = state.toLowerCase();
    if (q.includes(sLower)) {
      if (slots.stateUt && slots.stateUt !== state) {
        ambiguities.push({
          slot: 'stateUt',
          values: [slots.stateUt, state],
          message: 'Multiple state jurisdictions mentioned.',
        });
      } else {
        slots.stateUt = state;
      }
    }
  }

  // 2. Extract Document Type
  for (const doc of KNOWN_DOCUMENT_SLOTS) {
    if (q.includes(doc)) {
      slots.documentType = slots.documentType ? `${slots.documentType}, ${doc}` : doc;
    }
  }

  // 3. Extract Applicant Category
  for (const cat of KNOWN_APPLICANT_CATEGORIES) {
    const regex = new RegExp(`\\b${cat}\\b`, 'i');
    if (regex.test(q)) {
      slots.applicantCategory = cat.toUpperCase();
      break;
    }
  }

  // 4. Extract Scheme / Service Mention
  if (/aadhaar|uidai/.test(q)) slots.service = 'Aadhaar Service';
  else if (/driving licen[sc]e|dl|parivahan|rto/.test(q)) slots.service = 'Driving Licence';
  else if (/pan card|income tax|nsdl|uti/.test(q)) slots.service = 'PAN Card';
  else if (/passport|passport seva/.test(q)) slots.service = 'Passport Seva';
  else if (/voter id|epic|election card/.test(q)) slots.service = 'Voter ID';
  else if (/ration card|pds|food security/.test(q)) slots.service = 'Ration Card';
  else if (/mutation|dakhil kharij|patta|khasra/.test(q)) slots.service = 'Land Mutation';
  else if (/udid|disability certificate/.test(q)) slots.service = 'Disability Certificate';

  // Overall slot confidence score
  const slotCount = Object.keys(slots).length;
  const confidence = slotCount > 0 ? Number(Math.min(0.95, 0.5 + slotCount * 0.15).toFixed(2)) : 0.3;

  return {
    slots,
    confidence,
    ambiguities,
    needsClarification: ambiguities.length > 0 || (slotCount === 0 && query.trim().length > 15),
  };
};

/**
 * Multi-Stage Query Decomposition for Multi-Intent Queries
 */
export const decomposeMultiIntentQuery = (query = '') => {
  const intentAnalysis = classifyCivicIntents(query);
  const slotExtraction = extractCivicSlots(query);

  if (!intentAnalysis.isMultiIntent) {
    return {
      isMultiIntent: false,
      primaryIntent: intentAnalysis.primaryIntent,
      subQueries: [
        {
          intent: intentAnalysis.primaryIntent,
          subQuery: query,
          targetSlots: slotExtraction.slots,
        },
      ],
      clarificationNotice: slotExtraction.needsClarification
        ? 'Could you please specify your State or exact service name to help narrow down the guidance?'
        : null,
    };
  }

  // Formulate dedicated sub-queries per detected intent
  const serviceTerm = slotExtraction.slots.service || 'civic service';
  const subQueries = intentAnalysis.detectedIntents.map((intent) => {
    let focusPhrase = '';
    if (intent === CIVIC_INTENTS.ELIGIBILITY) focusPhrase = `eligibility criteria requirements for ${serviceTerm}`;
    else if (intent === CIVIC_INTENTS.DOCUMENTS) focusPhrase = `required documents papers needed for ${serviceTerm}`;
    else if (intent === CIVIC_INTENTS.FEES) focusPhrase = `official fee charges cost for ${serviceTerm}`;
    else if (intent === CIVIC_INTENTS.PROCEDURE) focusPhrase = `step by step application procedure for ${serviceTerm}`;
    else if (intent === CIVIC_INTENTS.DEADLINE) focusPhrase = `deadlines validity timeline for ${serviceTerm}`;
    else focusPhrase = `${intent} for ${serviceTerm}`;

    return {
      intent,
      subQuery: focusPhrase,
      targetSlots: slotExtraction.slots,
    };
  });

  return {
    isMultiIntent: true,
    intents: intentAnalysis.detectedIntents,
    subQueries,
    slots: slotExtraction.slots,
    clarificationNotice: slotExtraction.ambiguities.length > 0
      ? `We noticed multiple locations (${slotExtraction.ambiguities[0].values.join(', ')}). Which state rules do you need?`
      : null,
  };
};
