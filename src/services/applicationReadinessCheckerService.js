/**
 * applicationReadinessCheckerService.js
 *
 * Grounded AI-assisted pre-flight readiness and missing-requirements checker.
 * Compares citizen-provided answers against curated service eligibility rules
 * and required document checklists from the civic service catalogue.
 *
 * Privacy & Safety Guarantees:
 * - Never claims official government approval or guarantees eligibility.
 * - Purely functional and in-memory; never silently writes to citizen profile or localStorage.
 * - Detects incomplete or contradictory catalogue entries and abstains safely.
 * - Every finding is strictly cited to catalogue records and official portals.
 */

/**
 * Derives structured questionnaire items from a service catalogue record.
 * @param {Object} service - Service record from catalogue
 * @returns {Object} Structured question definitions and catalogue validity metadata
 */
export function buildReadinessQuestionnaire(service) {
  if (!service || typeof service !== 'object') {
    return {
      isValid: false,
      reason: 'No valid service catalogue record provided.',
      questions: [],
      hasContradictions: false,
    };
  }

  const eligibility = Array.isArray(service.eligibility)
    ? service.eligibility
    : typeof service.eligibility === 'string' && service.eligibility.trim().length > 0
      ? [service.eligibility]
      : [];

  const documents = Array.isArray(service.documents)
    ? service.documents
    : [];

  const questions = [];

  // Inspect catalogue completeness and detect potential contradictions
  const hasContradictoryCriteria = detectCatalogueContradictions(service, eligibility, documents);

  // Generate eligibility-related questions
  eligibility.forEach((criterion, index) => {
    const text = String(criterion).trim();
    if (!text) return;

    questions.push({
      id: `eligibility_${index}`,
      type: 'eligibility',
      label: text,
      prompt: `Do you satisfy the following requirement: "${text}"?`,
      citation: {
        sourceField: 'eligibility',
        ruleIndex: index + 1,
        officialWebsite: service.officialWebsite || service.portalUrl || null,
        serviceName: service.name || 'Civic Service',
      },
      isMandatory: true,
      options: [
        { value: 'yes', label: 'Yes, I meet this condition' },
        { value: 'no', label: 'No, I do not meet this' },
        { value: 'unsure', label: 'Unsure / Need confirmation' },
      ],
    });
  });

  // Generate document-related questions
  documents.forEach((doc, index) => {
    const docName = typeof doc === 'string' ? doc : doc.name || `Document #${index + 1}`;
    const isOptional = typeof doc === 'object' && doc.optional === true;

    questions.push({
      id: `doc_${index}`,
      type: 'document',
      label: docName,
      prompt: `Do you have the document "${docName}" ready and accessible?`,
      isMandatory: !isOptional,
      citation: {
        sourceField: 'documents',
        documentIndex: index + 1,
        officialWebsite: service.officialWebsite || service.portalUrl || null,
        serviceName: service.name || 'Civic Service',
      },
      options: [
        { value: 'yes', label: 'Yes, physical or digital copy available' },
        { value: 'in_progress', label: 'In progress / Applied for' },
        { value: 'missing', label: 'No, missing / cannot acquire' },
      ],
    });
  });

  return {
    isValid: questions.length > 0,
    serviceId: service.id,
    serviceName: service.name,
    officialWebsite: service.officialWebsite || service.portalUrl || null,
    hasContradictions: hasContradictoryCriteria.hasContradiction,
    contradictionDetails: hasContradictoryCriteria.details,
    questions,
  };
}

/**
 * Checks for logical contradictions or incomplete data in the service catalogue.
 */
function detectCatalogueContradictions(service, eligibility, documents) {
  const details = [];
  const textSummary = `${service.description || ''} ${service.notes || ''}`.toLowerCase();

  // Contradiction 1: Text claims "no documents needed" but documents list is populated
  const claimsNoDocs = textSummary.includes('no documents required') || textSummary.includes('zero documentation');
  if (claimsNoDocs && documents.length > 0) {
    details.push('Catalogue notes claim no documents are required, yet specific documents are listed in the catalogue.');
  }

  // Contradiction 2: Text claims universal eligibility but restrictive criteria exist
  const claimsUniversal = textSummary.includes('open to all citizens') || textSummary.includes('universal entitlement');
  const hasIncomeRestr = eligibility.some((c) => /income|bpl|below poverty|creamy layer/i.test(String(c)));
  if (claimsUniversal && hasIncomeRestr) {
    details.push('Catalogue states universal citizen entitlement, but restrictive income criteria are listed.');
  }

  return {
    hasContradiction: details.length > 0,
    details,
  };
}

/**
 * Evaluates citizen responses against service requirements.
 * Pure functional evaluation; does NOT modify or persist anything.
 *
 * @param {Object} service - Service catalogue object
 * @param {Object} answers - Key-value map of questionId -> selectedValue
 * @returns {Object} Evaluation report
 */
