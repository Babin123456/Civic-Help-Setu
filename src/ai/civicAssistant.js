import { getActiveBuiltInServices } from '../services/serviceCatalog';
import { FAQ_DATABASE } from '../data/faq_database';
import { buildCivicAssistantFallback } from './civicAssistantFallback';
import {
  runPreInferenceGuardrails,
  stripRedactionPlaceholders,
} from './aiGuardrailPipeline';

export const askCivicAssistant = async (rawQuery, options = {}) => {
  const { timeoutMs } = options;
  const preGuardrail = runPreInferenceGuardrails(rawQuery || '');
  const guardrailMeta = {
    decision: preGuardrail.decision,
    pii: preGuardrail.pii,
    injection: preGuardrail.injection,
  };

  if (preGuardrail.decision === 'block') {
    return {
      ...preGuardrail.blockedResponse,
      guardrail: guardrailMeta,
    };
  }

  const query = preGuardrail.sanitizedQuery;
  const activeServices = getActiveBuiltInServices();

  const aiResult = (async () => {
    // Simulate AI network processing latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    const lowerQuery = stripRedactionPlaceholders(query).toLowerCase().trim();

    // 1. Direct Service Guide matching
    const serviceMatch = activeServices.find((s) => {
      const sName = s.name.toLowerCase();
      const sId = s.id.toLowerCase();
      const sCat = s.category.toLowerCase();

      return (
        lowerQuery.includes(sName) ||
        lowerQuery.includes(sId) ||
        (sCat && lowerQuery.includes(sCat)) ||
        (s.id === 'birth-certificate' && (lowerQuery.includes('born') || lowerQuery.includes('baby') || lowerQuery.includes('birth'))) ||
        (s.id === 'driving-license' && (lowerQuery.includes('drive') || lowerQuery.includes('dl') || lowerQuery.includes('rto') || lowerQuery.includes('vehicle'))) ||
        (s.id === 'pan-card' && (lowerQuery.includes('tax') || lowerQuery.includes('income tax') || lowerQuery.includes('pan'))) ||
        (s.id === 'aadhaar-card' && (lowerQuery.includes('lost') || lowerQuery.includes('uidai') || lowerQuery.includes('biometric') || lowerQuery.includes('aadhaar')))
      );
    });

    if (serviceMatch) {
      const wantsFees = lowerQuery.includes('fee') || lowerQuery.includes('cost') || lowerQuery.includes('charge') || lowerQuery.includes('price');
      const wantsDocs = lowerQuery.includes('document') || lowerQuery.includes('paper') || lowerQuery.includes('proof') || lowerQuery.includes('need');
      const wantsTime = lowerQuery.includes('time') || lowerQuery.includes('day') || lowerQuery.includes('fast') || lowerQuery.includes('long');

      let dynamicSummary = serviceMatch.shortDescription;
      if (wantsFees) {
        dynamicSummary = `Official Fees for ${serviceMatch.name}: ${serviceMatch.fees}. Most centers accept UPI, Netbanking, or Challan.`;
      } else if (wantsDocs) {
        dynamicSummary = `Key prerequisite documents for ${serviceMatch.name}: ${serviceMatch.documents.join(', ')}.`;
      } else if (wantsTime) {
        dynamicSummary = `Estimated processing duration for ${serviceMatch.name}: ${serviceMatch.processingTime}. Online fast-track applications often process sooner.`;
      }

      const suggestions = [
        `What are the mandatory documents for ${serviceMatch.name}?`,
        `How much are the official fees?`,
        `Where can I apply online?`,
      ];

      return {
        status: 'success',
        data: {
          title: serviceMatch.name,
          summary: dynamicSummary,
          steps: serviceMatch.steps || [],
          officialSources: serviceMatch.officialSources || [],
          documents: serviceMatch.documents || [],
          category: serviceMatch.category,
          processingTime: serviceMatch.processingTime,
          fees: serviceMatch.fees,
        },
        serviceId: serviceMatch.id,
        suggestions,
      };
    }

    // 2. Keyword Scoring Search against FAQ Database
    let bestMatch = null;
    let highestScore = 0;

    for (const faq of FAQ_DATABASE) {
      let score = 0;
      for (const keyword of faq.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = faq;
      }
    }

    if (bestMatch && highestScore > 0) {
      return {
        status: 'success',
        data: {
          title: bestMatch.title,
          summary: bestMatch.summary,
          steps: [],
          officialSources: [],
        },
        serviceId: null,
        suggestions: bestMatch.suggestions || [
          'How to apply for a Passport?',
          'Check Aadhaar status',
          'Download Income Certificate',
        ],
      };
    }

    // 3. No-result fallback: structured, context-aware, never fabricated
    return buildCivicAssistantFallback(query, { activeServices, timeout: false });
  })();

  let response;
  if (timeoutMs && timeoutMs > 0) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('CIVIC_ASSISTANT_TIMEOUT')), timeoutMs)
    );

    try {
      response = await Promise.race([aiResult, timeoutPromise]);
      // Detach the losing promise so it cannot surface an unhandled rejection.
      aiResult.catch(() => {});
    } catch (err) {
      if (err.message === 'CIVIC_ASSISTANT_TIMEOUT') {
        return {
          ...buildCivicAssistantFallback(query, { activeServices, timeout: true }),
          grounded: false,
          guardrail: guardrailMeta,
        };
      }
      throw err;
    }
  } else {
    response = await aiResult;
  }

  return {
    ...response,
    guardrail: guardrailMeta,
  };
};
