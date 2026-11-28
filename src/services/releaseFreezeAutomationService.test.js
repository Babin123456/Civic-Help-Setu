import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReleaseFreezeAutomationService,
  FREEZE_STATE
} from './releaseFreezeAutomationService.js';

describe('ReleaseFreezeAutomationService (#1249)', () => {
  let service;

  beforeEach(() => {
    service = new ReleaseFreezeAutomationService();
  });

  it('triggers hard release freeze when error budget is exhausted', () => {
    service.registerJourney('grievance-submission', 99.9); // 0.1% allowed failure

    // 10,000 requests, 15 failures = 0.15% error (exceeds 0.1% budget -> budget = 0%)
    service.recordTelemetry('grievance-submission', {
      totalRequests: 10000,
      apiFailures: 10,
      frontendFailures: 5
    });

    const status = service.evaluateJourneyBudget('grievance-submission');
    expect(status.budgetRemainingPercent).toBe(0);
    expect(status.freezeState).toBe(FREEZE_STATE.HARD_RELEASE_FREEZE);
    expect(status.canDeploy).toBe(false);
  });

  it('permits deployment when release freeze is overridden with recorded audit', () => {
    service.registerJourney('pension-apply', 99.9);
    service.recordTelemetry('pension-apply', {
      totalRequests: 1000,
      apiFailures: 20
    });

    service.requestReleaseOverride('pension-apply', 'SecOps Lead', 'Hotfix patch deployment');
    const status = service.evaluateJourneyBudget('pension-apply');
    expect(status.freezeState).toBe(FREEZE_STATE.HARD_RELEASE_FREEZE);
    expect(status.canDeploy).toBe(true);
    expect(status.isOverridden).toBe(true);
  });
});
