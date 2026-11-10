/**
 * Civic Form Schema Mapper and Guided Form Preparation Engine
 *
 * Implements a guided preparation workspace for Indian civic forms:
 * 1. Maintains versioned form schemas indexed by authority, jurisdiction, effective date, and status.
 * 2. Maps complex official fields to plain-language citizen explanations with statutory citations.
 * 3. Classifies form fields into distinct requirement tiers:
 *    - 'REQUIRED'
 *    - 'OPTIONAL'
 *    - 'CONDITIONAL'
 *    - 'UNSUPPORTED_LEGACY'
 * 4. Enables safe prefilling with explicit provenance tracking (e.g. 'VAULT_USER_CONFIRMED', 'MANUAL_ENTRY').
 * 5. Strict boundary: Prepares and validates structured form data for citizen review and export,
 *    never automatically submits forms to third-party government portals.
 * 6. Detects superseded or obsolete form editions and prompts for the latest notified version.
 */

export const FIELD_REQUIREMENT_TIER = {
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL',
  CONDITIONAL: 'CONDITIONAL',
  UNSUPPORTED_LEGACY: 'UNSUPPORTED_LEGACY',
};

export const VALUE_PROVENANCE = {
  USER_MANUAL_ENTRY: 'USER_MANUAL_ENTRY',
  VAULT_PREFILLED: 'VAULT_PREFILLED',
  DEFAULT_FALLBACK: 'DEFAULT_FALLBACK',
};

export const FORM_PREPARATION_DISCLAIMER =
  'This assistant helps you organize and validate responses according to the official gazette form schema. Civic Help Setu does NOT automatically submit forms to government portals. Please review and sign your completed document before formal filing.';

/**
 * Validates versioned form schema definition.
 * @param {object} schema
 * @returns {boolean}
 */
export function validateFormSchema(schema) {
  return Boolean(
    schema &&
      schema.formId &&
      schema.formName &&
      schema.authority &&
      schema.jurisdiction &&
      schema.versionNumber &&
      schema.effectiveDate &&
      Array.isArray(schema.fields)
  );
}

/**
 * Checks if a form schema is superseded or active.
 *
 * @param {object} schema
 * @param {Array<object>} allSchemas
 * @returns {{ isSuperseded: boolean, latestSchemaId: string|null }}
 */
export function checkSchemaSuperSession(schema, allSchemas = []) {
  if (!schema) return { isSuperseded: false, latestSchemaId: null };

  const successors = allSchemas.filter(
    (s) =>
      s.formId === schema.formId &&
      s.jurisdiction === schema.jurisdiction &&
      s.versionNumber > schema.versionNumber
  );

  if (successors.length > 0) {
    // Sort descending by version number
    successors.sort((a, b) => b.versionNumber - a.versionNumber);
    return {
      isSuperseded: true,
      latestSchemaId: successors[0].id || successors[0].formId,
      notice: `This form edition (v${schema.versionNumber}) has been superseded by v${successors[0].versionNumber} effective ${successors[0].effectiveDate}.`,
    };
  }

  return { isSuperseded: false, latestSchemaId: null };
}

/**
 * Maps and validates applicant responses against the form schema.
 *
 * @param {object} params
 * @param {object} params.schema Master versioned form schema
 * @param {object} params.applicantData Key-value pairs provided by user or vault
 * @param {object} [params.provenanceMap] Map indicating source of each value
 * @returns {object} Form preparation dossier
 */
export function prepareCivicForm({
  schema,
  applicantData = {},
  provenanceMap = {},
}) {
  if (!validateFormSchema(schema)) {
    throw new Error('Invalid form schema provided for preparation');
  }

  const mappedFields = [];
  const missingRequired = [];
  const validationErrors = [];

  for (const field of schema.fields) {
    const rawVal = applicantData[field.key];
    const provenance = provenanceMap[field.key] || VALUE_PROVENANCE.USER_MANUAL_ENTRY;

    // Check conditional requirement
    let tier = field.tier || FIELD_REQUIREMENT_TIER.OPTIONAL;
    if (tier === FIELD_REQUIREMENT_TIER.CONDITIONAL && field.condition) {
      const conditionSatisfied = Boolean(applicantData[field.condition.key]);
      if (conditionSatisfied) {
        tier = FIELD_REQUIREMENT_TIER.REQUIRED;
      }
    }

    const isMissing = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';

    if (tier === FIELD_REQUIREMENT_TIER.REQUIRED && isMissing) {
      missingRequired.push({
        key: field.key,
        label: field.label,
        explanation: field.plainExplanation || '',
      });
    }

    // Pattern / Type validation if value present
    let isValid = true;
    let errorMsg = null;
    if (!isMissing && field.validationRegex) {
      const regex = new RegExp(field.validationRegex);
      if (!regex.test(String(rawVal))) {
        isValid = false;
        errorMsg = field.validationError || `Invalid format for ${field.label}`;
        validationErrors.push({ key: field.key, message: errorMsg });
      }
    }

    mappedFields.push({
      key: field.key,
      label: field.label,
      tier,
      value: rawVal || '',
      provenance,
      isValid,
      errorMsg,
      plainExplanation: field.plainExplanation || '',
      statutoryCitation: field.statutoryCitation || null,
      sampleFormat: field.sampleFormat || null,
    });
  }

  const isFormComplete = missingRequired.length === 0 && validationErrors.length === 0;

  return {
    formId: schema.formId,
    formName: schema.formName,
    authority: schema.authority,
    jurisdiction: schema.jurisdiction,
    versionNumber: schema.versionNumber,
    isComplete: isFormComplete,
    totalFields: schema.fields.length,
    missingRequired,
    validationErrors,
    fields: mappedFields,
    submissionStatus: 'PREPARED_FOR_USER_REVIEW_ONLY',
    disclaimer: FORM_PREPARATION_DISCLAIMER,
  };
}

/**
 * Exports validated form preparation data as an audit-safe JSON or text summary for printing.
 *
 * @param {object} preparedForm
 * @returns {string} Formatted review sheet
 */
export function exportFormReviewSheet(preparedForm) {
  if (!preparedForm) return '';

  const fieldLines = (preparedForm.fields || []).map((f) => {
    return `- ${f.label} [${f.tier}]: "${f.value}" (Origin: ${f.provenance})`;
  });

  return `# ${preparedForm.formName} - Guided Preparation Sheet
Issuing Authority: ${preparedForm.authority} | Jurisdiction: ${preparedForm.jurisdiction}
Form Version: v${preparedForm.versionNumber}
Preparation Completeness: ${preparedForm.isComplete ? 'READY FOR REVIEW' : 'INCOMPLETE'}
Status: ${preparedForm.submissionStatus || 'PREPARED_FOR_USER_REVIEW_ONLY'}

## Form Fields & User Values
${fieldLines.join('\n')}

---
**Submission Notice**:
${preparedForm.disclaimer}
`;
}
