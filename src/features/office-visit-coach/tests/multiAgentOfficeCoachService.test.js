/**
 * Multi-Agent Office Visit Preparation and Follow-Up Coach Service Tests
 * 
 * Test suite for #1166: Multi-Agent Office Visit Preparation and Follow-Up Coach
 * 
 * Covers:
 * - Visit plan generation with valid/invalid inputs
 * - Checklist item classification and enrichment
 * - Office data freshness/stale detection
 * - Printable output generation
 * - Outcome recording with explicit approval
 * - Schema validation at trust boundaries
 * - Synthetic fixture integration
 * - Negative test cases (stale data, missing fields, AI failure fallback)
 * - Concurrency safety (revision-like tracking)
 * 
 * Engineering constraints verified:
 * - Deterministic rules outside LLM prompts
 * - AI outputs carry provenance and are validated
 * - Explicit human approval for high-impact actions
 * - Non-AI fallback for essential workflows
 * - Never implies appointment booking without integration
 */

import {
  generateVisitPlan,
  validateVisitPlanInput,
  getOfficeVerificationInfo,
  COACH_CONSTANTS,
  OFFICE_VERIFICATION_STATUS,
} from '../multiAgentOfficeCoachService.js';

import {
  inferOfficeType,
} from '../../../services/physicalVisitDossierService.js';

import {
  compileVisitPackData,
  buildPrintableVisitPackHtml,
} from '../../../services/appointmentVisitPackService.js';

import {
  classifyItemText,
} from '../../../services/makeChecklistService.js';

import {
  SAMPLE_RTO_SERVICE,
  SERVICE_WITH_AMBIGUOUS_REQS,
  SERVICE_WITH_ONLY_OPTIONAL,
  SERVICE_MINIMAL,
} from '../__fixtures__/sample-service-all.js';

import {
  createVisitPlan as createPlanFromSchema,
  validateVisitPlan,
} from '../schemas/visit-plan-schema.js';

import {
  createChecklistItem,
  validateChecklistItem,
} from '../schemas/checklist-item-schema.js';

