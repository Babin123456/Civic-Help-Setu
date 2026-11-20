/**
 * Multilingual Government Form Field Explainer & Error-Prevention Assistant Service (#1001)
 *
 * Provides field-by-field explanations, format validation, conditional dependency
 * evaluation, sensitive field warnings, and version change detection for official
 * Uttar Pradesh government forms.
 *
 * ACCEPTANCE CRITERIA ENFORCED:
 * 1. Every explanation is linked to an official form version & department source.
 * 2. Examples strictly use synthetic, fictional data (never real citizen PII).
 * 3. Purely educational: never autofills unknown facts or submits forms.
 * 4. Sensitive fields are highlighted with official-portal-only warnings.
 * 5. Outdated form guidance is detected, marked for review, and withdrawn from active advice.
 * 6. Tests cover language fallback, conditional fields, format validation, and version drift.
 */

import {
  UP_FORM_CATALOGUE,
  FORM_STATUS,
} from '../data/upFormFieldExplainerCatalogue';

// In-memory human review queue for version drifts and outdated forms
let humanReviewQueue = [];

// Cloned working catalogue to allow dynamic version drift tracking during runtime
let liveFormCatalogue = JSON.parse(JSON.stringify(UP_FORM_CATALOGUE));

/**
 * Resets the runtime catalogue to the initial authoritative state.
 * Useful for test isolation.
 */
export const resetFormCatalogue = () => {
  liveFormCatalogue = JSON.parse(JSON.stringify(UP_FORM_CATALOGUE));
  humanReviewQueue = [];
};

/**
 * Retrieves all catalogued forms with issuer, jurisdiction, version, source URL, and status.
 */
export const getAllCataloguedForms = (includeUnderReview = true) => {
  if (includeUnderReview) {
    return liveFormCatalogue;
  }
  return liveFormCatalogue.filter((f) => f.status === FORM_STATUS.ACTIVE);
};

/**
 * Retrieves a single form by ID.
 */
export const getFormById = (formId) => {
  if (!formId) return null;
  return liveFormCatalogue.find((f) => f.formId === formId) || null;
};

/**
 * Retrieves all fields for a specific form.
 */
export const getFormFields = (formId) => {
  const form = getFormById(formId);
  if (!form) return [];
  return form.fields || [];
};

/**
 * Get field-by-field guidance with language fallback and plain-language support.
 *
 * Fallback Hierarchy:
 * Requested language (e.g., 'ta', 'bn', 'hi') -> English ('en') -> Canonical default label
 */
export const getFieldExplanation = (
  formId,
  fieldId,
  targetLanguage = 'en',
  isPlainLanguage = false
) => {
  const form = getFormById(formId);
  if (!form) {
    return {
      error: `Form with ID "${formId}" not found in authoritative catalogue.`,
      isRecognized: false,
    };
  }

  const field = form.fields.find((f) => f.fieldId === fieldId);
  if (!field) {
    return {
      error: `Field with ID "${fieldId}" not found in form "${form.title}".`,
      isRecognized: false,
    };
  }

  // 1. Language Fallback Resolution
  let localizedLabel = field.label;
  if (field.translations) {
    if (field.translations[targetLanguage]) {
      localizedLabel = field.translations[targetLanguage];
    } else if (field.translations.en) {
      localizedLabel = field.translations.en;
    }
  }

  // 2. Status & Outdated Guidance Check
  const isOutdatedOrUnderReview = form.status !== FORM_STATUS.ACTIVE;

  // 3. Fictional Data Invariant Guard
  // Ensure synthetic example explicitly carries the non-real marker
  let safeExample = field.fictionalExample || '';
  if (safeExample && !safeExample.includes('Fictional Sample')) {
    safeExample = `${safeExample} (Fictional Sample - Do not copy)`;
  }

  return {
    fieldId: field.fieldId,
    formId: form.formId,
    formTitle: form.title,
    formVersion: form.version,
    departmentIssuer: form.departmentIssuer,
    jurisdiction: form.jurisdiction,
    sourceUrl: form.sourceUrl,
    lastVerifiedDate: form.lastVerifiedDate,
    formStatus: form.status,
    isGuidanceOutdated: isOutdatedOrUnderReview,
    outdatedNotice: isOutdatedOrUnderReview
      ? `ATTENTION: Official form version has changed or is pending department review. Explanations for version ${form.version} may not reflect recent administrative changes.`
      : null,
    label: localizedLabel,
    originalLabel: field.label,
    resolvedLanguage: field.translations?.[targetLanguage] ? targetLanguage : 'en',
    category: field.category,
    plainLanguageExplanation: field.plainLanguageExplanation,
    isPlainLanguageActive: Boolean(isPlainLanguage),
    whereToFind: field.whereToFind,
    fictionalExample: safeExample,
    isSensitive: Boolean(field.isSensitive),
    sensitivityWarning: field.isSensitive ? field.sensitivityWarning : null,
    isConditional: Boolean(field.isConditional),
    conditionalRules: field.conditionalRules || null,
    formatValidation: field.formatValidation || null,
    officialSourceCitation: field.officialSourceCitation || null,
    submissionBoundaryNotice:
      'Educational Assistant Only: Civic Help Setu never autofills or submits applications. Complete your final application on the official portal: ' +
      form.sourceUrl,
  };
};

