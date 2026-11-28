export const SERVICE_TIER = Object.freeze({
  CRITICAL_JOURNEY: 'CRITICAL_JOURNEY',
  STANDARD_SERVICE: 'STANDARD_SERVICE'
});

export const FREEZE_STATE = Object.freeze({
  UNFROZEN: 'UNFROZEN',
  WARNING_FREEZE: 'WARNING_FREEZE',
  HARD_RELEASE_FREEZE: 'HARD_RELEASE_FREEZE'
});

export class ReleaseFreezeAutomationService {
  constructor(config = {}) {
    this.errorBudgetThresholdWarning = config.warningThreshold || 20.0; // 20% budget remaining
    this.errorBudgetThresholdHard = config.hardThreshold || 5.0; // 5% budget remaining
    this.journeys = new Map();
    this.freezeOverrides = new Map();
  }

  registerJourney(journeyId, targetAvailabilityPercent = 99.9) {
    this.journeys.set(journeyId, {
      journeyId,
      targetAvailabilityPercent,
      allowedErrorPercent: 100 - targetAvailabilityPercent,
      telemetry: {
        frontendFailures: 0,
        apiFailures: 0,
        dependencyFailures: 0,
        totalRequests: 0
      }
    });
  }

  recordTelemetry(journeyId, counts = {}) {
    const journey = this.journeys.get(journeyId);
    if (!journey) throw new Error(`Journey ${journeyId} not registered.`);

    journey.telemetry.frontendFailures += counts.frontendFailures || 0;
    journey.telemetry.apiFailures += counts.apiFailures || 0;
    journey.telemetry.dependencyFailures += counts.dependencyFailures || 0;
    journey.telemetry.totalRequests += counts.totalRequests || 0;
  }

  evaluateJourneyBudget(journeyId) {
    const journey = this.journeys.get(journeyId);
    if (!journey) throw new Error(`Journey ${journeyId} not registered.`);

    const { totalRequests, frontendFailures, apiFailures, dependencyFailures } = journey.telemetry;
    const totalFailures = frontendFailures + apiFailures + dependencyFailures;

    if (totalRequests === 0) {
      return {
        journeyId,
        budgetRemainingPercent: 100.0,
        freezeState: FREEZE_STATE.UNFROZEN,
        canDeploy: true
      };
    }

    const observedErrorPercent = (totalFailures / totalRequests) * 100;
    const budgetConsumedPercent = (observedErrorPercent / (journey.allowedErrorPercent || 0.001)) * 100;
    const budgetRemainingPercent = Math.max(0, 100 - budgetConsumedPercent);

    let freezeState = FREEZE_STATE.UNFROZEN;
    if (budgetRemainingPercent <= this.errorBudgetThresholdHard) {
      freezeState = FREEZE_STATE.HARD_RELEASE_FREEZE;
    } else if (budgetRemainingPercent <= this.errorBudgetThresholdWarning) {
      freezeState = FREEZE_STATE.WARNING_FREEZE;
    }

    const hasOverride = this.freezeOverrides.has(journeyId);

    return {
      journeyId,
      totalRequests,
      totalFailures,
      failureBreakdown: { frontendFailures, apiFailures, dependencyFailures },
      budgetRemainingPercent: Number(budgetRemainingPercent.toFixed(2)),
      freezeState,
      canDeploy: freezeState !== FREEZE_STATE.HARD_RELEASE_FREEZE || hasOverride,
      isOverridden: hasOverride
    };
  }

  requestReleaseOverride(journeyId, approverName, justification) {
    if (!approverName || !justification) {
      throw new Error('Approver and justification are mandatory for production freeze overrides.');
    }

    const overrideRecord = {
      journeyId,
      approverName,
      justification,
      timestamp: new Date().toISOString()
    };

    this.freezeOverrides.set(journeyId, overrideRecord);
    return overrideRecord;
  }
}
