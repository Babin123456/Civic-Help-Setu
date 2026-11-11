/**
 * Plain-Language Civic Rights and Remedy Explainer with Source-Bounded Guidance Service
 *
 * Implements a source-grounded rights & statutory remedies explainer for citizens:
 * 1. Maps described citizen situations (e.g. application delayed past citizen charter deadline,
 *    arbitrary rejection of certificate, overcharging of statutory fees) to verified legal provisions.
 * 2. Visual & Structural Separation:
 *    - QUOTED_LEGAL_PROVISION: Verbatim statutory clause with gazette citation.
 *    - PLAIN_EXPLANATION: Easy-to-understand summary of rights and obligations.
 *    - PRACTICAL_ACTION_OPTIONS: Step-by-step avenues (First Appeal, CPGRAMS grievance, RTI application).
 * 3. Asks minimum clarifying questions before retrieving administrative remedies.
 * 4. Strict fail-closed abstention:
 *    - Abstains with an explicit caveat when authoritative statutes or rules are absent.
 * 5. Exportability:
 *    - Generates a structured helpdesk dossier with citation references and suggested questions
 *      for the citizen to present at official public service counters.
 * 6. Disclaims legal representation: Clarifies educational civic literacy purpose.
 * 7. Tracks statutory limitation windows and provides proactive deadline expiry reminders.
 */

export const REMEDY_TYPE = {
  CITIZEN_CHARTER_ESCALATION: 'CITIZEN_CHARTER_ESCALATION',
  STATUTORY_FIRST_APPEAL: 'STATUTORY_FIRST_APPEAL',
  GRIEVANCE_REDRESSAL: 'GRIEVANCE_REDRESSAL',
  RTI_INFORMATION_REQUEST: 'RTI_INFORMATION_REQUEST',
  VIGILANCE_COMPLAINT: 'VIGILANCE_COMPLAINT',
  UNRESOLVED_ABSTAIN: 'UNRESOLVED_ABSTAIN',
};

export const REMEDY_DISCLAIMER =
  'This explainer provides source-bounded educational information on official citizen remedies and service standards. It does NOT constitute legal representation or advocacy. Please consult official department helpdesks or legal aid clinics for formal litigation.';

/**
 * Calculates remaining limitation days given an event date and statutory limitation window.
 *
 * @param {string} eventDate
 * @param {number} limitationDays
 * @returns {{ daysRemaining: number, isExpired: boolean, expiryDateStr: string|null }}
 */
export function calculateLimitationWindow(eventDate, limitationDays) {
  if (!eventDate || !limitationDays) {
    return { daysRemaining: null, isExpired: false, expiryDateStr: null };
  }

  const evTime = new Date(eventDate).getTime();
  if (isNaN(evTime)) {
    return { daysRemaining: null, isExpired: false, expiryDateStr: null };
  }

  const expiry = new Date(evTime + limitationDays * 24 * 60 * 60 * 1000);
  const now = Date.now();
  const diffDays = Math.ceil((expiry.getTime() - now) / (24 * 60 * 60 * 1000));

  return {
    daysRemaining: diffDays,
    isExpired: diffDays < 0,
    expiryDateStr: expiry.toISOString().split('T')[0],
  };
}

/**
 * Validates whether an incoming situation narrative has sufficient detail to map remedies.
 *
 * @param {string} situationText
 * @returns {{ isDetailed: boolean, promptClarification: string|null }}
 */
export function validateSituationDescription(situationText = '') {
  const clean = String(situationText).trim();
  if (clean.length < 15) {
    return {
      isDetailed: false,
      promptClarification:
        'Please describe your situation in more detail (e.g. which service you applied for, whether a receipt was issued, or how many days have elapsed).',
    };
  }

  return { isDetailed: true, promptClarification: null };
}

/**
 * Evaluates an applicant's described scenario against a curated corpus of statutory remedy provisions.
 *
 * @param {object} params
 * @param {string} params.situationText Description of civic issue
 * @param {string} [params.jurisdiction='ALL_INDIA']
 * @param {Array<object>} params.remedyCorpus Curated statutory rights and remedy clauses
 * @returns {object} Formulated source-bounded explanation dossier
 */
