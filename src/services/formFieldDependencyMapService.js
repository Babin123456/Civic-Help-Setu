/**
 * Civic Application Form Field Dependency and Validation Map Service
 *
 * Implements a directed dependency graph engine, dynamic condition evaluator,
 * and pre-portal validation mapper for complex multi-tier civic forms:
 *
 * 1. Declarative Form Schemas & Civic Templates:
 *    - Models complex forms (INCOME_CERTIFICATE_FORM, BUILDING_PLAN_SANCTION_FORM).
 *    - Expresses explicit field dependencies, conditional activation expressions,
 *      format validators, and statutory source rule citations.
 *
 * 2. Graph Integrity & Cycle Detection:
 *    - Validates schemas against circular dependencies and dangling references.
 *    - Enforces topological evaluation order.
 *
 * 3. Reactive State Recalculation & Downstream Pruning:
 *    - Predictably recalculates active, conditional, and invalid field states.
 *    - Automatically prunes/resets irrelevant downstream answers when upstream branches shift.
 *
 * 4. Dependency Path Inspection:
 *    - inspectDependencyPath() traces the precise upstream questions and decisions
 *      that cause any conditional field to appear.
 *
 * 5. Multi-Modal Visualizer & Linear Screen-Reader Support:
 *    - Outputs directed node/edge graph structures for interactive graph visualizers.
 *    - Provides a linearized, keyboard-navigable view for mobile screens and assistive tech.
 *
 * 6. Privacy & PII Minimization:
 *    - Distinguishes local draft user answers from official government submissions.
 *    - Redacts sensitive inputs (Aadhaar, income figures, plot refs) in export summaries.
 */

export const FIELD_STATE = {
  REQUIRED: 'REQUIRED',
  CONDITIONAL_ACTIVE: 'CONDITIONAL_ACTIVE',
  INACTIVE_PRUNED: 'INACTIVE_PRUNED',
  OPTIONAL: 'OPTIONAL',
  COMPLETED: 'COMPLETED',
  INVALID: 'INVALID',
};

export const DEPENDENCY_RELATION = {
  ACTIVATES_FIELD: 'ACTIVATES_FIELD',
  CONSTRAINS_VALUE: 'CONSTRAINS_VALUE',
  MANDATES_ATTACHMENT: 'MANDATES_ATTACHMENT',
};

export const FORM_VIEWER_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  READY: 'READY',
};

export const STATUTORY_FORM_DISCLAIMER =
  'Statutory Notice: This form dependency map and validation check is a client-side preparation tool to prevent scrutiny rejections. It DOES NOT submit an official application or claim government portal acceptance. Official filing must be executed on the designated statutory department portal.';

/**
 * Built-in authoritative civic form schemas.
 */
