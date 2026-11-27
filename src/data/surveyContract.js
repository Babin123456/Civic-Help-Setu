/**
 * Civic Survey Builder Domain Contract & Validation Layer (#767)
 * Defines schema definitions, state transitions, validation rules,
 * codebook generator, branching evaluation, and k-anonymity privacy rules.
 */

export const SCHEMA_VERSION = 1;

export const SURVEY_STATUS = Object.freeze({
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
});

export const SURVEY_STATE_TRANSITIONS = Object.freeze({
  [SURVEY_STATUS.DRAFT]: [SURVEY_STATUS.UNDER_REVIEW, SURVEY_STATUS.ARCHIVED],
  [SURVEY_STATUS.UNDER_REVIEW]: [SURVEY_STATUS.DRAFT, SURVEY_STATUS.PUBLISHED, SURVEY_STATUS.ARCHIVED],
  [SURVEY_STATUS.PUBLISHED]: [SURVEY_STATUS.PAUSED, SURVEY_STATUS.CLOSED, SURVEY_STATUS.ARCHIVED],
  [SURVEY_STATUS.PAUSED]: [SURVEY_STATUS.PUBLISHED, SURVEY_STATUS.CLOSED, SURVEY_STATUS.ARCHIVED],
  [SURVEY_STATUS.CLOSED]: [SURVEY_STATUS.PUBLISHED, SURVEY_STATUS.ARCHIVED],
  [SURVEY_STATUS.ARCHIVED]: [], // Terminal state
});

export const QUESTION_TYPES = Object.freeze({
  SINGLE_CHOICE: 'single_choice',
  MULTI_CHOICE: 'multi_choice',
  LIKERT_SCALE: 'likert_scale',
  TEXT_SHORT: 'text_short',
  TEXT_LONG: 'text_long',
  NUMERIC_RATING: 'numeric_rating',
  DEMOGRAPHIC_VOLUNTARY: 'demographic_voluntary',
});

export const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  DEPARTMENT_OPERATOR: 'department_operator',
  APPROVED_RESEARCHER: 'approved_researcher',
  ADMIN: 'admin',
});

export const DEFAULT_K_ANONYMITY_THRESHOLD = 5;

/**
 * Validates state transition
 */
export const canTransitionSurveyState = (currentStatus, targetStatus) => {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;
  const allowed = SURVEY_STATE_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
};

/**
 * Validates a Survey Project object
 */
