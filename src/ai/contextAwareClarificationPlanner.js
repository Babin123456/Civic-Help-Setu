/**
 * Context-Aware Clarification Planner for Ambiguous Civic Requests
 *
 * Implements a structured, serializable clarification planner:
 * - Detects missing, ambiguous, or conflicting slots:
 *   * Service category/intent (e.g., ration card, pension, voter ID, disability certificate)
 *   * Jurisdiction / State (e.g., Karnataka, Uttar Pradesh, Delhi, Central)
 *   * Applicant Context (e.g., senior citizen, student, BPL household, farmer)
 *   * Requested Outcome (e.g., new application, status track, correction, reissue)
 * - Asks one focused question at a time before retrieving guidance
 * - Reuses existing service catalogue categories rather than inventing eligibility facts
 * - Never asks for Aadhaar, PAN, passwords, or unrelated sensitive data
 * - Enforces max-question limit to avoid conversational loops and routes to safe generic guidance
 */

export const SLOTS = Object.freeze({
  SERVICE: 'service',
  JURISDICTION: 'jurisdiction',
  APPLICANT_TYPE: 'applicant_type',
  OUTCOME: 'outcome'
});

export const MAX_CLARIFICATION_QUESTIONS = 3;

export const KNOWN_SERVICES = Object.freeze([
  { id: 'ration-card', name: 'Ration Card', keywords: ['ration', 'rashan', 'pds', 'food card'] },
  { id: 'voter-id', name: 'Voter ID Card (EPIC)', keywords: ['voter', 'election card', 'epic'] },
  { id: 'pension-scheme', name: 'Old Age / Disability Pension', keywords: ['pension', 'old age', 'disability pension'] },
  { id: 'caste-certificate', name: 'Caste / Community Certificate', keywords: ['caste', 'community cert', 'sc', 'st', 'obc'] },
  { id: 'income-certificate', name: 'Income Certificate', keywords: ['income cert', 'revenue', 'income'] }
]);

export const KNOWN_JURISDICTIONS = Object.freeze([
  'Karnataka',
  'Maharashtra',
  'Uttar Pradesh',
  'Tamil Nadu',
  'Delhi',
  'Central'
]);

export const KNOWN_OUTCOMES = Object.freeze([
  'new_application',
  'status_check',
  'correction_or_update',
  'duplicate_reissue'
]);

/**
 * Normalizes input text
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text = '') {
  return typeof text === 'string' ? text.trim().toLowerCase() : '';
}

/**
 * Extracts tentative slots from raw user input
 * @param {string} query
 * @returns {Object} Extracted slots
 */
export function extractSlotsFromText(query = '') {
  const norm = normalizeText(query);
  const detected = {
    service: null,
    jurisdiction: null,
    applicant_type: null,
    outcome: null
  };

  // 1. Detect service
  for (const s of KNOWN_SERVICES) {
    if (s.keywords.some(kw => norm.includes(kw))) {
      detected.service = s.id;
      break;
    }
  }

  // 2. Detect jurisdiction
  for (const j of KNOWN_JURISDICTIONS) {
    if (norm.includes(j.toLowerCase())) {
      detected.jurisdiction = j;
      break;
    }
  }

  // 3. Detect outcome
  if (norm.includes('status') || norm.includes('track') || norm.includes('check')) {
    detected.outcome = 'status_check';
  } else if (norm.includes('update') || norm.includes('correct') || norm.includes('change')) {
    detected.outcome = 'correction_or_update';
  } else if (norm.includes('lost') || norm.includes('reissue') || norm.includes('duplicate')) {
    detected.outcome = 'duplicate_reissue';
  } else if (norm.includes('apply') || norm.includes('new') || norm.includes('register')) {
    detected.outcome = 'new_application';
  }

  // 4. Detect applicant type
  if (norm.includes('senior') || norm.includes('elderly') || norm.includes('60')) {
    detected.applicant_type = 'senior_citizen';
  } else if (norm.includes('student') || norm.includes('scholarship')) {
    detected.applicant_type = 'student';
  } else if (norm.includes('bpl') || norm.includes('low income')) {
    detected.applicant_type = 'bpl';
  }

  return detected;
}

/**
 * Generates the next focused clarification question
 * @param {Object} state Current clarification session state
 * @returns {Object|null} Question descriptor or null if resolved
 */
