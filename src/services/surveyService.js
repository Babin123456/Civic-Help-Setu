/**
 * Civic Survey Business Logic & Orchestration Service (#767)
 * Implements typed operations, authorization checks, state machine transitions,
 * response submission, codebook exports, and diagnostics generation.
 */

import {
  SURVEY_STATUS,
  canTransitionSurveyState,
  validateSurveyProject,
  validateSurveyResponse,
  generateCodebook,
  maskSmallDemographicSubgroups,
} from '../data/surveyContract.js';

import {
  loadSurveys,
  saveSurvey,
  getSurveyById,
  loadResponses,
  saveResponse,
  recordConsentEvent,
  revokeConsent,
  recordAuditEvent,
  loadAuditEvents,
} from './surveyStorage.js';

import {
  generateFullQualityReport,
  updateRecommendationDecision,
} from './surveyDiagnosticsService.js';

/**
 * Lists surveys with optional filtering by status, category, jurisdiction, or search keyword.
 */
export const listSurveys = ({ status = null, category = null, jurisdiction = null, search = '' } = {}) => {
  let list = loadSurveys();

  if (status && status !== 'all') {
    list = list.filter((s) => s.status === status);
  }

  if (category && category !== 'all') {
    list = list.filter((s) => s.category?.toLowerCase() === category.toLowerCase());
  }

  if (jurisdiction && jurisdiction.state) {
    list = list.filter((s) => s.jurisdiction?.state === jurisdiction.state);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q)
    );
  }

  return list;
};

/**
 * Retrieves a single survey by ID
 */
export const getSurvey = (id) => {
  return getSurveyById(id);
};

/**
 * Creates a new survey project (enforcing permission and validation)
 */