export const SUPPORTED_FORM_SCHEMAS = {
  INCOME_CERTIFICATE_FORM: {
    schemaId: 'INCOME_CERTIFICATE_FORM',
    title: 'Income and Asset Certificate Application Form',
    statutoryAuthority: 'Department of Revenue & Disaster Management / Taluka Tahsildar',
    version: '1.0.0',
    fields: [
      {
        fieldId: 'applicant_category',
        label: 'Applicant Occupation & Livelihood Category',
        fieldType: 'SELECT',
        options: ['STUDENT', 'SALARIED', 'AGRICULTURIST', 'BUSINESS_OWNER'],
        mandatory: true,
        helpText: 'Select current primary occupation to determine income verification documents.',
        statutoryRule: 'State Right to Public Services (RTS) Revenue Rules, Form 1',
      },
      // Branch: STUDENT
      {
        fieldId: 'institution_id_proof',
        label: 'School / College Photo Identity Card Reference',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'applicant_category', condition: 'EQUALS', expectedValue: 'STUDENT' },
        mandatory: true,
        helpText: 'Required to verify bona fide student status for fee concession / scholarship quota.',
        statutoryRule: 'Department of Higher Education Circular 2024/Scholarship',
      },
      {
        fieldId: 'tuition_fee_structure',
        label: 'Annual Tuition Fee Receipt Reference',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'applicant_category', condition: 'EQUALS', expectedValue: 'STUDENT' },
        mandatory: false,
        helpText: 'Optional fee proof for partial educational waiver assessment.',
        statutoryRule: 'State Education Welfare Guidelines',
      },
      // Branch: SALARIED
      {
        fieldId: 'form_16_or_salary_slips',
        label: 'Form 16 or Consecutive 3-Month Salary Slips',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'applicant_category', condition: 'EQUALS', expectedValue: 'SALARIED' },
        mandatory: true,
        helpText: 'Employer issued salary certificate showing gross and net earnings.',
        statutoryRule: 'Income Certificate Verification Manual Clause 5.2',
      },
      // Branch: AGRICULTURIST
      {
        fieldId: 'land_patta_khasra_extract',
        label: 'Agricultural Land Holding (Patta / Khasra / RTC extract)',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'applicant_category', condition: 'EQUALS', expectedValue: 'AGRICULTURIST' },
        mandatory: true,
        helpText: 'Revenue land extract specifying acreage, wet/dry land classification, and crop yields.',
        statutoryRule: 'Land Revenue Code Agricultural Income Assessment Guidelines',
      },
      // Branch: BUSINESS_OWNER
      {
        fieldId: 'gstin_or_itr_acknowledgement',
        label: 'GSTIN Registration or Income Tax Return (ITR-V) Acknowledgement',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'applicant_category', condition: 'EQUALS', expectedValue: 'BUSINESS_OWNER' },
        mandatory: true,
        helpText: 'Financial year audited turnover or IT declaration.',
        statutoryRule: 'Commercial Tax and Revenue Assessment Directives',
      },
      // Cross-cutting question
      {
        fieldId: 'has_bpl_ration_card',
        label: 'Does your family hold an active BPL / Antyodaya Ration Card?',
        fieldType: 'BOOLEAN',
        mandatory: true,
        helpText: 'BPL ration card possession expedites field verification by Village Administrative Officer (VAO).',
        statutoryRule: 'Public Distribution System (Control) Order & Welfare Integration',
      },
      {
        fieldId: 'bpl_ration_card_number',
        label: 'BPL / Antyodaya Ration Card 12-Digit Number',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'has_bpl_ration_card', condition: 'EQUALS', expectedValue: true },
        mandatory: true,
        validationRegex: '^\\d{12}$',
        validationMessage: 'Ration card number must contain exactly 12 numeric digits.',
        helpText: 'Card number will be verified with the PDS database.',
        statutoryRule: 'National Food Security Act (NFSA) 2013',
      },
    ],
  },
  BUILDING_PLAN_SANCTION_FORM: {
    schemaId: 'BUILDING_PLAN_SANCTION_FORM',
    title: 'Municipal Building Permit and Architectural Sanction Form',
    statutoryAuthority: 'Municipal Corporation Town Planning Scrutiny Cell',
    version: '1.0.0',
    fields: [
      {
        fieldId: 'plot_jurisdiction_tier',
        label: 'Plot Jurisdiction & Authority Area',
        fieldType: 'SELECT',
        options: ['MUNICIPAL_CORPORATION', 'DEVELOPMENT_AUTHORITY', 'GRAM_PANCHAYAT'],
        mandatory: true,
        helpText: 'Determines whether municipal bye-laws or regional development rules apply.',
        statutoryRule: 'State Town and Country Planning Act (Planning Authorities)',
      },
      {
        fieldId: 'proposed_building_height_m',
        label: 'Proposed Total Building Height in Meters',
        fieldType: 'NUMBER',
        mandatory: true,
        helpText: 'Measured from average crown of road to the terrace slab level.',
        statutoryRule: 'National Building Code 2016 Part 4 Fire and Life Safety Clause 2.27',
      },
      {
        fieldId: 'fire_provisional_noc_number',
        label: 'Provisional Fire NOC Application / Clearance Reference',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'proposed_building_height_m', condition: 'GREATER_THAN', expectedValue: 15.0 },
        mandatory: true,
        helpText: 'Mandatory for all high-rise buildings exceeding 15 meters in height.',
        statutoryRule: 'NBC 2016 Part 4 & State Fire Safety Act High-Rise Mandate',
      },
      {
        fieldId: 'is_commercial_or_assembly',
        label: 'Does the building include Commercial, Assembly, or Industrial Use?',
        fieldType: 'BOOLEAN',
        mandatory: true,
        helpText: 'Mixed-use and commercial occupancy require traffic circulation scrutiny.',
        statutoryRule: 'Development Control Regulations (Zoning Classification)',
      },
      {
        fieldId: 'spcb_pollution_consent_ref',
        label: 'Pollution Control Board (SPCB) Consent-to-Establish Reference',
        fieldType: 'TEXT',
        dependsOn: { fieldId: 'is_commercial_or_assembly', condition: 'EQUALS', expectedValue: true },
        mandatory: true,
        helpText: 'Mandatory environmental discharge clearance for commercial and trade buildings.',
        statutoryRule: 'Water (Prevention and Control of Pollution) Act, 1974 Section 25',
      },
    ],
  },
};