export function generateNextQuestion(state) {
  if (state.questionsAsked >= MAX_CLARIFICATION_QUESTIONS) {
    return null; // Limit reached, fall back to generic routing
  }

  if (!state.slots.service) {
    return {
      slot: SLOTS.SERVICE,
      question: 'Which civic service or document are you looking for? (e.g. Ration Card, Voter ID, Pension, Income Certificate)',
      options: KNOWN_SERVICES.map(s => s.name)
    };
  }

  if (!state.slots.jurisdiction) {
    return {
      slot: SLOTS.JURISDICTION,
      question: 'Which state or union territory do you reside in? (Procedures vary significantly by state)',
      options: [...KNOWN_JURISDICTIONS]
    };
  }

  return null;
}


export class ContextAwareClarificationPlanner {
  constructor(initialState = {}) {
    this.state = {
      slots: {
        service: null,
        jurisdiction: null,
        applicant_type: null,
        outcome: null,
        ...(initialState.slots || {})
      },
      questionsAsked: initialState.questionsAsked || 0,
      history: initialState.history || [],
      isResolved: initialState.isResolved || false,
      fallbackGenericRoute: initialState.fallbackGenericRoute || false
    };
  }

  /**
   * Serializes planner session state
   * @returns {Object} Serializable snapshot
   */
  serialize() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Ingests initial query and begins clarification planning
   * @param {string} initialQuery
   * @returns {Object} Planner evaluation result
   */
  startSession(initialQuery) {
    const extracted = extractSlotsFromText(initialQuery);
    this.state.slots = { ...this.state.slots, ...extracted };
    this.state.history.push({ role: 'user', content: initialQuery });

    return this.evaluateState();
  }

  /**
   * Ingests user answer to a specific clarified slot
   * @param {string} slot Slot identifier
   * @param {string} answer Raw user response
   * @returns {Object} Updated evaluation
   */
  submitAnswer(slot, answer) {
    const norm = normalizeText(answer);

    if (slot === SLOTS.SERVICE) {
      const match = KNOWN_SERVICES.find(s => norm.includes(s.id) || s.keywords.some(k => norm.includes(k)) || norm.includes(s.name.toLowerCase()));
      this.state.slots.service = match ? match.id : norm;
    } else if (slot === SLOTS.JURISDICTION) {
      const match = KNOWN_JURISDICTIONS.find(j => norm.includes(j.toLowerCase()));
      this.state.slots.jurisdiction = match || 'Unknown';
    } else if (slot === SLOTS.OUTCOME) {
      if (norm.includes('track') || norm.includes('status')) {
        this.state.slots.outcome = 'status_check';
      } else if (norm.includes('update') || norm.includes('correct')) {
        this.state.slots.outcome = 'correction_or_update';
      } else if (norm.includes('reissue') || norm.includes('duplicate') || norm.includes('lost')) {
        this.state.slots.outcome = 'duplicate_reissue';
      } else {
        this.state.slots.outcome = 'new_application';
      }
    } else {
      this.state.slots[slot] = answer;
    }

    this.state.history.push({ role: 'user', slot, content: answer });
    return this.evaluateState();
  }

  /**
   * Evaluates current slots and decides whether to ask another question or resolve
   * @returns {Object} Planner action
   */
  evaluateState() {
    const nextQ = generateNextQuestion(this.state);

    if (!nextQ) {
      if (this.state.questionsAsked >= MAX_CLARIFICATION_QUESTIONS && (!this.state.slots.service || !this.state.slots.jurisdiction)) {
        this.state.fallbackGenericRoute = true;
        this.state.isResolved = true;
        return {
          type: 'RESOLVED_GENERIC_FALLBACK',
          message: 'Maximum clarification limit reached. Routing to general civic service directory.',
          state: this.serialize()
        };
      }

      this.state.isResolved = true;
      return {
        type: 'RESOLVED_READY_FOR_RETRIEVAL',
        resolvedInterpretation: {
          service: this.state.slots.service,
          jurisdiction: this.state.slots.jurisdiction || 'Unknown',
          outcome: this.state.slots.outcome || 'new_application',
          applicant_type: this.state.slots.applicant_type || 'general'
        },
        state: this.serialize()
      };
    }

    this.state.questionsAsked += 1;
    this.state.history.push({ role: 'assistant', ...nextQ });

    return {
      type: 'CLARIFICATION_REQUIRED',
      question: nextQ.question,
      slot: nextQ.slot,
      options: nextQ.options,
      questionsRemaining: MAX_CLARIFICATION_QUESTIONS - this.state.questionsAsked,
      state: this.serialize()
    };
  }

  cancel() {
    this.state.isResolved = true;
    this.state.fallbackGenericRoute = true;
    return {
      type: 'SESSION_CANCELLED',
      message: 'Clarification cancelled by citizen. Standard general directory provided.',
      state: this.serialize()
    };
  }
}
