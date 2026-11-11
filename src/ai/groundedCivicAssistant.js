/**
 * Grounded Civic Assistant (#77)
 * Implements a Retrieval-Augmented Generation (RAG) assistant that synthesizes answers
 * strictly grounded in retrieved official service documents and sections.
 */

import { retrieveGroundedChunks } from './sourceGroundedRetriever.js';
import { getActiveBuiltInServices } from '../services/serviceCatalog.js';
import {
  runPreInferenceGuardrails,
  evaluateGroundedAnswerEntailment,
  stripRedactionPlaceholders,
} from './aiGuardrailPipeline.js';

export const MANDATORY_LEGAL_DISCLAIMER =
  'Notice: This guidance is retrieved from approved civic service guidelines and does not constitute an official government eligibility decision. Rules, deadlines, and fees may vary by municipality.';

/**
 * Answers a user query strictly using retrieved service knowledge.
 *
 * @param {string} query - Citizen question or query
 * @param {Object} options - Options
 * @returns {Promise<Object>} Grounded response payload
 */
export async function askGroundedCivicAssistant(query, options = {}) {
  // Simulate retrieval and inference latency
  await new Promise((resolve) => setTimeout(resolve, 450));

  const trimmedQuery = (query || '').trim();
  if (!trimmedQuery) {
    return {
      status: 'error',
      data: {
        title: 'Empty Query',
        summary: 'Please enter a civic question or name of a government service.',
        officialSources: [],
        disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      },
      grounded: false,
      serviceId: null,
      suggestions: ['How to apply for a Passport?', 'Aadhaar card update documents', 'Birth certificate fees'],
    };
  }

  // 0. Run Pre-Inference PII Scrubbing & Prompt-Injection Guardrails
  const preGuardrail = runPreInferenceGuardrails(trimmedQuery, {
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
  });

  if (preGuardrail.decision === 'block') {
    return {
      ...preGuardrail.blockedResponse,
      guardrail: {
        decision: preGuardrail.decision,
        pii: preGuardrail.pii,
        injection: preGuardrail.injection,
      },
    };
  }

  const sanitizedQuery = preGuardrail.sanitizedQuery;
  const retrievalQuery = stripRedactionPlaceholders(sanitizedQuery);

  // 1. Perform Source-Grounded Retrieval without biasing BM25 on redaction tag labels
  const retrieval = retrieveGroundedChunks(retrievalQuery, options);

  // 2. Handle out-of-scope or unsupported inquiries where no verified sources exist
  if (!retrieval.grounded || retrieval.retrievedChunks.length === 0) {
    return {
      status: 'unsupported',
      grounded: false,
      confidenceScore: retrieval.confidenceScore,
      guardrail: {
        decision: preGuardrail.decision,
        pii: preGuardrail.pii,
        injection: preGuardrail.injection,
      },
      data: {
        title: 'No Verified Government Source Found',
        summary: `We could not find verified government documentation or official guidelines supporting this request ("${sanitizedQuery}"). To prevent inaccurate information, Civic-Help-Setu does not generate unverified answers.`,
        missingInformationNotice: 'Missing or unsupported claims: No official government guidelines were retrieved for this specific question.',
        officialSources: [
          {
            name: 'National Government Services Portal (Direct Directory)',
            url: 'https://services.india.gov.in',
            verified: true,
          },
        ],
        disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      },
      serviceId: null,
      suggestions: [
        'How to apply for a Passport?',
        'What documents are needed for Driving License?',
        'How to register a Birth Certificate?',
      ],
    };
  }

  // 3. Grounded Answer Synthesis & Post-Synthesis Entailment Verification
  const topChunk = retrieval.retrievedChunks[0];
  const service = getActiveBuiltInServices().find((s) => s.id === topChunk.serviceId) || null;

  // Synthesize answer text grounded exclusively in retrieved chunks
  const primarySummary = retrieval.retrievedChunks
    .map((c) => `[${c.sectionTitle}]: ${c.content}`)
    .join('\n\n');

  const entailment = evaluateGroundedAnswerEntailment(
    primarySummary,
    retrieval.retrievedChunks
  );

  // Generate contextual suggestions
  const serviceName = topChunk.serviceName;
  const suggestions = [
    `What are the official fees for ${serviceName}?`,
    `Which documents are mandatory for ${serviceName}?`,
    `What is the step-by-step application procedure?`,
  ];

  return {
    status: 'success',
    grounded: retrieval.grounded && entailment.contradictedCount === 0,
    confidenceScore: retrieval.confidenceScore,
    entailment,
    guardrail: {
      decision: preGuardrail.decision,
      pii: preGuardrail.pii,
      injection: preGuardrail.injection,
      entailment,
    },
    retrievedChunks: retrieval.retrievedChunks.map((c) => ({
      chunkId: c.chunkId,
      sectionType: c.sectionType,
      sectionTitle: c.sectionTitle,
      relevanceScore: c.relevanceScore,
      excerpt: c.content,
      sourceUrl: c.officialSource?.url,
      sourceName: c.officialSource?.name,
      lastVerified: c.lastVerified,
    })),
    data: {
      title: `${serviceName} (Verified Civic Guidance)`,
      summary: topChunk.content,
      detailedSummary: primarySummary,
      missingInformationNotice: !entailment.overallSupported
        ? entailment.failClosedNotice
        : undefined,
      steps: service?.steps || [],
      documents: service?.documents || [],
      eligibility: service?.eligibility || [],
      fees: service?.fees || 'See official portal for latest schedule',
      processingTime: service?.processingTime || 'Subject to department review',
      officialSources: retrieval.sources,
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      isGrounded: true,
      lastVerified: topChunk.lastVerified,
    },
    serviceId: topChunk.serviceId,
    suggestions,
  };
}