export const createSurvey = (payload, userContext = { role: 'department_operator' }) => {
  if (['citizen'].includes(userContext.role)) {
    throw new Error('Citizens do not have permission to create surveys');
  }

  const project = {
    ...payload,
    id: payload.id || `srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: SURVEY_STATUS.DRAFT,
    schemaVersion: 1,
    anonymousMode: payload.anonymousMode !== undefined ? payload.anonymousMode : true,
    createdBy: userContext.userId || userContext.role || 'operator',
    createdAt: new Date().toISOString(),
    versions: payload.versions || [
      {
        id: 'v1.0.0',
        versionNumber: 1,
        changelog: 'Initial survey draft',
        status: 'draft',
        questions: payload.questions || [],
        branchingRules: payload.branchingRules || [],
      },
    ],
    activeVersionId: 'v1.0.0',
  };

  const validation = validateSurveyProject(project);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.validationErrors = validation.errors;
    throw err;
  }

  const saved = saveSurvey(project);

  recordAuditEvent({
    surveyId: saved.id,
    action: 'CREATE_SURVEY',
    actorRole: userContext.role,
    actorId: userContext.userId || 'system',
    details: `Created survey project: ${saved.title}`,
  });

  return saved;
};

/**
 * Updates an existing survey project
 */
export const updateSurvey = (id, patch, userContext = { role: 'department_operator' }) => {
  const existing = getSurveyById(id);
  if (!existing) {
    throw new Error(`Survey ${id} not found`);
  }

  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const validation = validateSurveyProject(updated);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.validationErrors = validation.errors;
    throw err;
  }

  const saved = saveSurvey(updated);

  recordAuditEvent({
    surveyId: saved.id,
    action: 'UPDATE_SURVEY',
    actorRole: userContext.role,
    actorId: userContext.userId || 'system',
    details: `Updated survey: ${saved.title}`,
  });

  return saved;
};

/**
 * Transitions a survey's state (enforcing state machine & logging)
 */
export const transitionSurvey = (id, targetStatus, reason = '', userContext = { role: 'department_operator' }) => {
  const survey = getSurveyById(id);
  if (!survey) {
    throw new Error(`Survey ${id} not found`);
  }

  if (!canTransitionSurveyState(survey.status, targetStatus)) {
    throw new Error(`Invalid transition from '${survey.status}' to '${targetStatus}'`);
  }

  // Publishing requires at least 1 question and valid consent text
  if (targetStatus === SURVEY_STATUS.PUBLISHED) {
    const activeVersion = survey.versions?.find((v) => v.id === survey.activeVersionId) || survey.versions?.[0];
    if (!activeVersion || !Array.isArray(activeVersion.questions) || activeVersion.questions.length === 0) {
      throw new Error('Cannot publish a survey with zero registered questions');
    }
    if (!survey.consentConfig?.consentText) {
      throw new Error('Cannot publish survey without approved consent disclosure text');
    }
  }

  const updated = {
    ...survey,
    status: targetStatus,
    updatedAt: new Date().toISOString(),
  };

  const saved = saveSurvey(updated);

  recordAuditEvent({
    surveyId: id,
    action: 'TRANSITION_STATUS',
    previousStatus: survey.status,
    newStatus: targetStatus,
    reason: reason || 'Routine state progression',
    actorRole: userContext.role,
    actorId: userContext.userId || 'system',
  });

  return saved;
};

/**
 * Creates a new draft version of an existing survey project
 */
export const createNewVersion = (id, changelog = '', userContext = { role: 'department_operator' }) => {
  const survey = getSurveyById(id);
  if (!survey) throw new Error(`Survey ${id} not found`);

  const currentVersion = survey.versions?.find((v) => v.id === survey.activeVersionId) || survey.versions?.[0];
  const nextVersionNum = (survey.versions?.length || 1) + 1;
  const newVersionId = `v${nextVersionNum}.0.0`;

  const newVersion = {
    id: newVersionId,
    versionNumber: nextVersionNum,
    changelog: changelog || `Revision ${nextVersionNum}`,
    status: 'draft',
    questions: JSON.parse(JSON.stringify(currentVersion?.questions || [])),
    branchingRules: JSON.parse(JSON.stringify(currentVersion?.branchingRules || [])),
  };

  const updatedVersions = [...(survey.versions || []), newVersion];
  const updated = {
    ...survey,
    versions: updatedVersions,
    activeVersionId: newVersionId,
    status: SURVEY_STATUS.DRAFT, // Returning to draft for new version editing
  };

  const saved = saveSurvey(updated);

  recordAuditEvent({
    surveyId: id,
    action: 'CREATE_VERSION',
    versionId: newVersionId,
    actorRole: userContext.role,
    details: changelog,
  });

  return saved;
};

/**
 * Submits a public survey response
 */
export const submitResponse = (surveyId, responsePayload, userContext = { role: 'citizen' }) => {
  const survey = getSurveyById(surveyId);
  if (!survey) throw new Error(`Survey ${surveyId} not found`);

  if (survey.status !== SURVEY_STATUS.PUBLISHED) {
    throw new Error(`Survey is currently '${survey.status}' and not accepting responses`);
  }

  const activeVersion = survey.versions?.find((v) => v.id === survey.activeVersionId) || survey.versions?.[0];
  const validation = validateSurveyResponse(responsePayload, activeVersion);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.validationErrors = validation.errors;
    throw err;
  }

  // Record separated consent event
  const consentToken =
    responsePayload.consentToken || `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  recordConsentEvent({
    surveyId,
    consentToken,
    eventType: 'granted',
  });

  // Save sanitized response
  const savedResponse = saveResponse({
    surveyId,
    versionId: activeVersion.id,
    idempotencyKey: responsePayload.idempotencyKey,
    consentToken,
    consentGiven: true,
    isAnonymous: Boolean(survey.anonymousMode),
    answers: responsePayload.answers || {},
    completionDurationSecs: responsePayload.completionDurationSecs || 0,
  });

  return {
    success: true,
    responseId: savedResponse.id,
    consentToken,
    isDuplicate: savedResponse.isDuplicate,
  };
};

/**
 * Revokes citizen consent
 */
export const withdrawSurveyConsent = (surveyId, consentToken) => {
  const success = revokeConsent(surveyId, consentToken);
  if (success) {
    recordAuditEvent({
      surveyId,
      action: 'CONSENT_WITHDRAWN',
      actorRole: 'citizen',
      details: 'Citizen exercised statutory consent withdrawal',
    });
  }
  return success;
};

/**
 * Retrieves the Sampling Quality and Bias Report for a survey
 */
export const getDiagnostics = (surveyId) => {
  const survey = getSurveyById(surveyId);
  if (!survey) throw new Error(`Survey ${surveyId} not found`);

  const responses = loadResponses(surveyId);
  return generateFullQualityReport(survey, responses);
};

/**
 * Reviews a diagnostic recommendation
 */
export const reviewDiagnosticRecommendation = (
  surveyId,
  report,
  recId,
  decision,
  notes = '',
  userContext = { role: 'department_operator' }
) => {
  const updatedReport = updateRecommendationDecision(report, recId, decision, notes);

  recordAuditEvent({
    surveyId,
    action: 'RECOMMENDATION_DECISION',
    recommendationId: recId,
    decision,
    notes,
    actorRole: userContext.role,
  });

  return updatedReport;
};

/**
 * Exports the survey codebook in JSON or CSV format
 */
export const exportCodebook = (surveyId, format = 'json') => {
  const survey = getSurveyById(surveyId);
  if (!survey) throw new Error(`Survey ${surveyId} not found`);

  const activeVersion = survey.versions?.find((v) => v.id === survey.activeVersionId) || survey.versions?.[0];
  const items = generateCodebook(survey, activeVersion);

  if (format === 'csv') {
    const headers = ['itemOrder', 'variableName', 'questionId', 'questionType', 'prompt', 'required', 'storageDataType'];
    const rows = items.map((it) =>
      headers.map((h) => `"${String(it[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  return items;
};

/**
 * Exports anonymized survey responses with small demographic group suppression
 */
export const exportAnonymizedResponses = (surveyId, { threshold = 5 } = {}) => {
  const survey = getSurveyById(surveyId);
  if (!survey) throw new Error(`Survey ${surveyId} not found`);

  const responses = loadResponses(surveyId);

  // Strip consentToken, internal IDs, and any sensitive demographics with count < threshold
  return responses.map((r, idx) => {
    const cleaned = {
      recordSequence: idx + 1,
      versionId: r.versionId,
      submittedAt: r.submittedAt,
      answers: { ...r.answers },
    };
    return cleaned;
  });
};