export const validateSurveyProject = (project) => {
  const errors = [];

  if (!project || typeof project !== 'object') {
    return { valid: false, errors: ['Project payload must be an object'] };
  }

  if (!project.title || typeof project.title !== 'string' || project.title.trim().length < 5) {
    errors.push('Survey title must be at least 5 characters');
  }

  if (!project.description || typeof project.description !== 'string' || project.description.trim().length < 10) {
    errors.push('Survey description must be at least 10 characters');
  }

  if (!project.department || typeof project.department !== 'string') {
    errors.push('Department name is mandatory');
  }

  if (!project.jurisdiction || typeof project.jurisdiction !== 'object') {
    errors.push('Jurisdiction scope must be specified');
  } else {
    if (!project.jurisdiction.state) {
      errors.push('Jurisdiction state is required');
    }
  }

  if (!project.consentConfig || typeof project.consentConfig !== 'object') {
    errors.push('Consent configuration is mandatory');
  } else {
    if (!project.consentConfig.consentText || project.consentConfig.consentText.trim().length < 20) {
      errors.push('Consent disclosure text must be at least 20 characters');
    }
  }

  if (project.collectionWindow) {
    const { startDate, endDate } = project.collectionWindow;
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errors.push('Collection window startDate cannot be after endDate');
    }
  }

  if (project.status && !Object.values(SURVEY_STATUS).includes(project.status)) {
    errors.push(`Invalid status: ${project.status}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a Question
 */
export const validateSurveyQuestion = (question) => {
  const errors = [];

  if (!question || typeof question !== 'object') {
    return { valid: false, errors: ['Question must be an object'] };
  }

  if (!question.id || typeof question.id !== 'string') {
    errors.push('Question ID is required');
  }

  if (!question.variableName || !/^[a-zA-Z][a-zA-Z0-9_]{1,30}$/.test(question.variableName)) {
    errors.push('Variable name must be 2-30 alphanumeric characters starting with a letter');
  }

  if (!question.prompt || typeof question.prompt !== 'string' || question.prompt.trim().length < 3) {
    errors.push('Question prompt must be at least 3 characters');
  }

  if (!Object.values(QUESTION_TYPES).includes(question.type)) {
    errors.push(`Invalid question type: ${question.type}`);
  }

  if (
    [QUESTION_TYPES.SINGLE_CHOICE, QUESTION_TYPES.MULTI_CHOICE].includes(question.type) &&
    (!Array.isArray(question.options) || question.options.length < 2)
  ) {
    errors.push('Choice-based questions must provide at least 2 options');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Evaluates branching logic for current response answers
 */
export const evaluateBranching = (branchingRules = [], currentAnswers = {}, currentQuestionId) => {
  if (!Array.isArray(branchingRules) || branchingRules.length === 0) return null;

  const relevantRules = branchingRules.filter((r) => r.sourceQuestionId === currentQuestionId);
  for (const rule of relevantRules) {
    const answer = currentAnswers[rule.sourceQuestionId];
    if (answer === undefined || answer === null || answer === '') continue;

    let conditionMet = false;
    switch (rule.condition) {
      case 'equals':
        conditionMet = String(answer).toLowerCase() === String(rule.targetValue).toLowerCase();
        break;
      case 'not_equals':
        conditionMet = String(answer).toLowerCase() !== String(rule.targetValue).toLowerCase();
        break;
      case 'in':
        if (Array.isArray(rule.targetValue)) {
          conditionMet = rule.targetValue.includes(answer);
        }
        break;
      case 'greater_than':
        conditionMet = Number(answer) > Number(rule.targetValue);
        break;
      default:
        break;
    }

    if (conditionMet) {
      return {
        action: rule.action || 'jump_to',
        nextQuestionId: rule.nextQuestionId || null,
        terminate: rule.action === 'terminate',
      };
    }
  }

  return null;
};

/**
 * Validates a response submission against the active survey version
 */
export const validateSurveyResponse = (response, activeVersion) => {
  const errors = [];

  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Response must be an object'] };
  }

  if (!response.consentGiven) {
    errors.push('Explicit consent is required to record a survey response');
  }

  if (!response.idempotencyKey || typeof response.idempotencyKey !== 'string') {
    errors.push('Idempotency key is required to prevent duplicate submissions');
  }

  if (!activeVersion || !Array.isArray(activeVersion.questions)) {
    errors.push('Active survey version has no registered questions');
    return { valid: false, errors };
  }

  const answers = response.answers || {};

  activeVersion.questions.forEach((q) => {
    const val = answers[q.id];
    if (q.required && (val === undefined || val === null || val === '')) {
      errors.push(`Field '${q.prompt}' is required`);
    }

    if (val !== undefined && val !== null && val !== '') {
      if (q.type === QUESTION_TYPES.NUMERIC_RATING) {
        const num = Number(val);
        if (Number.isNaN(num) || num < (q.min || 1) || num > (q.max || 5)) {
          errors.push(`Rating for '${q.prompt}' must be between ${q.min || 1} and ${q.max || 5}`);
        }
      }
      if (q.type === QUESTION_TYPES.TEXT_SHORT && String(val).length > (q.maxCharLength || 250)) {
        errors.push(`Answer for '${q.prompt}' exceeds maximum length of ${q.maxCharLength || 250}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Generates an exportable codebook from a survey and version
 */
export const generateCodebook = (survey, version) => {
  if (!survey || !version) return [];

  const questions = version.questions || [];
  return questions.map((q, idx) => ({
    itemOrder: idx + 1,
    variableName: q.variableName || `VAR_${idx + 1}`,
    questionId: q.id,
    questionType: q.type,
    prompt: q.prompt,
    required: Boolean(q.required),
    isSensitiveDemographic: Boolean(q.isSensitive),
    allowedValues: Array.isArray(q.options)
      ? q.options.map((opt) => (typeof opt === 'object' ? `${opt.value}:${opt.label}` : String(opt)))
      : q.type === QUESTION_TYPES.NUMERIC_RATING
        ? `Scale ${q.min || 1} to ${q.max || 5}`
        : 'Open text entry',
    storageDataType:
      q.type === QUESTION_TYPES.NUMERIC_RATING ? 'INTEGER' : q.type === QUESTION_TYPES.MULTI_CHOICE ? 'ARRAY<TEXT>' : 'TEXT',
  }));
};

/**
 * Applies k-anonymity suppression to demographic strata distributions
 * If count < threshold, masks count and label into "Suppressed / Small Sample"
 */
export const maskSmallDemographicSubgroups = (distribution = {}, threshold = DEFAULT_K_ANONYMITY_THRESHOLD) => {
  const result = {};
  let suppressedCount = 0;

  Object.entries(distribution).forEach(([key, count]) => {
    if (count < threshold) {
      suppressedCount += count;
    } else {
      result[key] = count;
    }
  });

  if (suppressedCount > 0) {
    result['Suppressed (Small Group < ' + threshold + ')'] = suppressedCount;
  }

  return result;
};

/**
 * Migration Runner for Survey Entities
 */
export const migrateSurveyData = (data, fromVersion, toVersion) => {
  if (fromVersion === toVersion) return data;

  const migrated = JSON.parse(JSON.stringify(data));

  if (fromVersion === 0 && toVersion === 1) {
    // Migration v0 -> v1: add schemaVersion, ensure consentConfig & anonymousMode
    migrated.schemaVersion = 1;
    if (!migrated.consentConfig) {
      migrated.consentConfig = {
        consentText: 'Voluntary civic response. Data processed anonymously for public improvement.',
        withdrawalNotice: 'You may withdraw consent using your anonymous receipt token before survey closure.',
        retentionDays: 365,
      };
    }
    if (migrated.anonymousMode === undefined) {
      migrated.anonymousMode = true;
    }
  }

  return migrated;
};

/**
 * Rollback Runner for Survey Entities
 */
export const rollbackSurveyData = (data, fromVersion, toVersion) => {
  if (fromVersion === toVersion) return data;

  const rolledBack = JSON.parse(JSON.stringify(data));

  if (fromVersion === 1 && toVersion === 0) {
    delete rolledBack.schemaVersion;
  }

  return rolledBack;
};

