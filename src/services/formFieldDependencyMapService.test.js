import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIELD_STATE,
  DEPENDENCY_RELATION,
  FORM_VIEWER_STATE,
  STATUTORY_FORM_DISCLAIMER,
  SUPPORTED_FORM_SCHEMAS,
  validateSchemaIntegrity,
  evaluateCondition,
  evaluateFormState,
  inspectDependencyPath,
  generateFieldDependencyGraph,
  getLinearAccessibleFormView,
  createFormSession,
  getFormSession,
  updateFormAnswer,
  deleteFormSession,
  sanitizeFormSessionForExport,
  _resetFormSessionStore,
} from './formFieldDependencyMapService.js';

describe('FormFieldDependencyMapService', () => {
  beforeEach(() => {
    _resetFormSessionStore();
  });

  describe('Schema Integrity & Cycle Detection', () => {
    it('validates authoritative built-in schemas successfully', () => {
      const incomeIntegrity = validateSchemaIntegrity(SUPPORTED_FORM_SCHEMAS.INCOME_CERTIFICATE_FORM);
      expect(incomeIntegrity.isValid).toBe(true);
      expect(incomeIntegrity.totalFields).toBeGreaterThan(0);

      const buildingIntegrity = validateSchemaIntegrity(SUPPORTED_FORM_SCHEMAS.BUILDING_PLAN_SANCTION_FORM);
      expect(buildingIntegrity.isValid).toBe(true);
      expect(buildingIntegrity.totalFields).toBeGreaterThan(0);
    });

    it('throws error when schema or fields array is missing', () => {
      expect(() => validateSchemaIntegrity(null)).toThrow('Valid schema with fields array is required');
      expect(() => validateSchemaIntegrity({})).toThrow('Valid schema with fields array is required');
    });

    it('detects dangling dependency references to non-existent fields', () => {
      const invalidSchema = {
        schemaId: 'TEST_DANGLING',
        fields: [
          { fieldId: 'field_b', dependsOn: { fieldId: 'non_existent_field', condition: 'EQUALS', expectedValue: true } },
        ],
      };

      const result = validateSchemaIntegrity(invalidSchema);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('DANGLING_DEPENDENCY_REFERENCE');
      expect(result.message).toContain('non-existent field');
    });

    it('detects circular dependencies between fields', () => {
      const circularSchema = {
        schemaId: 'TEST_CIRCULAR',
        fields: [
          { fieldId: 'node_a', dependsOn: { fieldId: 'node_c', condition: 'EQUALS', expectedValue: 'YES' } },
          { fieldId: 'node_b', dependsOn: { fieldId: 'node_a', condition: 'EQUALS', expectedValue: 'YES' } },
          { fieldId: 'node_c', dependsOn: { fieldId: 'node_b', condition: 'EQUALS', expectedValue: 'YES' } },
        ],
      };

      const result = validateSchemaIntegrity(circularSchema);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('CIRCULAR_DEPENDENCY_DETECTED');
      expect(result.message).toContain('Circular dependency detected');
    });
  });

  describe('evaluateCondition', () => {
    it('evaluates EQUALS and NOT_EQUALS conditions', () => {
      expect(evaluateCondition({ condition: 'EQUALS', expectedValue: 'STUDENT' }, 'STUDENT')).toBe(true);
      expect(evaluateCondition({ condition: 'EQUALS', expectedValue: 'STUDENT' }, 'SALARIED')).toBe(false);
      expect(evaluateCondition({ condition: 'NOT_EQUALS', expectedValue: 'STUDENT' }, 'SALARIED')).toBe(true);
      expect(evaluateCondition({ condition: 'NOT_EQUALS', expectedValue: 'STUDENT' }, 'STUDENT')).toBe(false);
    });

    it('evaluates GREATER_THAN and LESS_THAN numerical conditions', () => {
      expect(evaluateCondition({ condition: 'GREATER_THAN', expectedValue: 15 }, 18)).toBe(true);
      expect(evaluateCondition({ condition: 'GREATER_THAN', expectedValue: 15 }, 12)).toBe(false);
      expect(evaluateCondition({ condition: 'LESS_THAN', expectedValue: 50 }, 30)).toBe(true);
      expect(evaluateCondition({ condition: 'LESS_THAN', expectedValue: 50 }, 60)).toBe(false);
    });

    it('evaluates IN_LIST conditions', () => {
      const spec = { condition: 'IN_LIST', expectedValue: ['METRO', 'MUNICIPAL_CORP'] };
      expect(evaluateCondition(spec, 'METRO')).toBe(true);
      expect(evaluateCondition(spec, 'GRAM_PANCHAYAT')).toBe(false);
    });

    it('returns false for null or undefined upstream values', () => {
      expect(evaluateCondition({ condition: 'EQUALS', expectedValue: 'ANY' }, null)).toBe(false);
      expect(evaluateCondition({ condition: 'EQUALS', expectedValue: 'ANY' }, undefined)).toBe(false);
    });

    it('returns true when conditionSpec is empty or undefined', () => {
      expect(evaluateCondition(null, 'ANY')).toBe(true);
    });
  });

  describe('evaluateFormState & Reactive Pruning', () => {
    it('throws error for unsupported schema key', () => {
      expect(() => evaluateFormState('NON_EXISTENT_SCHEMA')).toThrow('Unsupported schema');
    });

    it('identifies unfulfilled mandatory root fields and sets readiness to UNRESOLVED_VALIDATIONS', () => {
      const evaluated = evaluateFormState('INCOME_CERTIFICATE_FORM', {});
      expect(evaluated.isFormCompleteAndValid).toBe(false);
      expect(evaluated.readinessVerdict).toBe('UNRESOLVED_VALIDATIONS');
      expect(evaluated.validationErrors.applicant_category).toBeDefined();
      expect(evaluated.statutoryDisclaimer).toBe(STATUTORY_FORM_DISCLAIMER);
    });

    it('activates category-specific fields dynamically based on applicant occupation', () => {
      const evaluatedStudent = evaluateFormState('INCOME_CERTIFICATE_FORM', {
        applicant_category: 'STUDENT',
      });

      expect(evaluatedStudent.fieldStates.institution_id_proof.isActive).toBe(true);
      expect(evaluatedStudent.fieldStates.form_16_or_salary_slips.isActive).toBe(false);
      expect(evaluatedStudent.fieldStates.land_patta_khasra_extract.isActive).toBe(false);
    });

    it('prunes downstream answers when category changes', () => {
      // First, user was student and had entered an institution id proof
      const initialAnswers = {
        applicant_category: 'STUDENT',
        institution_id_proof: 'STU-ID-98765',
        has_bpl_ration_card: false,
      };

      const step1 = evaluateFormState('INCOME_CERTIFICATE_FORM', initialAnswers);
      expect(step1.sanitizedAnswers.institution_id_proof).toBe('STU-ID-98765');

      // Now category switches to SALARIED
      const updatedAnswers = {
        ...step1.sanitizedAnswers,
        applicant_category: 'SALARIED',
      };

      const step2 = evaluateFormState('INCOME_CERTIFICATE_FORM', updatedAnswers);
      expect(step2.sanitizedAnswers.institution_id_proof).toBeUndefined();
      expect(step2.fieldStates.institution_id_proof.state).toBe(FIELD_STATE.INACTIVE_PRUNED);
      expect(step2.fieldStates.form_16_or_salary_slips.isActive).toBe(true);
    });

    it('enforces regex format validation on ration card field', () => {
      const invalidEval = evaluateFormState('INCOME_CERTIFICATE_FORM', {
        applicant_category: 'STUDENT',
        institution_id_proof: 'COLLEGE-CARD-01',
        has_bpl_ration_card: true,
        bpl_ration_card_number: '12345', // invalid, must be 12 digits
      });

      expect(invalidEval.fieldStates.bpl_ration_card_number.state).toBe(FIELD_STATE.INVALID);
      expect(invalidEval.validationErrors.bpl_ration_card_number).toContain('12 numeric digits');

      const validEval = evaluateFormState('INCOME_CERTIFICATE_FORM', {
        applicant_category: 'STUDENT',
        institution_id_proof: 'COLLEGE-CARD-01',
        has_bpl_ration_card: true,
        bpl_ration_card_number: '123456789012',
      });

      expect(validEval.fieldStates.bpl_ration_card_number.state).toBe(FIELD_STATE.COMPLETED);
      expect(validEval.isFormCompleteAndValid).toBe(true);
      expect(validEval.readinessVerdict).toBe('READY_FOR_OFFICIAL_PORTAL');
    });

    it('handles numeric threshold dependencies in BUILDING_PLAN_SANCTION_FORM', () => {
      const lowRise = evaluateFormState('BUILDING_PLAN_SANCTION_FORM', {
        plot_jurisdiction_tier: 'MUNICIPAL_CORPORATION',
        proposed_building_height_m: 12.5,
        is_commercial_or_assembly: false,
      });

      expect(lowRise.fieldStates.fire_provisional_noc_number.isActive).toBe(false);

      const highRise = evaluateFormState('BUILDING_PLAN_SANCTION_FORM', {
        plot_jurisdiction_tier: 'MUNICIPAL_CORPORATION',
        proposed_building_height_m: 24.0,
        is_commercial_or_assembly: false,
      });

      expect(highRise.fieldStates.fire_provisional_noc_number.isActive).toBe(true);
      expect(highRise.fieldStates.fire_provisional_noc_number.state).toBe(FIELD_STATE.REQUIRED);
    });
  });

  describe('inspectDependencyPath', () => {
    it('traces upstream conditions for conditional fields', () => {
      const path = inspectDependencyPath('INCOME_CERTIFICATE_FORM', 'bpl_ration_card_number');
      expect(path.length).toBe(1);
      expect(path[0].parentField).toBe('has_bpl_ration_card');
      expect(path[0].condition).toBe('EQUALS');
      expect(path[0].expectedValue).toBe(true);
      expect(path[0].statutoryRule).toBeDefined();
    });

    it('returns empty path for root fields', () => {
      const path = inspectDependencyPath('INCOME_CERTIFICATE_FORM', 'applicant_category');
      expect(path).toEqual([]);
    });

    it('throws error for non-existent field', () => {
      expect(() => inspectDependencyPath('INCOME_CERTIFICATE_FORM', 'unknown_field')).toThrow('Field \'unknown_field\' not found');
    });
  });

  describe('generateFieldDependencyGraph', () => {
    it('generates graph nodes and edges for visualizer', () => {
      const graph = generateFieldDependencyGraph('INCOME_CERTIFICATE_FORM', {
        applicant_category: 'STUDENT',
        institution_id_proof: 'STU-123',
      });

      expect(graph.schemaId).toBe('INCOME_CERTIFICATE_FORM');
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);

      const activeEdge = graph.edges.find((e) => e.target === 'institution_id_proof');
      expect(activeEdge).toBeDefined();
      expect(activeEdge.active).toBe(true);
      expect(activeEdge.relation).toBe(DEPENDENCY_RELATION.ACTIVATES_FIELD);
    });
  });

  describe('getLinearAccessibleFormView', () => {
    it('produces structured accessible rows for assistive screen readers', () => {
      const rows = getLinearAccessibleFormView('INCOME_CERTIFICATE_FORM', {
        applicant_category: 'AGRICULTURIST',
      });

      expect(Array.isArray(rows)).toBe(true);
      const agriRow = rows.find((r) => r.fieldId === 'land_patta_khasra_extract');
      expect(agriRow).toBeDefined();
      expect(agriRow.isActive).toBe(true);
      expect(agriRow.explanation).toContain('AGRICULTURIST');
    });
  });

  describe('Session Management & Data Protection', () => {
    it('creates, retrieves, and updates a user form session', () => {
      const session = createFormSession({
        ownerId: 'citizen_rajesh_99',
        schemaId: 'INCOME_CERTIFICATE_FORM',
        initialAnswers: { applicant_category: 'STUDENT' },
      });

      expect(session.sessionId).toBeDefined();
      expect(session.ownerId).toBe('citizen_rajesh_99');

      const retrieved = getFormSession(session.sessionId, 'citizen_rajesh_99');
      expect(retrieved.sessionId).toBe(session.sessionId);

      const updated = updateFormAnswer(session.sessionId, 'citizen_rajesh_99', 'institution_id_proof', 'CARD-ABC');
      expect(updated.answers.institution_id_proof).toBe('CARD-ABC');
    });

    it('enforces privacy boundary against unauthorized citizen access', () => {
      const session = createFormSession({
        ownerId: 'citizen_rajesh_99',
        schemaId: 'INCOME_CERTIFICATE_FORM',
      });

      expect(() => {
        getFormSession(session.sessionId, 'malicious_interloper');
      }).toThrow('Access Denied');
    });

    it('returns null for missing session or empty owner', () => {
      expect(getFormSession(null, 'citizen_1')).toBeNull();
      expect(getFormSession('non_existent_id', 'citizen_1')).toBeNull();
    });

    it('deletes session properly', () => {
      const session = createFormSession({
        ownerId: 'citizen_rajesh_99',
        schemaId: 'INCOME_CERTIFICATE_FORM',
      });

      const deleted = deleteFormSession(session.sessionId, 'citizen_rajesh_99');
      expect(deleted).toBe(true);
      expect(getFormSession(session.sessionId, 'citizen_rajesh_99')).toBeNull();
    });

    it('sanitizes session for audit export without exposing sensitive citizen inputs', () => {
      const session = createFormSession({
        ownerId: 'citizen_rajesh_99',
        schemaId: 'INCOME_CERTIFICATE_FORM',
        initialAnswers: {
          applicant_category: 'STUDENT',
          institution_id_proof: 'CONFIDENTIAL-STUDENT-ENROLLMENT-9988',
        },
      });

      const exported = sanitizeFormSessionForExport(session);
      expect(exported.sessionId).toBe('REDACTED_FORM_SESSION');
      expect(exported.ownerId).toBe('REDACTED_CITIZEN_ID');
      expect(exported.answers.institution_id_proof).toBe('[REDACTED_INPUT]');
    });

    it('exports null when invalid session is passed', () => {
      expect(sanitizeFormSessionForExport(null)).toBeNull();
    });
  });

  describe('Constant exports & Enums', () => {
    it('exports all necessary viewer states and relations', () => {
      expect(FORM_VIEWER_STATE.READY).toBe('READY');
      expect(FORM_VIEWER_STATE.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(DEPENDENCY_RELATION.CONSTRAINS_VALUE).toBe('CONSTRAINS_VALUE');
    });
  });
});
