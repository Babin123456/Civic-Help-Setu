import { describe, it, expect } from 'vitest';
import {
  DEPENDENCY_TYPE,
  STEP_STATUS,
  validateEdgeEvidence,
  topologicalSortSteps,
  buildCivicProcedurePlan,
  evaluatePlanGraphQuality,
} from './multiStageCivicProcedurePlannerService.js';

describe('Multi-Stage Civic Procedure Planner Service', () => {
  const mockNodes = [
    { id: 'step-ll', name: 'Learner Licence Issuance', goalId: 'DRIVING_LICENCE' },
    { id: 'step-slot', name: 'Driving Test Slot Booking', goalId: 'DRIVING_LICENCE' },
    { id: 'step-test', name: 'Driving Practical Test', goalId: 'DRIVING_LICENCE' },
    { id: 'step-dl', name: 'Permanent DL Dispatch', goalId: 'DRIVING_LICENCE' },
  ];

  const mockEdges = [
    {
      prerequisiteId: 'step-ll',
      targetStepId: 'step-slot',
      type: DEPENDENCY_TYPE.MANDATORY,
      keyword: 'slot',
      reason: 'Learner licence is required before booking driving slot',
    },
    {
      prerequisiteId: 'step-slot',
      targetStepId: 'step-test',
      type: DEPENDENCY_TYPE.MANDATORY,
      keyword: 'test',
      reason: 'Slot booking confirmed before physical appearance',
    },
    {
      prerequisiteId: 'step-test',
      targetStepId: 'step-dl',
      type: DEPENDENCY_TYPE.MANDATORY,
      keyword: 'dispatch',
      reason: 'Passing test required for final issuance',
    },
  ];

  const mockEvidence = [
    {
      id: 'rule-slot',
      jurisdiction: 'ALL_INDIA',
      text: 'Mandatory slot booking for practical test is only available after LL issue.',
      clause: 'Rule 15 of CMVR 1989',
    },
    {
      id: 'rule-test',
      jurisdiction: 'ALL_INDIA',
      text: 'Driving practical test must be conducted at designated automated testing track.',
      clause: 'Rule 17 of CMVR 1989',
    },
    {
      id: 'rule-dispatch',
      jurisdiction: 'ALL_INDIA',
      text: 'Post passing test, permanent driving licence dispatch initiated via speed post.',
      clause: 'Rule 21 of CMVR 1989',
    },
  ];

  it('validates prerequisite evidence correctly', () => {
    const val = validateEdgeEvidence(mockEdges[0], mockEvidence, 'ALL_INDIA');
    expect(val.valid).toBe(true);
    expect(val.source.id).toBe('rule-slot');
  });

  it('detects missing evidence and flags invalid edge', () => {
    const unbackedEdge = {
      prerequisiteId: 'doc-foreign-clearance',
      targetStepId: 'step-dl',
      type: DEPENDENCY_TYPE.MANDATORY,
      keyword: 'consular',
    };
    const val = validateEdgeEvidence(unbackedEdge, mockEvidence, 'MAHARASHTRA');
    expect(val.valid).toBe(false);
    expect(val.reason).toContain('No verified statutory evidence found');
  });

  it('topologically sorts procedure steps into the correct sequence', () => {
    const order = topologicalSortSteps(mockNodes, mockEdges);
    expect(order).toEqual(['step-ll', 'step-slot', 'step-test', 'step-dl']);
  });

  it('builds an active plan with status transitions when completed steps are provided', () => {
    const plan = buildCivicProcedurePlan({
      goalId: 'DRIVING_LICENCE',
      procedureCatalog: mockNodes,
      dependencyEdges: mockEdges,
      evidenceCorpus: mockEvidence,
      applicantContext: {
        completedSteps: ['step-ll'],
      },
    });

    expect(plan.planStatus).toBe('ACTIVE');
    expect(plan.orderedSteps.length).toBe(4);

    const stepLL = plan.orderedSteps.find((s) => s.id === 'step-ll');
    expect(stepLL.status).toBe(STEP_STATUS.COMPLETED);

    const stepSlot = plan.orderedSteps.find((s) => s.id === 'step-slot');
    expect(stepSlot.status).toBe(STEP_STATUS.READY);

    const stepTest = plan.orderedSteps.find((s) => s.id === 'step-test');
    expect(stepTest.status).toBe(STEP_STATUS.BLOCKED);
  });

  it('flags UNRESOLVED status when a mandatory edge lacks statutory backing', () => {
    const brokenEdges = [
      ...mockEdges,
      {
        prerequisiteId: 'unbacked-prereq',
        targetStepId: 'step-dl',
        type: DEPENDENCY_TYPE.MANDATORY,
        keyword: 'nonexistent-token-xyz',
      },
    ];

    const plan = buildCivicProcedurePlan({
      goalId: 'DRIVING_LICENCE',
      procedureCatalog: mockNodes,
      dependencyEdges: brokenEdges,
      evidenceCorpus: mockEvidence,
      applicantContext: {},
    });

    expect(plan.planStatus).toBe('UNRESOLVED_DEPENDENCIES');
    expect(plan.unresolvedDependencies.length).toBe(1);
    const stepDL = plan.orderedSteps.find((s) => s.id === 'step-dl');
    expect(stepDL.status).toBe(STEP_STATUS.UNRESOLVED);
  });

  it('evaluates graph metrics measuring dependency precision and unsupported-edge rate', () => {
    const mixedEdges = [
      ...mockEdges,
      {
        prerequisiteId: 'unbacked-1',
        targetStepId: 'step-dl',
        type: DEPENDENCY_TYPE.MANDATORY,
        keyword: 'bogus-rule',
      },
    ];

    const quality = evaluatePlanGraphQuality(mixedEdges, mockEvidence, 'ALL_INDIA');
    expect(quality.totalEdges).toBe(4);
    expect(quality.supportedEdges).toBe(3);
    expect(quality.precision).toBe(0.75);
    expect(quality.unsupportedEdgeRate).toBe(0.25);
  });
});