/**
 * Checks for circular dependencies in a form schema using cycle detection.
 *
 * @param {Object} schema Form schema definition
 * @returns {Object} Validation outcome
 */
export function validateSchemaIntegrity(schema) {
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error('Valid schema with fields array is required');
  }

  const fieldMap = new Map();
  const graph = new Map();

  schema.fields.forEach((f) => {
    fieldMap.set(f.fieldId, f);
    graph.set(f.fieldId, []);
  });

  // Build dependency edges: parent -> dependent
  for (const field of schema.fields) {
    if (field.dependsOn) {
      const parentId = field.dependsOn.fieldId;
      if (!fieldMap.has(parentId)) {
        return {
          isValid: false,
          errorCode: 'DANGLING_DEPENDENCY_REFERENCE',
          message: `Field '${field.fieldId}' depends on non-existent field '${parentId}'`,
        };
      }
      graph.get(parentId).push(field.fieldId);
    }
  }

  // Depth-first search cycle detection
  const visited = new Set();
  const inStack = new Set();

  function hasCycle(node) {
    visited.add(node);
    inStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }

    inStack.delete(node);
    return false;
  }

  for (const fieldId of graph.keys()) {
    if (!visited.has(fieldId)) {
      if (hasCycle(fieldId)) {
        return {
          isValid: false,
          errorCode: 'CIRCULAR_DEPENDENCY_DETECTED',
          message: `Circular dependency detected involving field '${fieldId}'`,
        };
      }
    }
  }

  return {
    isValid: true,
    totalFields: schema.fields.length,
    message: 'Schema graph integrity verified. No cycles or dangling references found.',
  };
}

/**
 * Evaluates whether a condition expression matches the upstream answer.
 *
 * @param {Object} conditionSpec
 * @param {*} currentUpstreamValue
 * @returns {boolean} True if condition met
 */
export function evaluateCondition(conditionSpec, currentUpstreamValue) {
  if (!conditionSpec) return true;
  const { condition, expectedValue } = conditionSpec;

  if (currentUpstreamValue === undefined || currentUpstreamValue === null) {
    return false;
  }

  switch (condition) {
    case 'EQUALS':
      return currentUpstreamValue === expectedValue;
    case 'NOT_EQUALS':
      return currentUpstreamValue !== expectedValue;
    case 'GREATER_THAN':
      return Number(currentUpstreamValue) > Number(expectedValue);
    case 'LESS_THAN':
      return Number(currentUpstreamValue) < Number(expectedValue);
    case 'IN_LIST':
      return Array.isArray(expectedValue) && expectedValue.includes(currentUpstreamValue);
    default:
      return currentUpstreamValue === expectedValue;
  }
}

/**
 * Evaluates full form state, calculating active fields, errors, and pruned answers.
 *
 * @param {string|Object} schemaInput Schema key or schema object
 * @param {Object} answers Current dictionary of field values
 * @returns {Object} Comprehensive evaluated state
 */
export function evaluateFormState(schemaInput, answers = {}) {
  const schema = typeof schemaInput === 'string'
    ? SUPPORTED_FORM_SCHEMAS[schemaInput]
    : schemaInput;

  if (!schema) {
    throw new Error(`Unsupported schema: '${schemaInput}'`);
  }

  const activeFields = [];
  const inactiveFieldIds = [];
  const fieldStates = {};
  const validationErrors = {};
  const sanitizedAnswers = { ...answers };

  for (const field of schema.fields) {
    let isActive = true;
    let activationReason = 'Unconditional root field';

    if (field.dependsOn) {
      const parentValue = sanitizedAnswers[field.dependsOn.fieldId];
      isActive = evaluateCondition(field.dependsOn, parentValue);
      activationReason = isActive
        ? `Activated because '${field.dependsOn.fieldId}' satisfies condition ${field.dependsOn.condition} (${field.dependsOn.expectedValue})`
        : `Inactive because '${field.dependsOn.fieldId}' is '${parentValue}'`;
    }

    if (isActive) {
      activeFields.push(field);
      const val = sanitizedAnswers[field.fieldId];

      let state = FIELD_STATE.OPTIONAL;
      if (field.mandatory) {
        state = val !== undefined && val !== null && val !== '' ? FIELD_STATE.COMPLETED : FIELD_STATE.REQUIRED;
      } else if (val !== undefined && val !== null && val !== '') {
        state = FIELD_STATE.COMPLETED;
      }

      // Format regex validation
      if (field.validationRegex && val) {
        const regex = new RegExp(field.validationRegex);
        if (!regex.test(String(val))) {
          state = FIELD_STATE.INVALID;
          validationErrors[field.fieldId] = field.validationMessage || 'Invalid format';
        }
      }

      if (field.mandatory && (val === undefined || val === null || val === '')) {
        validationErrors[field.fieldId] = `${field.label} is required`;
      }

      fieldStates[field.fieldId] = {
        fieldId: field.fieldId,
        label: field.label,
        state,
        isActive: true,
        mandatory: field.mandatory,
        activationReason,
        statutoryRule: field.statutoryRule,
      };
    } else {
      inactiveFieldIds.push(field.fieldId);
      // Prune downstream answer if branch became inactive
      if (sanitizedAnswers[field.fieldId] !== undefined) {
        delete sanitizedAnswers[field.fieldId];
      }

      fieldStates[field.fieldId] = {
        fieldId: field.fieldId,
        label: field.label,
        state: FIELD_STATE.INACTIVE_PRUNED,
        isActive: false,
        mandatory: field.mandatory,
        activationReason,
        statutoryRule: field.statutoryRule,
      };
    }
  }

  const unresolvedErrors = Object.keys(validationErrors);

  return {
    schemaId: schema.schemaId,
    title: schema.title,
    statutoryAuthority: schema.statutoryAuthority,
    sanitizedAnswers,
    fieldStates,
    activeFieldCount: activeFields.length,
    inactiveFieldCount: inactiveFieldIds.length,
    validationErrors,
    isFormCompleteAndValid: unresolvedErrors.length === 0,
    readinessVerdict: unresolvedErrors.length === 0 ? 'READY_FOR_OFFICIAL_PORTAL' : 'UNRESOLVED_VALIDATIONS',
    statutoryDisclaimer: STATUTORY_FORM_DISCLAIMER,
  };
}