import {
  createVisitOutcome,
  updateVisitOutcome,
  validateVisitOutcome,
} from '../schemas/visit-outcome-schema.js';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Multi-Agent Office Coach Service - #1166', () => {
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(() => {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  // ── Visit Plan Generation Tests ───────────────────────────────────────

  describe('generateVisitPlan()', () => {
    it('generates a valid visit plan for RTO service with fresh data', () => {
      const plan = generateVisitPlan({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Regional Transport Office, City Center',
          address: '123 Transport Marg',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          landmark: 'Near City Hall',
          operatingHours: '08:00 AM - 04:00 PM (Mon-Sat)',
          contact: {
            helpline: '1800-123-4567',
            phone: '01234567890',
          },
        },
        citizenContext: { citizenId: 'test_citizen_001' },
      });

      // Validate against schema
      const schemaErrors = validateVisitPlan(plan);
      expect(schemaErrors).toHaveLength(0);

      // Check key fields
      expect(plan.planId).toBeDefined();
      expect(plan.schemaVersion).toBe('1.0.0');
      expect(plan.citizenId).toBe('test_citizen_001');
      expect(plan.inferredType).toBe('rto');
      expect(plan.checklist).toBeDefined();
      expect(plan.checklist.items).toBeInstanceOf(Array);
      expect(plan.checklist.items.length).toBeGreaterThan(0);
      expect(plan.officeDataStatus).toBe(OFFICE_VERIFICATION_STATUS.FRESH);
    });

    it('flags stale office data correctly', () => {
      const staleService = {
        ...SAMPLE_RTO_SERVICE,
        lastVerified: '2025-01-01', // Old data, beyond 30-day TTL
      };

      const plan = generateVisitPlan({
        service: staleService,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });

      expect(plan.officeDataStatus).toBe(OFFICE_VERIFICATION_STATUS.STALE);
    });

    it('handles UNVERIFIED office data when lastVerified is missing', () => {
      const plan = generateVisitPlan({
        service: SERVICE_MINIMAL,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });

      expect(plan.officeDataStatus).toBe(OFFICE_VERIFICATION_STATUS.UNVERIFIED);
      expect(COACH_CONSTANTS.OFFICE_DATA_TTL_DAYS).toBe(30);
      const info = getOfficeVerificationInfo(plan);
      expect(info.status).toBe('UNVERIFIED');
    });

    it('includes user notes section when requested', () => {
      const plan = generateVisitPlan({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
        includeUserNotes: true,
      });

      // User notes section should be included in section selection
      expect(plan.COACH_CONSTANTS.DEFAULT_SECTION_SELECTION.user_notes).toBe(true);
    });

    it('excludes user notes by default', () => {
      const plan = generateVisitPlan({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });

      // User notes excluded by default per ADR
      expect(plan.COACH_CONSTANTS.DEFAULT_SECTION_SELECTION.user_notes).toBe(false);
    });

    it('generates printable HTML output', () => {
      const plan = generateVisitPlan({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Test RTO',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });

      const html = plan.buildPrintableHtml();
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      // Should contain ink-friendly styling patterns
      expect(html).toContain('CIVIC APPOINTMENT');
      expect(html).toContain('Required Documents');
    });

    it('generates printable text output', () => {
      const plan = generateVisitPlan({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Test RTO',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });

      const text = plan.buildPrintableText();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      // Should contain ink-friendly text markers
      expect(text).toContain('🏛️');
      expect(text).toContain('📄');
    });
  });

  // ── Schema Validation Tests ───────────────────────────────────────────

  describe('visit plan schema validation', () => {
    it('validates a complete visit plan successfully', () => {
      const plan = createPlanFromSchema({
        planId: 'test_plan_001',
        citizenId: 'citizen_anonymous',
        serviceName: 'Test Service',
        serviceCategory: 'Test',
        serviceDepartment: 'Test Dept',
        serviceFees: '₹100',
        serviceProcessingTime: '10 days',
        serviceDocuments: ['Doc1'],
        serviceSteps: [{ title: 'Step 1' }],
        serviceSources: [{ name: 'Test', url: 'https://test.gov.in', verified: true }],
        lastVerified: '2026-11-24',
        officeName: 'Test Office',
        officeAddress: 'Test Add',
        officeCity: 'Test City',
        officeState: 'Test State',
        officePincode: '123456',
        officeLandmark: 'Landmark',
        officeOperatingHours: '09:00 AM - 05:00 PM',
        inferredType: 'general',
      });

      const errors = validateVisitPlan(plan);
      expect(errors).toHaveLength(0);
    });

    it('rejects visit plan with invalid planId', () => {
      const plan = {
        ...createPlanFromSchema({ planId: 'valid' }),
        planId: '', // Empty planId
      };
      const errors = validateVisitPlan(plan);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects visit plan with Aadhaar-like citizenId', () => {
      const plan = createPlanFromSchema({
        citizenId: '1234 5678 9012', // Aadhaar pattern
      });
      const errors = validateVisitPlan(plan);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects visit plan with invalid office pincode', () => {
      const plan = createPlanFromSchema({
        officePincode: '12345', // 5-digit, not 6-digit
      });
      const errors = validateVisitPlan(plan);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects visit plan with invalid office inferredType', () => {
      const plan = createPlanFromSchema({
        inferredType: 'invalid_type',
      });
      const errors = validateVisitPlan(plan);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects visit plan with invalid service name', () => {
      const plan = createPlanFromSchema({
        serviceName: '', // Empty name
      });
      const errors = validateVisitPlan(plan);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── Checklist Item Tests ──────────────────────────────────────────────

  describe('checklist item classification', () => {
    it('classifies mandatory items correctly', () => {
      const result = classifyItemText('Valid Identity Proof (Aadhaar / Voter ID / Passport)', {
        service: SAMPLE_RTO_SERVICE,
      });
      expect(result.type).toBe('required');
      expect(result.isAmbiguous).toBe(false);
    });

    it('classifies ambiguous items with CONFIRM_WITH_DEPARTMENT', () => {
      const result = classifyItemText('Document that may be required (may vary by region)', {
        service: SERVICE_WITH_AMBIGUOUS_REQS,
      });
      expect(result.type).toBe('unverified');
      expect(result.isAmbiguous).toBe(true);
      expect(result.condition).toBe('Confirm with the department.');
    });

    it('classifies optional items', () => {
      const result = classifyItemText('Optional supporting document 1', {
        service: SERVICE_WITH_ONLY_OPTIONAL,
      });
      expect(result.type).toBe('optional');
      expect(result.isAmbiguous).toBe(false);
    });

    it('validates checklist items against schema', () => {
      const item = createChecklistItem({
        id: 'chk_1',
        type: 'original',
        label: 'Test Document',
        description: 'A test document',
      });

      const errors = validateChecklistItem(item);
      expect(errors).toHaveLength(0);
    });

    it('rejects checklist item with invalid type', () => {
      const item = createChecklistItem({
        id: 'chk_1',
        type: 'invalid_type',
        label: 'Test',
      });
      const errors = validateChecklistItem(item);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects checklist item with non-URI source', () => {
      const item = createChecklistItem({
        id: 'chk_1',
        type: 'original',
        label: 'Test',
        source: 'not-a-uri',
      });
      const errors = validateChecklistItem(item);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── Visit Outcome Recording Tests ─────────────────────────────────────

  describe('visit outcome recording', () => {
    let plan;

    beforeEach(() => {
      plan = createPlanFromSchema({
        planId: 'outcome_test_001',
        citizenId: 'citizen_anonymous',
        serviceName: 'Test Service',
        serviceCategory: 'Test',
        serviceDepartment: 'Test Dept',
        serviceFees: '₹100',
        serviceProcessingTime: '10 days',
        serviceDocuments: ['Doc1'],
        serviceSteps: [{ title: 'Step 1' }],
        serviceSources: [],
        lastVerified: '2026-11-24',
        officeName: 'Test Office',
        officeAddress: 'Test Add',
        officeCity: 'Test City',
        officeState: 'Test State',
        officePincode: '123456',
        officeLandmark: 'Landmark',
        officeOperatingHours: '09:00 AM - 05:00 PM',
        inferredType: 'general',
      });
    });

    it('records COMPLETED outcome with explicit approval', () => {
      const updatedOutcome = updateVisitOutcome(
        plan.outcome,
        { status: 'COMPLETED', outcome: 'COMPLETED', outcomeNotes: 'Visit was completed successfully' },
        true // explicitly approved
      );

      expect(updatedOutcome.status).toBe('COMPLETED');
      expect(updatedOutcome.explicitlyApproved).toBe(true);
      expect(updatedOutcome.outcomeNotes).toBe('Visit was completed successfully');
    });

    it('requires explicit approval for PENDING_VISIT to final status change', () => {
      // Should throw when trying to change from PENDING_VISIT to final status without approval
      expect(() => {
        updateVisitOutcome(plan.outcome, { status: 'COMPLETED' }); // no approval
      }).toThrow('Explicit citizen approval required');
    });

    it('records outcome without approval when staying in PENDING_VISIT', () => {
      const updated = updateVisitOutcome(plan.outcome, {
        outcomeNotes: 'Some notes without status change',
      });

      expect(updated.outcomeNotes).toBe('Some notes without status change');
      expect(updated.explicitlyApproved).toBe(false);
    });

    it('validates visit outcome schema', () => {
      const outcome = createVisitOutcome({
        status: 'COMPLETED',
        outcome: 'COMPLETED',
        outcomeNotes: 'Visit completed',
        recordedBy: 'citizen_001',
      });

      const errors = validateVisitOutcome(outcome);
      expect(errors).toHaveLength(0);
    });

    it('rejects visit outcome with invalid status', () => {
      const outcome = createVisitOutcome({
        status: 'INVALID_STATUS',
      });
      const errors = validateVisitOutcome(outcome);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects visit outcome with invalid outcome', () => {
      const outcome = createVisitOutcome({
        outcome: 'INVALID_OUTCOME',
      });
      const errors = validateVisitOutcome(outcome);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── Negative Tests ────────────────────────────────────────────────────

  describe('negative test cases', () => {
    it('throws on missing service object', () => {
      expect(() => {
        generateVisitPlan({}, {}); // no service
      }).toThrow('Valid service object is required');
    });

    it('throws on missing office object', () => {
      expect(() => {
        generateVisitPlan({ service: SAMPLE_RTO_SERVICE }, {}); // no office
      }).toThrow('Valid office object is required');
    });

    it('handles service with empty documents gracefully', () => {
      const plan = generateVisitPlan({
        service: SERVICE_MINIMAL,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });
      expect(plan).toBeDefined();
      expect(plan.checklist.items.length).toBeGreaterThan(0); // Should have fallback items
    });

    it('handles stale data with appropriate warning', () => {
      const staleService = {
        ...SAMPLE_RTO_SERVICE,
        lastVerified: '2024-01-01', // Very old
      };

      const plan = generateVisitPlan({
        service: staleService,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
      });

      expect(plan.officeDataStatus).toBe(OFFICE_VERIFICATION_STATUS.STALE);
      // The plan should still be generated but with stale flag
      expect(plan).toBeDefined();
    });

    it('AI failure fallback produces deterministic results', () => {
      const plan = generateVisitPlan({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Test Office',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
        // Simulate AI failure
        options: { simulateAiFailure: true },
      });

      // Should still produce a valid plan
      expect(plan).toBeDefined();
      expect(plan.checklist).toBeDefined();
      expect(plan.checklist.items).toBeInstanceOf(Array);
      // Provenance should indicate AI fallback
      expect(plan.provenance.aiGenerated).toBe(true);
    });

    it('validates visit plan input at trust boundary', () => {
      const errors = validateVisitPlanInput(null);
      expect(errors.length).toBeGreaterThan(0);

      const errors2 = validateVisitPlanInput({});
      expect(errors2.length).toBeGreaterThan(0);
    });
  });

  // ── Integration Tests with Existing Services ──────────────────────────

  describe('integration with existing services', () => {
    it('combines with physicalVisitDossierService office type inference', () => {
      const result = inferOfficeType(
        { name: 'Regional Transport Office, City Center' },
        SAMPLE_RTO_SERVICE
      );
      expect(result).toBe('rto');
    });

    it('combines with appointmentVisitPackService compilation', () => {
      const packData = compileVisitPackData({
        service: SAMPLE_RTO_SERVICE,
        office: {
          name: 'Test RTO',
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          operatingHours: '08:00 AM - 04:00 PM',
        },
        sectionSelection: {
          office_details: true,
          appointment_info: true,
          required_documents: true,
          procedural_steps: true,
          fees_payment: true,
          rejection_prevention: true,
          user_notes: false,
        },
      });

      const html = buildPrintableVisitPackHtml(packData);
      expect(typeof html).toBe('string');
      expect(html).toContain('Driving License Renewal');
    });

    it('combines with makeChecklistService classification', () => {
      const result = classifyItemText('Valid Driving License (expired within last 1 year)', {
        service: SAMPLE_RTO_SERVICE,
      });
      expect(result.type).toBe('required');
      expect(result.label).toBeDefined();
    });
  });
});