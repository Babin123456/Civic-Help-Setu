import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextAwareClarificationPlanner,
  extractSlotsFromText,
  generateNextQuestion,
  MAX_CLARIFICATION_QUESTIONS,
  SLOTS
} from './contextAwareClarificationPlanner.js';

describe('contextAwareClarificationPlanner', () => {
  describe('extractSlotsFromText', () => {
    it('extracts known services, jurisdictions, and outcomes accurately', () => {
      const extracted = extractSlotsFromText('How to apply for new ration card in Karnataka as senior citizen?');
      expect(extracted.service).toBe('ration-card');
      expect(extracted.jurisdiction).toBe('Karnataka');
      expect(extracted.outcome).toBe('new_application');
      expect(extracted.applicant_type).toBe('senior_citizen');
    });

    it('returns null slots for highly ambiguous queries', () => {
      const extracted = extractSlotsFromText('How do I apply?');
      expect(extracted.service).toBeNull();
      expect(extracted.jurisdiction).toBeNull();
      expect(extracted.outcome).toBe('new_application');
    });
  });

  describe('ContextAwareClarificationPlanner Workflow', () => {
    let planner;

    beforeEach(() => {
      planner = new ContextAwareClarificationPlanner();
    });

    it('requires clarification when service is completely ambiguous', () => {
      const step1 = planner.startSession('How do I apply?');
      expect(step1.type).toBe('CLARIFICATION_REQUIRED');
      expect(step1.slot).toBe(SLOTS.SERVICE);
      expect(step1.question).toContain('Which civic service');
      expect(planner.state.questionsAsked).toBe(1);
    });

    it('resolves step-by-step through focused conversational answers', () => {
      // Step 1: Start ambiguous
      planner.startSession('How do I apply?');

      // Step 2: Answer service
      const step2 = planner.submitAnswer(SLOTS.SERVICE, 'Ration Card');
      expect(step2.type).toBe('CLARIFICATION_REQUIRED');
      expect(step2.slot).toBe(SLOTS.JURISDICTION);
      expect(planner.state.slots.service).toBe('ration-card');

      // Step 3: Answer jurisdiction
      const step3 = planner.submitAnswer(SLOTS.JURISDICTION, 'Karnataka');
      expect(step3.type).toBe('RESOLVED_READY_FOR_RETRIEVAL');
      expect(step3.resolvedInterpretation.service).toBe('ration-card');
      expect(step3.resolvedInterpretation.jurisdiction).toBe('Karnataka');
      expect(step3.resolvedInterpretation.outcome).toBe('new_application');
      expect(planner.state.isResolved).toBe(true);
    });

    it('terminates into safe generic fallback when max question threshold is reached', () => {
      const p = new ContextAwareClarificationPlanner({ questionsAsked: 3, slots: { service: null } });
      const verdict = p.evaluateState();
      expect(verdict.type).toBe('RESOLVED_GENERIC_FALLBACK');
      expect(p.state.fallbackGenericRoute).toBe(true);
    });

    it('handles citizen cancellation gracefully', () => {
      planner.startSession('Need help');
      const cancelResult = planner.cancel();
      expect(cancelResult.type).toBe('SESSION_CANCELLED');
      expect(cancelResult.state.fallbackGenericRoute).toBe(true);
    });

    it('serializes and deserializes session state cleanly', () => {
      planner.startSession('Need voter ID in Delhi');
      const serialized = planner.serialize();

      const resumedPlanner = new ContextAwareClarificationPlanner(serialized);
      expect(resumedPlanner.state.slots.service).toBe('voter-id');
      expect(resumedPlanner.state.slots.jurisdiction).toBe('Delhi');
      expect(resumedPlanner.state.isResolved).toBe(true);
    });
  });
});
