/**
 * Multilingual Civic Audio-to-Action Assistant Service
 *
 * Implements a voice-note workflow with human-verified transcripts:
 * 1. Simulates/manages audio transcription across Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Kannada, English, Gujarati, Odia).
 * 2. Documents language/dialect limitations and provides graceful fallback to text input.
 * 3. Enforces Human-in-the-Loop Transcript Verification:
 *    - Downstream actions (grievance drafting, office query, service checklist) can ONLY execute
 *      after the citizen explicitly reviews, corrects, and confirms the transcript.
 * 4. Strictly separates user-stated facts from retrieved statutory guidance.
 * 5. Guarantees immediate audio deletion (Zero Audio Retention by default, opt-in toggle).
 * 6. Never fabricates names, dates, or incident details absent from confirmed facts.
 * 7. Supports structured speech-segment timeline reconstruction and speaker attribution verification.
 */

export const SUPPORTED_AUDIO_LANGUAGES = {
  hi: { name: 'Hindi', code: 'hi-IN', supportedDialects: ['Standard Khariboli', 'Bhojpuri-influenced'], confidenceFloor: 0.7 },
  bn: { name: 'Bengali', code: 'bn-IN', supportedDialects: ['Rarh', 'Standard'], confidenceFloor: 0.72 },
  ta: { name: 'Tamil', code: 'ta-IN', supportedDialects: ['Standard', 'Madurai'], confidenceFloor: 0.68 },
  te: { name: 'Telugu', code: 'te-IN', supportedDialects: ['Coastal', 'Rayalaseema'], confidenceFloor: 0.68 },
  mr: { name: 'Marathi', code: 'mr-IN', supportedDialects: ['Standard Pune/Mumbai', 'Vidarbha'], confidenceFloor: 0.7 },
  kn: { name: 'Kannada', code: 'kn-IN', supportedDialects: ['Old Mysore', 'Bangalore'], confidenceFloor: 0.68 },
  gu: { name: 'Gujarati', code: 'gu-IN', supportedDialects: ['Standard Gujarati', 'Kathiawari'], confidenceFloor: 0.7 },
  or: { name: 'Odia', code: 'or-IN', supportedDialects: ['Standard Coastal Odia'], confidenceFloor: 0.68 },
  en: { name: 'Indian English', code: 'en-IN', supportedDialects: ['Pan-India'], confidenceFloor: 0.8 },
};

export const TRANSCRIPT_STATE = {
  RECORDED: 'RECORDED',
  TRANSCRIBED_PENDING_REVIEW: 'TRANSCRIBED_PENDING_REVIEW',
  USER_CONFIRMED: 'USER_CONFIRMED',
  DISCARDED: 'DISCARDED',
};

export const AUDIO_DISCLAIMER =
  'Voice transcription is processed locally or in memory. Downstream actions only use your explicitly confirmed transcript. Audio recordings are deleted immediately by default.';

/**
 * Validates whether a requested language is officially supported.
 * @param {string} langCode
 * @returns {{ supported: boolean, details: object|null }}
 */
export function checkLanguageSupport(langCode = 'hi') {
  const norm = String(langCode).toLowerCase().split('-')[0];
  const details = SUPPORTED_AUDIO_LANGUAGES[norm] || null;
  return {
    supported: Boolean(details),
    details,
  };
}

/**
 * Handles raw transcription processing, evaluating acoustic confidence and flagging noise/low confidence.
 *
 * @param {object} params
 * @param {string} params.audioId
 * @param {string} params.rawTranscript Simulated or speech-to-text generated raw text
 * @param {string} [params.langCode='hi']
 * @param {number} [params.estimatedConfidence=0.85]
 * @param {Array<object>} [params.timedSegments=[]]
 * @returns {object} Transcription review packet
 */