/**
 * Traces the upstream dependency path causing a target field to be active or inactive.
 *
 * @param {string|Object} schemaInput
 * @param {string} targetFieldId
 * @returns {Array<Object>} Dependency trail
 */
export function inspectDependencyPath(schemaInput, targetFieldId) {
  const schema = typeof schemaInput === 'string'
    ? SUPPORTED_FORM_SCHEMAS[schemaInput]
    : schemaInput;

  if (!schema) {
    throw new Error(`Unsupported schema: '${schemaInput}'`);
  }

  const fieldMap = new Map(schema.fields.map((f) => [f.fieldId, f]));
  const path = [];
  let curr = fieldMap.get(targetFieldId);

  if (!curr) {
    throw new Error(`Field '${targetFieldId}' not found in schema`);
  }

  while (curr && curr.dependsOn) {
    const parent = fieldMap.get(curr.dependsOn.fieldId);
    path.unshift({
      dependentField: curr.fieldId,
      parentField: curr.dependsOn.fieldId,
      parentLabel: parent ? parent.label : curr.dependsOn.fieldId,
      condition: curr.dependsOn.condition,
      expectedValue: curr.dependsOn.expectedValue,
      statutoryRule: curr.statutoryRule,
    });
    curr = parent;
  }

  return path;
}

/**
 * Generates an interactive directed graph representation of form dependencies.
 *
 * @param {string|Object} schemaInput
 * @param {Object} answers Current values
 * @returns {Object} Graph nodes and edges
 */
export function generateFieldDependencyGraph(schemaInput, answers = {}) {
  const schema = typeof schemaInput === 'string'
    ? SUPPORTED_FORM_SCHEMAS[schemaInput]
    : schemaInput;

  if (!schema) {
    throw new Error(`Unsupported schema: '${schemaInput}'`);
  }

  const evaluated = evaluateFormState(schema, answers);
  const nodes = [];
  const edges = [];

  schema.fields.forEach((f) => {
    const st = evaluated.fieldStates[f.fieldId];
    nodes.push({
      id: f.fieldId,
      label: f.label,
      fieldType: f.fieldType,
      state: st.state,
      isActive: st.isActive,
      mandatory: f.mandatory,
      statutoryRule: f.statutoryRule,
    });

    if (f.dependsOn) {
      edges.push({
        id: `edge_${f.dependsOn.fieldId}_${f.fieldId}`,
        source: f.dependsOn.fieldId,
        target: f.fieldId,
        relation: DEPENDENCY_RELATION.ACTIVATES_FIELD,
        condition: `${f.dependsOn.condition} (${f.dependsOn.expectedValue})`,
        active: st.isActive,
      });
    }
  });

  return {
    schemaId: schema.schemaId,
    nodes,
    edges,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    readinessVerdict: evaluated.readinessVerdict,
  };
}

/**
 * Linearized, screen-reader friendly accessible representation of active form fields.
 *
 * @param {string|Object} schemaInput
 * @param {Object} answers
 * @returns {Array<Object>} Accessible rows
 */
