/**
 * Term Explainer Service (#383)
 *
 * Provides short, accessible explanations for civic-service terminology using
 * only the selected term and the surrounding service context. Profile and vault
 * data are never sent to the explanation layer. Falls back gracefully when the
 * explanation cannot be generated.
 */

import { getGlossaryEntryById } from './civicGlossaryService';

const SIMULATED_LATENCY_MS = 400;
const MAX_DEFINITION_LENGTH = 200;
const MAX_EXAMPLE_LENGTH = 220;

const SIMULATED_FAILURE_TERM = '__simulate_failure__';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds the context-only payload sent to the explanation layer.
 * Profile and vault data are deliberately excluded.
 */
const buildContextPayload = ({ term, serviceContext = {} }) => ({
  term: (term || '').trim(),
  serviceName: serviceContext.serviceName || '',
  serviceDescription: serviceContext.serviceDescription || '',
  section: serviceContext.section || '',
});

/**
 * Generates an AI-style short definition using only the term and service context.
 * Simulates network latency and may throw to represent a failed request.
 */
const generateAiExplanation = async (payload) => {
  await sleep(SIMULATED_LATENCY_MS);

  if (payload.term === SIMULATED_FAILURE_TERM) {
    throw new Error('AI explanation service unavailable');
  }

  const { term, serviceName, serviceDescription, section } = payload;
  const lowerTerm = term.toLowerCase();
  const sectionLabel = section || 'this service';

  let definition;
  let example;

  const svc = serviceName || 'this service';

  if (lowerTerm.includes('domicile')) {
    definition = `Your official proof of continuous residence in a state or territory (often 5–15 years), used to establish eligibility for ${svc}.`;
    example = `Example: A domicile certificate shows you have lived in the state long enough to apply under ${svc}. Illustrative only, not an official rule.`;
  } else if (lowerTerm.includes('income certificate')) {
    definition = `An official document recording your annual individual or family income, issued by a revenue authority such as a Tehsildar, often required for ${svc}.`;
    example = `Example: Needed to apply for fee concessions or scholarships under ${svc}. Illustrative only, not an official rule.`;
  } else if (lowerTerm.includes('self-attest') || lowerTerm.includes('attestation')) {
    definition = `Signing and dating a photocopy of your document with the words "self-attested" to confirm the copy matches the original, commonly accepted for ${svc}.`;
    example = `Example: You sign across a photocopy of your Aadhaar card and write "Self-attested" with today's date when applying for ${svc}. Illustrative only, not an official rule.`;
  } else if (lowerTerm.includes('issuing authority')) {
    definition = `The government office or officer authorized to issue a particular certificate or document for ${svc}.`;
    example = `Example: For a domicile certificate, the issuing authority is often the Tehsildar or revenue officer of your district. Illustrative only, not an official rule.`;
  } else if (lowerTerm.includes('affidavit')) {
    definition = `A signed written statement affirmed before an authorized legal officer (such as a notary or magistrate) declaring the facts to be true, often used for ${svc}.`;
    example = `Example: Used to declare your income when no formal payslips are available under ${svc}. Illustrative only, not an official rule.`;
  } else if (lowerTerm.includes('noc') || lowerTerm.includes('no objection')) {
    definition = `A formal letter stating that a department, bank, or employer has no objection or pending liability regarding your planned transaction for ${svc}.`;
    example = `Example: Required when re-registering a vehicle in another state under ${svc}. Illustrative only, not an official rule.`;
  } else {
    const ctx = serviceDescription ? ` in the context of ${svc}` : '';
    definition = `An administrative term used in ${sectionLabel}${ctx}. Its exact meaning depends on the issuing department and the rules for ${svc}.`;
    example = undefined;
  }

  if (definition.length > MAX_DEFINITION_LENGTH) {
    definition = definition.slice(0, MAX_DEFINITION_LENGTH - 1).trimEnd() + '…';
  }

  if (example && example.length > MAX_EXAMPLE_LENGTH) {
    example = example.slice(0, MAX_EXAMPLE_LENGTH - 1).trimEnd() + '…';
  }

  return {
    definition,
    example,
    source: 'ai-generated',
  };
};

/**
 * Returns a graceful fallback explanation when the AI layer cannot generate one.
 */
const buildFallback = (term) => ({
  definition: `No explanation is currently available for "${term || 'this term'}". Please consult the official department or portal linked on this service page.`,
  example: undefined,
  source: 'fallback',
  fallback: true,
});

/**
 * Explains a single civic-service term using surrounding service context.
 *
 * @param {Object} params
 * @param {string} params.term - The term to explain (required, non-empty)
 * @param {Object} [params.serviceContext] - Surrounding service context
 * @param {string} [params.serviceContext.serviceName] - Name of the service
 * @param {string} [params.serviceContext.serviceDescription] - Service description
 * @param {string} [params.serviceContext.section] - Section where the term appears (e.g. "Documents you need")
 * @returns {Promise<Object>} { definition, example, source, informational, fallback?, error? }
 */
export const explainTerm = async ({
  term,
  serviceContext = {},
} = {}) => {
  const cleanTerm = (term || '').trim();

  // Empty term: graceful fallback, never a crash
  if (!cleanTerm) {
    return {
      definition: 'No term was provided to explain.',
      example: undefined,
      source: 'fallback',
      informational: true,
      fallback: true,
      error: 'Empty term',
    };
  }

  const payload = buildContextPayload({ term: cleanTerm, serviceContext });

  // 1. Consult the curated glossary first (verified, instant, no AI needed)
  const glossaryEntry = getGlossaryEntryById(cleanTerm);
  if (glossaryEntry) {
    return {
      definition: glossaryEntry.simpleMeaning,
      example: undefined,
      source: 'verified-glossary',
      informational: true,
      fallback: false,
      serviceContext: {
        term: glossaryEntry.term,
        relatedServices: glossaryEntry.relatedServices,
      },
    };
  }

  // 2. Generate AI-style explanation using only term + service context
  try {
    const ai = await generateAiExplanation(payload);
    return {
      definition: ai.definition,
      example: ai.example,
      source: ai.source,
      informational: true,
      fallback: false,
    };
  } catch (err) {
    // 3. Graceful fallback when the explanation cannot be generated
    return {
      ...buildFallback(cleanTerm),
      informational: true,
      error: err?.message || 'Explanation could not be generated.',
    };
  }
};