export function evaluateApplicationReadiness(service, answers = {}) {
  const questionnaire = buildReadinessQuestionnaire(service);

  if (!questionnaire.isValid) {
    return {
      status: 'ABSTAINED_NO_CRITERIA',
      score: 0,
      isReady: false,
      abstainReason: 'Catalogue does not provide structured eligibility or document rules for this service.',
      findings: [],
      missingDocuments: [],
      unmetConditions: [],
      uncertainRules: [],
      unansweredCount: 0,
      disclaimer: getOfficialDisclaimer(service),
    };
  }

  // If there are internal contradictions in catalogue, abstain from giving definitive eligibility claim
  if (questionnaire.hasContradictions) {
    return {
      status: 'ABSTAINED_CONTRADICTORY_CATALOGUE',
      score: 0,
      isReady: false,
      abstainReason: 'Catalogue contains contradictory eligibility requirements. Please verify with official portal.',
      contradictions: questionnaire.contradictionDetails,
      findings: [],
      missingDocuments: [],
      unmetConditions: [],
      uncertainRules: [],
      unansweredCount: 0,
      officialSource: questionnaire.officialWebsite,
      disclaimer: getOfficialDisclaimer(service),
    };
  }

  const findings = [];
  const missingDocuments = [];
  const unmetConditions = [];
  const uncertainRules = [];
  let answeredCount = 0;
  let positiveScore = 0;
  let totalMandatory = 0;

  questionnaire.questions.forEach((q) => {
    const answer = answers[q.id];
    const isAnswered = answer !== undefined && answer !== null && answer !== '';

    if (q.isMandatory) totalMandatory += 1;

    if (!isAnswered) {
      findings.push({
        questionId: q.id,
        type: q.type,
        label: q.label,
        status: 'UNANSWERED',
        explanation: 'Question has not been answered yet.',
        citation: q.citation,
      });
      return;
    }

    answeredCount += 1;

    if (q.type === 'eligibility') {
      if (answer === 'yes') {
        positiveScore += 1;
        findings.push({
          questionId: q.id,
          type: q.type,
          label: q.label,
          status: 'MET',
          explanation: 'Condition met according to your response.',
          citation: q.citation,
        });
      } else if (answer === 'no') {
        unmetConditions.push({
          label: q.label,
          citation: q.citation,
          remediation: `Review official guideline at ${q.citation.officialWebsite || 'official portal'} to confirm if exceptions or waivers apply.`,
        });
        findings.push({
          questionId: q.id,
          type: q.type,
          label: q.label,
          status: 'UNMET',
          explanation: 'You indicated that you do not satisfy this requirement.',
          citation: q.citation,
        });
      } else {
        uncertainRules.push({
          label: q.label,
          citation: q.citation,
          guidance: 'Requires clarification with competent authority or official portal before applying.',
        });
        findings.push({
          questionId: q.id,
          type: q.type,
          label: q.label,
          status: 'UNCERTAIN',
          explanation: 'Condition requires verification or official confirmation.',
          citation: q.citation,
        });
      }
    } else if (q.type === 'document') {
      if (answer === 'yes') {
        if (q.isMandatory) positiveScore += 1;
        findings.push({
          questionId: q.id,
          type: q.type,
          label: q.label,
          status: 'MET',
          explanation: 'Document is reported ready.',
          citation: q.citation,
        });
      } else if (answer === 'missing') {
        if (q.isMandatory) {
          missingDocuments.push({
            label: q.label,
            citation: q.citation,
            isMandatory: true,
          });
        }
        findings.push({
          questionId: q.id,
          type: q.type,
          label: q.label,
          status: 'MISSING',
          explanation: `Mandatory document "${q.label}" is not yet ready.`,
          citation: q.citation,
        });
      } else if (answer === 'in_progress') {
        uncertainRules.push({
          label: `Document pending: ${q.label}`,
          citation: q.citation,
          guidance: 'Obtain receipt or tracking number for pending prerequisite document.',
        });
        findings.push({
          questionId: q.id,
          type: q.type,
          label: q.label,
          status: 'IN_PROGRESS',
          explanation: `Application for "${q.label}" is underway.`,
          citation: q.citation,
        });
      }
    }
  });

  const unansweredCount = questionnaire.questions.length - answeredCount;
  const scorePercent = totalMandatory > 0 ? Math.round((positiveScore / totalMandatory) * 100) : 0;

  // Determine overall status
  let status = 'READY';
  if (unmetConditions.length > 0) {
    status = 'NOT_READY_UNMET_CRITERIA';
  } else if (missingDocuments.length > 0) {
    status = 'NEEDS_DOCUMENTS';
  } else if (uncertainRules.length > 0) {
    status = 'CONDITIONAL_UNCERTAIN';
  } else if (unansweredCount > 0) {
    status = 'INCOMPLETE_QUESTIONNAIRE';
  }

  const isReady = status === 'READY';

  return {
    status,
    score: scorePercent,
    isReady,
    totalQuestions: questionnaire.questions.length,
    answeredCount,
    unansweredCount,
    findings,
    missingDocuments,
    unmetConditions,
    uncertainRules,
    serviceId: service.id,
    serviceName: service.name,
    officialWebsite: questionnaire.officialWebsite,
    disclaimer: getOfficialDisclaimer(service),
  };
}

/**
 * Standard plain-language disclaimer regarding AI readiness checking.
 */
export function getOfficialDisclaimer(service) {
  const portal = service?.officialWebsite || service?.portalUrl || 'official authority portal';
  return `This is an informational pre-flight readiness check based on the Civic Help Setu catalogue. It does not submit an application, alter government records, or guarantee eligibility. Final acceptance rests solely with the competent authority at ${portal}.`;
}

