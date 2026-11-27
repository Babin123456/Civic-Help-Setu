// Agent Contract Tests (#1144)
// ============================
// Validates all agent input/output contracts, boundary validation,
// and approval gate logic.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AGENT_SCHEMA_VERSION,
  AGENT_STATUS,
  AGENT_PRIORITY,
  CASE_STATE_TRANSITIONS,
  HIGH_IMPACT_ACTIONS,
  validateAgentInput,
  validateAgentOutput,
  requiresCitizenApproval,
  syntheticFixtures,
  AgentOutputProposal,
  ApprovalResult,
} from '../src/data/agentContract.js';

describe('Agent Contracts - Multi-Agent Civic Casework Orchestrator', () => {
  describe('AGENT_SCHEMA_VERSION', () => {
    it('has correct schema version', () => {
      expect(AGENT_SCHEMA_VERSION).toBe('1.0.0');
    });
  });

  describe('AGENT_STATUS', () => {
    it('has all required statuses', () => {
      expect(AGENT_STATUS.PENDING).toBe('pending');
      expect(AGENT_STATUS.RUNNING).toBe('running');
      expect(AGENT_STATUS.COMPLETED).toBe('completed');
      expect(AGENT_STATUS.FAILED).toBe('failed');
      expect(AGENT_STATUS.CANCELLED).toBe('cancelled');
      expect(AGENT_STATUS.APPROVAL_REQUIRED).toBe('approval_required');
      expect(AGENT_STATUS.APPROVED).toBe('approved');
      expect(AGENT_STATUS.REJECTED).toBe('rejected');
    });
  });

  describe('AGENT_PRIORITY', () => {
    it('has priority levels', () => {
      expect(AGENT_PRIORITY.LOW).toBe('low');
      expect(AGENT_PRIORITY.NORMAL).toBe('normal');
      expect(AGENT_PRIORITY.HIGH).toBe('high');
      expect(AGENT_PRIORITY.URGENT).toBe('urgent');
    });
  });

  describe('CASE_STATE_TRANSITIONS', () => {
    it('has valid intake transitions', () => {
      expect(CASE_STATE_TRANSITIONS.intake_pending).toEqual(['intake_in_progress']);
      expect(CASE_STATE_TRANSITIONS.intake_in_progress).toEqual([
        'intake_completed',
        'intake_failed',
        'intake_cancelled',
      ]);
    });

    it('has valid policy retrieval transitions', () => {
      expect(CASE_STATE_TRANSITIONS.policy_retrieval_in_progress).toEqual([
        'policy_retrieval_completed',
        'policy_retrieval_failed',
      ]);
    });

    it('has valid evidence organization transitions', () => {
      expect(CASE_STATE_TRANSITIONS.evidence_organization_in_progress).toEqual([
        'evidence_organization_completed',
        'evidence_organization_failed',
      ]);
    });

    it('has valid form assistance transitions', () => {
      expect(CASE_STATE_TRANSITIONS.form_assistance_in_progress).toEqual([
        'form_assistance_completed',
        'form_assistance_failed',
        'form_assistance_approval_required',
      ]);
    });

    it('has valid quality review transitions', () => {
      expect(CASE_STATE_TRANSITIONS.quality_review_in_progress).toEqual([
        'quality_review_completed',
        'quality_review_failed',
        'quality_review_approval_required',
      ]);
    });

    it('submission state has valid transitions', () => {
      expect(CASE_STATE_TRANSITIONS.submission_pending).toContain('submission_approved');
      expect(CASE_STATE_TRANSITIONS.submission_approved).toEqual([]);
    });
  });

  describe('HIGH_IMPACT_ACTIONS', () => {
    it('has defined high-impact action types', () => {
      expect(HIGH_IMPACT_ACTIONS.SUBMIT_FORM).toBe('submit_form');
      expect(HIGH_IMPACT_ACTIONS.FILE_OFFICIAL).toBe('file_official');
      expect(HIGH_IMPACT_ACTIONS.CLAIM_BENEFIT).toBe('claim_benefit');
      expect(HIGH_IMPACT_ACTIONS.RELEASE_DATA).toBe('release_data');
    });
  });

  describe('validateAgentInput', () => {
    it('validates intake input correctly', () => {
      // Valid intake input
      const validInput = {
        citizenId: 'synthetic-citizen-001',
        caseType: 'public-grievance',
        intakeData: {
          complaint: 'Test complaint',
        },
      };
      const result = validateAgentInput(validInput, 'intake');
      expect(result.valid).toBe(true);
    });

    it('rejects missing citizenId in intake', () => {
      const invalidInput = {
        caseType: 'public-grievance',
        intakeData: { complaint: 'Test' },
      };
      const result = validateAgentInput(invalidInput, 'intake');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'citizenId')).toBe(true);
    });

    it('rejects missing caseType in intake', () => {
      const invalidInput = {
        citizenId: 'synthetic-citizen-001',
        intakeData: { complaint: 'Test' },
      };
      const result = validateAgentInput(invalidInput, 'intake');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'caseType')).toBe(true);
    });

    it('validates policy input correctly', () => {
      const validInput = {
        query: 'What schemes am I eligible for?',
        jurisdiction: { level: 'state', states: ['Maharashtra'] },
      };
      const result = validateAgentInput(validInput, 'policy');
      expect(result.valid).toBe(true);
    });

    it('validates evidence input correctly', () => {
      const validInput = {
        caseId: 'synthetic-case-001',
        evidenceItems: [{ id: 'ev-1', type: 'photo' }],
      };
      const result = validateAgentInput(validInput, 'evidence');
      expect(result.valid).toBe(true);
    });

    it('validates form-assistance input correctly', () => {
      const validInput = {
        caseId: 'synthetic-case-001',
        formType: 'grievance-submission',
        formData: { field: 'value' },
      };
      const result = validateAgentInput(validInput, 'form-assistance');
      expect(result.valid).toBe(true);
    });

    it('validates quality-review input correctly', () => {
      const validInput = {
        caseId: 'synthetic-case-001',
        content: 'Test content',
      };
      const result = validateAgentInput(validInput, 'quality-review');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateAgentOutput', () => {
    it('validates complete agent output proposal', () => {
      const validOutput = {
        proposal: { key: 'value' },
        citations: [{ source: 'test', url: '#', excerpt: 'test excerpt' }],
        confidence: 0.85,
        requiresApproval: true,
        impactLevel: 'high',
        rationale: 'Test rationale',
        agentName: 'test-agent',
        timestamp: new Date().toISOString(),
      };
      const result = validateAgentOutput(validOutput);
      expect(result.valid).toBe(true);
    });

    it('rejects output missing required fields', () => {
      const incompleteOutput = {
        proposal: { key: 'value' },
        citations: [],
        confidence: 0.85,
        requiresApproval: true,
        impactLevel: 'high',
        rationale: 'Test',
        agentName: 'test-agent',
        // missing timestamp
      };
      const result = validateAgentOutput(incompleteOutput);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'timestamp')).toBe(true);
    });

    it('rejects invalid confidence value', () => {
      const invalidOutput = {
        proposal: { key: 'value' },
        citations: [],
        confidence: 1.5, // Invalid: > 1
        requiresApproval: true,
        impactLevel: 'high',
        rationale: 'Test',
        agentName: 'test-agent',
        timestamp: new Date().toISOString(),
      };
      const result = validateAgentOutput(invalidOutput);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'confidence')).toBe(true);
    });

    it('validates impactLevel', () => {
      const validOutput = {
        proposal: { key: 'value' },
        citations: [],
        confidence: 0.85,
        requiresApproval: true,
        impactLevel: 'critical',
        rationale: 'Test',
        agentName: 'test-agent',
        timestamp: new Date().toISOString(),
      };
      const result = validateAgentOutput(validOutput);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid impactLevel', () => {
      const invalidOutput = {
        proposal: { key: 'value' },
        citations: [],
        confidence: 0.85,
        requiresApproval: true,
        impactLevel: 'invalid',
        rationale: 'Test',
        agentName: 'test-agent',
        timestamp: new Date().toISOString(),
      };
      const result = validateAgentOutput(invalidOutput);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'impactLevel')).toBe(true);
    });
  });

  describe('requiresCitizenApproval', () => {
    it('requires approval for critical impact + submit_form', () => {
      expect(
        requiresCitizenApproval('critical', HIGH_IMPACT_ACTIONS.SUBMIT_FORM)
      ).toBe(true);
    });

    it('requires approval for high impact + submit_form', () => {
      expect(
        requiresCitizenApproval('high', HIGH_IMPACT_ACTIONS.SUBMIT_FORM)
      ).toBe(true);
    });

    it('does not require approval for low impact', () => {
      expect(
        requiresCitizenApproval('low', HIGH_IMPACT_ACTIONS.SUBMIT_FORM)
      ).toBe(false);
    });

    it('does not require approval for non-submit actions', () => {
      expect(
        requiresCitizenApproval('high', 'some-other-action')
      ).toBe(false);
    });
  });

  describe('syntheticFixtures', () => {
    it('has sample intake input', () => {
      expect(syntheticFixtures.sampleIntakeInput).toHaveProperty('citizenId');
      expect(syntheticFixtures.sampleIntakeInput).toHaveProperty('caseType');
      expect(syntheticFixtures.sampleIntakeInput).toHaveProperty('intakeData');
    });

    it('has sample policy query', () => {
      expect(syntheticFixtures.samplePolicyQuery).toHaveProperty('query');
      expect(syntheticFixtures.samplePolicyQuery).toHaveProperty('jurisdiction');
    });

    it('has sample evidence input', () => {
      expect(syntheticFixtures.sampleEvidenceInput).toHaveProperty('caseId');
      expect(syntheticFixtures.sampleEvidenceInput).toHaveProperty('evidenceItems');
    });

    it('has sample form data input', () => {
      expect(syntheticFixtures.sampleFormDataInput).toHaveProperty('caseId');
      expect(syntheticFixtures.sampleFormDataInput).toHaveProperty('formType');
      expect(syntheticFixtures.sampleFormDataInput).toHaveProperty('formData');
    });

    it('has sample quality review input', () => {
      expect(syntheticFixtures.sampleQualityReviewInput).toHaveProperty('caseId');
      expect(syntheticFixtures.sampleQualityReviewInput).toHaveProperty('content');
    });
  });
});