export function explainCivicRightsAndRemedies({
  situationText = '',
  jurisdiction = 'ALL_INDIA',
  remedyCorpus = [],
}) {
  const validation = validateSituationDescription(situationText);
  if (!validation.isDetailed) {
    return {
      status: 'NEEDS_CLARIFICATION',
      clarificationPrompt: validation.promptClarification,
      remedies: [],
      disclaimer: REMEDY_DISCLAIMER,
    };
  }

  const textLower = situationText.toLowerCase();

  // Keyword intent matching against remedy corpus
  const matchedRemedies = [];

  for (const remedy of remedyCorpus) {
    // Check jurisdiction scope
    const inScope =
      !remedy.jurisdiction ||
      remedy.jurisdiction === 'ALL_INDIA' ||
      remedy.jurisdiction.toUpperCase() === jurisdiction.toUpperCase();

    if (!inScope) continue;

    // Check keyword triggers
    const triggers = remedy.triggers || [];
    const isTriggered = triggers.some((trig) => textLower.includes(trig.toLowerCase()));

    if (isTriggered) {
      matchedRemedies.push({
        remedyId: remedy.id,
        category: remedy.category || REMEDY_TYPE.GRIEVANCE_REDRESSAL,
        title: remedy.title,
        statutoryCitation: remedy.statutoryCitation || 'Departmental Citizen Charter',
        verbatimLegalClause: remedy.verbatimClause || '',
        plainLanguageExplanation: remedy.plainExplanation || '',
        limitationDays: remedy.limitationDays || null,
        practicalOptions: remedy.practicalOptions || [],
        escalationAuthority: remedy.escalationAuthority || 'Designated Public Grievance Officer',
      });
    }
  }

  // If no authoritative source matches: ABSTAIN rather than hallucinate legal remedies
  if (matchedRemedies.length === 0) {
    return {
      status: 'ABSTAIN_NO_STATUTORY_PROVISION',
      situationText,
      jurisdiction,
      message:
        'No verified statutory citizen remedy or service guarantee was found in the indexed catalogue matching your described scenario. Civic Help Setu abstains from guessing unofficial escalation paths.',
      remedies: [],
      helpdeskQuestions: [
        'Has a formal written rejection letter or deficiency memo been issued by the department?',
        'What is the published Citizen Charter Turnaround Time (TAT) for this service in your jurisdiction?',
      ],
      disclaimer: REMEDY_DISCLAIMER,
    };
  }

  return {
    status: 'EXPLAINED_WITH_AUTHORITY',
    situationText,
    jurisdiction,
    totalRemediesFound: matchedRemedies.length,
    remedies: matchedRemedies,
    disclaimer: REMEDY_DISCLAIMER,
  };
}

/**
 * Formats a structured Citizen Helpdesk Dossier for the citizen to export or print.
 *
 * @param {object} explanationDossier
 * @returns {string} Markdown text ready for public service desk presentation
 */
export function generateHelpdeskQuestionsDossier(explanationDossier) {
  if (!explanationDossier || !explanationDossier.remedies) return '';

  const remedyBlocks = explanationDossier.remedies.map((rem, idx) => {
    return `### Remedy ${idx + 1}: ${rem.title}
**Statutory Basis**: ${rem.statutoryCitation}
**Escalation Desk**: ${rem.escalationAuthority} ${rem.limitationDays ? `(Statutory Window: ${rem.limitationDays} days)` : ''}

> 📜 **Quoted Legal Provision**:
> "${rem.verbatimLegalClause}"

💡 **Plain-Language Explanation**:
${rem.plainLanguageExplanation}

🛠️ **Practical Step-by-Step Options**:
${(rem.practicalOptions || []).map((opt) => `- ${opt}`).join('\n')}
`;
  });

  return `# Official Citizen Rights and Remedy Dossier
Jurisdiction: ${explanationDossier.jurisdiction || 'ALL_INDIA'}
Status: ${explanationDossier.status}

## Citizen Situation Summary
"${explanationDossier.situationText || ''}"

---
## Official Statutory Remedies
${remedyBlocks.join('\n---\n')}

---
### Questions to ask at the Official Helpdesk Counter:
1. Under which statutory rule or citizen charter clause is my application currently being evaluated?
2. Has the mandatory service delivery turnaround time expired as per your departmental charter?
3. May I receive a written acknowledgement of this inquiry or a formal deficiency memo?

> [!NOTE]
> ${explanationDossier.disclaimer || REMEDY_DISCLAIMER}
`;
}