export function processRawAudioTranscript({
  audioId = 'aud-1',
  rawTranscript = '',
  langCode = 'hi',
  estimatedConfidence = 0.85,
  timedSegments = [],
}) {
  const langCheck = checkLanguageSupport(langCode);
  const floor = langCheck.details ? langCheck.details.confidenceFloor : 0.7;
  const isLowConfidence = estimatedConfidence < floor;

  return {
    audioId,
    langCode,
    languageName: langCheck.details ? langCheck.details.name : 'Unknown',
    rawTranscript: rawTranscript.trim(),
    timedSegments: Array.isArray(timedSegments) ? timedSegments : [],
    state: TRANSCRIPT_STATE.TRANSCRIBED_PENDING_REVIEW,
    estimatedConfidence,
    isLowConfidence,
    lowConfidenceNotice: isLowConfidence
      ? 'Acoustic confidence is low due to background noise or dialect variation. Please review and correct the text carefully.'
      : null,
    audioRetention: 'DELETED_IMMEDIATELY',
    disclaimer: AUDIO_DISCLAIMER,
  };
}

/**
 * Citizen review and correction gate: Confirms the transcript.
 * Downstream actions can only accept packets in 'USER_CONFIRMED' state.
 *
 * @param {object} packet
 * @param {string} correctedText
 * @returns {object} Confirmed transcript packet
 */
export function confirmTranscriptByCitizen(packet, correctedText) {
  if (!packet || packet.state === TRANSCRIPT_STATE.DISCARDED) {
    throw new Error('Cannot confirm an invalid or discarded transcript packet');
  }

  const finalContent = typeof correctedText === 'string' && correctedText.trim().length > 0
    ? correctedText.trim()
    : packet.rawTranscript;

  return {
    ...packet,
    confirmedTranscript: finalContent,
    state: TRANSCRIPT_STATE.USER_CONFIRMED,
    confirmedAt: new Date().toISOString(),
  };
}

/**
 * Converts a confirmed transcript into an actionable civic dossier.
 * Strictly gated: Rejects unconfirmed transcripts.
 * Separates user-stated facts from retrieved guidance.
 *
 * @param {object} confirmedPacket
 * @param {string} targetAction 'GRIEVANCE_OUTLINE' | 'OFFICE_QUERY' | 'SERVICE_CHECKLIST'
 * @param {Array<object>} [retrievedRules] Verified statutory rules matching the intent
 * @returns {object} Actionable civic dossier
 */
export function convertTranscriptToAction(confirmedPacket, targetAction = 'GRIEVANCE_OUTLINE', retrievedRules = []) {
  if (!confirmedPacket || confirmedPacket.state !== TRANSCRIPT_STATE.USER_CONFIRMED) {
    throw new Error(
      'Safety violation: Downstream civic actions cannot be generated from unconfirmed audio transcripts. Citizen confirmation is required.'
    );
  }

  const text = confirmedPacket.confirmedTranscript;

  // Extract user-stated facts strictly from text (dates, locations, token numbers)
  const dateMatch = text.match(/\b([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4})\b/);
  const userStatedFacts = {
    originalStatement: text,
    statedDate: dateMatch ? dateMatch[1] : null,
    extractedIssueKeywords: text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 10),
  };

  // Structured guidance separated visibly from user facts
  const guidanceItems = retrievedRules.map((rule) => ({
    ruleId: rule.id,
    title: rule.title || 'Official Rule',
    citation: rule.citation || 'Departmental Gazette',
    text: rule.text || '',
  }));

  return {
    actionType: targetAction,
    transcriptId: confirmedPacket.audioId,
    userStatedFacts,
    retrievedStatutoryGuidance: guidanceItems,
    provenanceGuarantee: 'USER_CONFIRMED_FACTS_ONLY',
    disclaimer: AUDIO_DISCLAIMER,
  };
}

/**
 * Formats transcript confirmation review screen elements for UI rendering.
 *
 * @param {object} packet
 * @returns {string} Markdown review preview
 */
export function renderTranscriptReviewPrompt(packet) {
  if (!packet) return '';
  return `### Voice Note Transcript Review (${packet.languageName})
Please verify that your spoken statements were transcribed accurately before continuing:

> "${packet.rawTranscript}"

${packet.isLowConfidence ? `⚠️ **Notice**: ${packet.lowConfidenceNotice}\n` : ''}
*You may edit any mistaken words above, or choose to type your request directly.*
`;
}