/**
 * Validates a field value deterministically without collecting or guessing personal answers.
 */
export const validateFieldFormat = (field, rawValue) => {
  if (!field) {
    return { isValid: false, error: 'Field definition is missing.', isDeterministic: false };
  }

  const rule = field.formatValidation;
  if (!rule) {
    // If no deterministic rule, accept as standard input with default guidance
    return {
      isValid: true,
      error: null,
      tip: 'Refer to printed official form guidelines for formatting.',
      isDeterministic: false,
    };
  }

  const value = String(rawValue || '').trim();

  // If empty and not required, format check passes
  if (!value) {
    return {
      isValid: false,
      error: 'Value cannot be empty.',
      tip: rule.tip || null,
      isDeterministic: true,
    };
  }

  // Rule Type: PINCODE_UP
  if (rule.type === 'PINCODE_UP') {
    // UP postal circles start with 20xxxx to 28xxxx
    const upPincodeRegex = /^2[0-8][0-9]{4}$/;
    if (!upPincodeRegex.test(value)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Invalid Uttar Pradesh PIN code (must be 6 digits starting between 20xxxx and 28xxxx).',
        tip: rule.tip || 'Verify PIN code with India Post UP circle directory.',
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: AADHAAR
  if (rule.type === 'AADHAAR') {
    const cleanDigits = value.replace(/\s+/g, '');
    const aadhaarRegex = /^[2-9][0-9]{11}$/;
    if (!aadhaarRegex.test(cleanDigits)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Aadhaar must be exactly 12 numeric digits and cannot begin with 0 or 1.',
        tip: rule.tip || 'Enter 12 continuous numeric digits.',
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: BANK_ACCOUNT
  if (rule.type === 'BANK_ACCOUNT') {
    const bankRegex = /^[0-9]{9,18}$/;
    if (!bankRegex.test(value)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Bank account must be between 9 and 18 numeric digits.',
        tip: rule.tip || 'Found on your bank passbook first page.',
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: IFSC
  if (rule.type === 'IFSC') {
    const upperValue = value.toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(upperValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'IFSC must be 11 characters (4 letters, 5th character 0, and 6 alphanumeric characters).',
        tip: rule.tip || 'Ensure 5th character is number zero "0", not letter "O".',
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: MOBILE
  if (rule.type === 'MOBILE') {
    const cleanNumber = value.replace(/[\s+-]/g, '');
    const mobileRegex = /^[6-9][0-9]{9}$/;
    if (!mobileRegex.test(cleanNumber)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Mobile number must be 10 digits starting with 6, 7, 8, or 9.',
        tip: rule.tip || 'Do not prefix with +91 or 0.',
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: DATE_PAST or MIN_AGE
  if (rule.type === 'DATE_PAST' || rule.type === 'MIN_AGE') {
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19[0-9]{2}|20[0-2][0-9])$/;
    if (!dateRegex.test(value)) {
      return {
        isValid: false,
        error: 'Date must be formatted as DD/MM/YYYY.',
        tip: 'Example format: 15/08/1960',
        isDeterministic: true,
      };
    }

    const [day, month, year] = value.split('/').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const today = new Date();

    if (parsedDate > today) {
      return {
        isValid: false,
        error: 'Date of birth cannot be in the future.',
        tip: 'Enter a valid past calendar date.',
        isDeterministic: true,
      };
    }

    if (rule.type === 'MIN_AGE' && rule.minAgeYears) {
      let age = today.getFullYear() - parsedDate.getFullYear();
      const m = today.getMonth() - parsedDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < parsedDate.getDate())) {
        age--;
      }

      if (age < rule.minAgeYears) {
        return {
          isValid: false,
          error: rule.errorMessage || `Applicant must be at least ${rule.minAgeYears} years old (calculated age: ${age} years).`,
          tip: rule.tip || `Statutory scheme rules mandate minimum ${rule.minAgeYears} completed years.`,
          isDeterministic: true,
        };
      }
    }

    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: NUMERIC_RANGE
  if (rule.type === 'NUMERIC_RANGE') {
    const num = Number(value);
    if (isNaN(num)) {
      return {
        isValid: false,
        error: 'Value must be a valid numeric figure.',
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
    if (rule.min !== undefined && num < rule.min) {
      return {
        isValid: false,
        error: `Value cannot be less than ${rule.min}.`,
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
    if (rule.max !== undefined && num > rule.max) {
      return {
        isValid: false,
        error: `Value cannot exceed ${rule.max}.`,
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: ENUM
  if (rule.type === 'ENUM' && Array.isArray(rule.allowedValues)) {
    if (!rule.allowedValues.includes(value)) {
      return {
        isValid: false,
        error: rule.errorMessage || `Value must be one of: ${rule.allowedValues.join(', ')}`,
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Rule Type: TEXT_LENGTH
  if (rule.type === 'TEXT_LENGTH') {
    if (rule.minLength && value.length < rule.minLength) {
      return {
        isValid: false,
        error: `Text must be at least ${rule.minLength} characters long (current: ${value.length}).`,
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return {
        isValid: false,
        error: `Text cannot exceed ${rule.maxLength} characters.`,
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
    return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
  }

  // Default Regex Matcher
  if (rule.pattern) {
    const rx = new RegExp(rule.pattern);
    if (!rx.test(value)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Value does not match required format pattern.',
        tip: rule.tip || null,
        isDeterministic: true,
      };
    }
  }

  return { isValid: true, error: null, tip: rule.tip || null, isDeterministic: true };
};

/**
 * Evaluates whether a conditional field is applicable given user context,
 * and returns the official reason citing department instructions.
 */
export const evaluateConditionalField = (field, currentValues = {}) => {
  if (!field) {
    return { isApplicable: false, reason: 'Field not defined.' };
  }

  if (!field.isConditional || !field.conditionalRules) {
    return {
      isApplicable: true,
      isConditional: false,
      reason: 'This field is universally required or optional regardless of upstream choices.',
      officialSourceCitation: field.officialSourceCitation || null,
    };
  }

  const { dependsOnField, condition, expectedValue, reason } = field.conditionalRules;
  const upstreamValue = currentValues[dependsOnField];

  let isApplicable;

  switch (condition) {
    case 'EQUALS':
      isApplicable = upstreamValue === expectedValue;
      break;
    case 'NOT_EQUALS':
      isApplicable = upstreamValue !== undefined && upstreamValue !== expectedValue;
      break;
    case 'LESS_THAN':
      isApplicable = Number(upstreamValue) < Number(expectedValue);
      break;
    case 'GREATER_THAN':
      isApplicable = Number(upstreamValue) > Number(expectedValue);
      break;
    case 'CUSTOM_PREDICATE':
      isApplicable = Boolean(upstreamValue);
      break;
    default:
      isApplicable = Boolean(upstreamValue);
  }

  return {
    isApplicable,
    isConditional: true,
    dependsOnField,
    upstreamValue,
    expectedValue,
    condition,
    reason: isApplicable
      ? `Active: ${reason}`
      : `Hidden / Not Applicable: Applies only when "${dependsOnField}" matches the prescribed criteria (${expectedValue}).`,
    officialSourceCitation: field.officialSourceCitation || null,
  };
};

/**
 * Detects if a downloaded or live government form version has drifted from our catalogued version.
 * If changed, automatically withdraws the active status and queues it for human review.
 */
export const detectFormVersionChange = (
  formId,
  downloadedVersion,
  verificationSourceDetails = {}
) => {
  const form = getFormById(formId);
  if (!form) {
    return {
      detected: false,
      error: `Form ${formId} not found.`,
    };
  }

  const versionMismatch = form.version !== downloadedVersion;

  if (versionMismatch) {
    // Transition status to OUTDATED_UNDER_REVIEW
    form.status = FORM_STATUS.OUTDATED_UNDER_REVIEW;
    form.lastDetectedDriftDate = new Date().toISOString();

    const reviewItem = {
      queueId: `REV-${formId}-${Date.now()}`,
      formId: form.formId,
      formTitle: form.title,
      cataloguedVersion: form.version,
      detectedVersion: downloadedVersion,
      sourceUrl: form.sourceUrl,
      departmentIssuer: form.departmentIssuer,
      detectedAt: new Date().toISOString(),
      status: 'PENDING_HUMAN_REVIEW',
      sourceDetails: verificationSourceDetails,
    };

    humanReviewQueue.push(reviewItem);

    return {
      detected: true,
      message: `Form version change detected (Catalogued: ${form.version}, Downloaded: ${downloadedVersion}). Guidance has been withdrawn and marked for review.`,
      formStatus: form.status,
      reviewQueueId: reviewItem.queueId,
    };
  }

  return {
    detected: false,
    message: `Form version is current (${form.version}). Guidance remains verified and active.`,
    formStatus: form.status,
  };
};

/**
 * Retrieves pending items in the human review queue.
 */
export const getPendingReviewQueue = () => {
  return [...humanReviewQueue];
};

/**
 * Human review approval workflow to publish revised form explanations.
 */
export const approveRevisedFormVersion = (
  formId,
  newVersion,
  updatedFields = null,
  reviewerId = 'gov_cataloguer_01'
) => {
  const form = getFormById(formId);
  if (!form) {
    return { success: false, error: `Form ${formId} not found.` };
  }

  form.version = newVersion;
  form.lastVerifiedDate = new Date().toISOString().split('T')[0];
  form.status = FORM_STATUS.ACTIVE;
  if (Array.isArray(updatedFields)) {
    form.fields = updatedFields;
  }

  // Update review queue item
  const queueIndex = humanReviewQueue.findIndex((item) => item.formId === formId);
  if (queueIndex !== -1) {
    humanReviewQueue[queueIndex].status = 'APPROVED_AND_PUBLISHED';
    humanReviewQueue[queueIndex].approvedBy = reviewerId;
    humanReviewQueue[queueIndex].approvedAt = new Date().toISOString();
  }

  return {
    success: true,
    message: `Form ${form.title} successfully updated to version ${newVersion} and published as ACTIVE.`,
    form,
  };
};

/**
 * Hard barrier guard: Assistant NEVER submits forms or autofills unknown facts.
 */
export const submitOfficialForm = () => {
  throw new Error(
    'Submission Denied: Civic Help Setu Form Explainer is an educational and error-prevention tool only. It does not submit official government forms or interact with state databases. All submissions must be carried out directly on designated statutory portals (.gov.in).'
  );
};