export function getLinearAccessibleFormView(schemaInput, answers = {}) {
  const evaluated = evaluateFormState(schemaInput, answers);

  return Object.values(evaluated.fieldStates).map((f) => ({
    fieldId: f.fieldId,
    label: f.label,
    state: f.state,
    isActive: f.isActive,
    mandatory: f.mandatory,
    explanation: f.activationReason,
    currentValue: evaluated.sanitizedAnswers[f.fieldId] !== undefined ? String(evaluated.sanitizedAnswers[f.fieldId]) : 'Unanswered',
    hasError: Boolean(evaluated.validationErrors[f.fieldId]),
    errorMessage: evaluated.validationErrors[f.fieldId] || null,
    statutoryRule: f.statutoryRule,
  }));
}

// In-memory form sessions
const formSessionStore = new Map();

/**
 * Creates a user form preparation session.
 *
 * @param {Object} input
 * @returns {Object} Session
 */
export function createFormSession(input = {}) {
  const {
    ownerId,
    schemaId = 'INCOME_CERTIFICATE_FORM',
    initialAnswers = {},
  } = input;

  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('Valid ownerId is required for form session');
  }

  const schema = SUPPORTED_FORM_SCHEMAS[schemaId];
  if (!schema) {
    throw new Error(`Unsupported schemaId: '${schemaId}'`);
  }

  const integrity = validateSchemaIntegrity(schema);
  if (!integrity.isValid) {
    throw new Error(integrity.message);
  }

  const evaluated = evaluateFormState(schema, initialAnswers);
  const sessionId = `fses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const session = {
    sessionId,
    ownerId,
    schemaId,
    title: schema.title,
    answers: evaluated.sanitizedAnswers,
    fieldStates: evaluated.fieldStates,
    validationErrors: evaluated.validationErrors,
    readinessVerdict: evaluated.readinessVerdict,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statutoryDisclaimer: STATUTORY_FORM_DISCLAIMER,
  };

  formSessionStore.set(sessionId, session);
  return session;
}

/**
 * Retrieves a form session with owner authorization check.
 *
 * @param {string} sessionId
 * @param {string} ownerId
 * @returns {Object|null}
 */
export function getFormSession(sessionId, ownerId) {
  if (!sessionId || !ownerId) return null;
  const session = formSessionStore.get(sessionId);
  if (!session) return null;
  if (session.ownerId !== ownerId) {
    throw new Error('Access Denied: You cannot inspect another citizen form session');
  }
  return session;
}

/**
 * Updates a form answer and recalculates all dependent fields.
 *
 * @param {string} sessionId
 * @param {string} ownerId
 * @param {string} fieldId
 * @param {*} value
 * @returns {Object} Updated session
 */
export function updateFormAnswer(sessionId, ownerId, fieldId, value) {
  const session = getFormSession(sessionId, ownerId);
  if (!session) {
    throw new Error(`Session '${sessionId}' not found`);
  }

  const newAnswers = { ...session.answers, [fieldId]: value };
  const evaluated = evaluateFormState(session.schemaId, newAnswers);

  session.answers = evaluated.sanitizedAnswers;
  session.fieldStates = evaluated.fieldStates;
  session.validationErrors = evaluated.validationErrors;
  session.readinessVerdict = evaluated.readinessVerdict;
  session.updatedAt = new Date().toISOString();

  formSessionStore.set(sessionId, session);
  return session;
}

/**
 * Deletes a form session cleanly.
 *
 * @param {string} sessionId
 * @param {string} ownerId
 * @returns {boolean}
 */
export function deleteFormSession(sessionId, ownerId) {
  const session = getFormSession(sessionId, ownerId);
  if (!session) return false;
  return formSessionStore.delete(sessionId);
}

/**
 * Redacts personal answers for safe export and compliance auditing.
 *
 * @param {Object} session
 * @returns {Object} Sanitized object
 */
export function sanitizeFormSessionForExport(session) {
  if (!session || typeof session !== 'object') return null;

  const sanitized = JSON.parse(JSON.stringify(session));
  sanitized.sessionId = 'REDACTED_FORM_SESSION';
  sanitized.ownerId = 'REDACTED_CITIZEN_ID';

  // Scrub any specific numbers
  for (const k of Object.keys(sanitized.answers || {})) {
    if (typeof sanitized.answers[k] === 'string' && sanitized.answers[k].length > 4) {
      sanitized.answers[k] = '[REDACTED_INPUT]';
    }
  }

  return sanitized;
}

/**
 * Resets internal test stores.
 */
export function _resetFormSessionStore() {
  formSessionStore.clear();
}
