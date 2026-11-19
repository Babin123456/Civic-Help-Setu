/**
 * Sampling Quality and Response-Bias Diagnostics Service (#767)
 * Implements bounded, deterministic sampling diagnostics: coverage,
 * missingness, demographic imbalance, and explainable recommendations.
 */

import { DEFAULT_K_ANONYMITY_THRESHOLD, maskSmallDemographicSubgroups } from '../data/surveyContract.js';

export const RULESET_VERSION = 'v1.0.0-sampling-diagnostics';

export const STATISTICAL_DISCLAIMER =
  'Demographic imbalance diagnostics only evaluate voluntary self-reported strata and do not guarantee probabilistic census representativeness. All calculations are bounded and deterministic.';

/**
 * Calculates core sampling quality metrics
 */
export const calculateQualityMetrics = (survey, responses = []) => {
  const totalResponses = responses.length;
  const targetQuota = survey?.samplingTarget?.totalTarget || 100;
  const targetProgressPct = Math.min(100, Math.round((totalResponses / targetQuota) * 100));

  const activeVersion =
    survey?.versions?.find((v) => v.id === survey.activeVersionId) ||
    survey?.versions?.[0] || { questions: [] };

  const questions = activeVersion.questions || [];

  // 1. Missingness Breakdown (Item Non-Response)
  const missingness = questions.map((q) => {
    let missingCount = 0;
    responses.forEach((r) => {
      const val = r.answers?.[q.id];
      if (val === undefined || val === null || val === '') {
        missingCount += 1;
      }
    });

    const missingPct = totalResponses > 0 ? Math.round((missingCount / totalResponses) * 100) : 0;
    return {
      questionId: q.id,
      variableName: q.variableName || q.id,
      prompt: q.prompt,
      required: Boolean(q.required),
      missingCount,
      missingPct,
    };
  });

  // Overall survey completion rate (completed all required fields)
  let completeCount = 0;
  responses.forEach((r) => {
    const isComplete = questions.every((q) => {
      if (!q.required) return true;
      const val = r.answers?.[q.id];
      return val !== undefined && val !== null && val !== '';
    });
    if (isComplete) completeCount += 1;
  });

  const completionRatePct = totalResponses > 0 ? Math.round((completeCount / totalResponses) * 100) : 0;

  // 2. Voluntary Stratum Coverage & Demographic Imbalance
  const targetStrata = survey?.samplingTarget?.strata || [];
  const stratumCoverage = targetStrata.map((stratum) => {
    let actualCount = 0;

    // Check if responses voluntarily provided matching key
    responses.forEach((r) => {
      const answers = r.answers || {};
      // Find answer that matches stratumKey or option value/label
      for (const val of Object.values(answers)) {
        if (
          val === stratum.label ||
          val === stratum.stratumKey ||
          (typeof val === 'string' && val.toLowerCase().includes(stratum.label.toLowerCase()))
        ) {
          actualCount += 1;
          break;
        }
      }
    });

    const actualPercent = totalResponses > 0 ? Math.round((actualCount / totalResponses) * 100) : 0;
    const deviation = actualPercent - (stratum.targetPercent || 0);

    return {
      stratumKey: stratum.stratumKey,
      label: stratum.label,
      targetPercent: stratum.targetPercent || 0,
      actualCount,
      actualPercent,
      deviation,
      shortfall: Math.max(0, (stratum.minCount || 0) - actualCount),
    };
  });

  // Small group k-anonymity distribution
  const rawSubgroupCounts = {};
  stratumCoverage.forEach((s) => {
    rawSubgroupCounts[s.label] = s.actualCount;
  });
  const maskedSubgroups = maskSmallDemographicSubgroups(
    rawSubgroupCounts,
    survey?.samplingTarget?.minimumSubgroupThreshold || DEFAULT_K_ANONYMITY_THRESHOLD
  );

  return {
    totalResponses,
    targetQuota,
    targetProgressPct,
    completionRatePct,
    missingness,
    stratumCoverage,
    maskedSubgroups,
  };
};

/**
 * Generates explainable, ruleset-versioned recommendations
 */
export const generateRecommendations = (metrics, survey) => {
  const recommendations = [];
  const now = new Date().toISOString();

  // Rule 1: High missingness on specific question
  const highDropQuestions = metrics.missingness.filter((m) => m.missingPct >= 30);
  highDropQuestions.forEach((m) => {
    recommendations.push({
      id: `rec_drop_${m.questionId}_${Date.now()}`,
      type: 'QUESTION_OPTIMIZATION',
      severity: 'warning',
      title: `High Item Non-Response on '${m.variableName}'`,
      message: `Question '${m.prompt}' has a ${m.missingPct}% non-response rate (${m.missingCount} respondents skipped it).`,
      rationale:
        'A skip rate of 30% or higher signals potential question ambiguity, excessive length, or sensitivity discomfort for citizens.',
      influencingFields: [`missingness.${m.questionId}.missingPct (${m.missingPct}%)`],
      rulesetVersion: RULESET_VERSION,
      generatedAt: now,
      humanDecision: 'pending',
      reviewNotes: '',
    });
  });

  // Rule 2: Severe under-representation on voluntary demographic stratum
  const underrepresentedStrata = metrics.stratumCoverage.filter((s) => s.deviation <= -15);
  underrepresentedStrata.forEach((s) => {
    recommendations.push({
      id: `rec_stratum_${s.stratumKey}_${Date.now()}`,
      type: 'SAMPLING_OUTREACH',
      severity: 'warning',
      title: `Demographic Imbalance: '${s.label}' Under-Represented`,
      message: `Responses from '${s.label}' constitute only ${s.actualPercent}% of total submissions versus target of ${s.targetPercent}% (${s.shortfall} responses short of minimum quota).`,
      rationale:
        'A negative deviation of 15% or greater indicates potential access barriers, language hurdles, or channel skew in current collection outreach.',
      influencingFields: [
        `stratumCoverage.${s.stratumKey}.actualPercent (${s.actualPercent}%)`,
        `stratumCoverage.${s.stratumKey}.targetPercent (${s.targetPercent}%)`,
      ],
      rulesetVersion: RULESET_VERSION,
      generatedAt: now,
      humanDecision: 'pending',
      reviewNotes: '',
    });
  });

  // Rule 3: Low overall progress alert
  if (metrics.totalResponses < 30 || metrics.targetProgressPct < 20) {
    recommendations.push({
      id: `rec_sample_size_${Date.now()}`,
      type: 'SAMPLE_SIZE_CAUTION',
      severity: 'info',
      title: 'Preliminary Sample Size Caution',
      message: `Current sample count (${metrics.totalResponses}/${metrics.targetQuota}, ${metrics.targetProgressPct}%) is in early collection stage.`,
      rationale:
        'Small samples exhibit high variance. Avoid making binding policy adjustments before reaching at least 50% of the target quota.',
      influencingFields: [`totalResponses (${metrics.totalResponses})`, `targetQuota (${metrics.targetQuota})`],
      rulesetVersion: RULESET_VERSION,
      generatedAt: now,
      humanDecision: 'pending',
      reviewNotes: '',
    });
  }

  return recommendations;
};

/**
 * Builds the complete Quality and Response-Bias Report
 */
export const generateFullQualityReport = (survey, responses = []) => {
  const metrics = calculateQualityMetrics(survey, responses);
  const recommendations = generateRecommendations(metrics, survey);

  return {
    surveyId: survey?.id,
    calculatedAt: new Date().toISOString(),
    rulesetVersion: RULESET_VERSION,
    disclaimer: STATISTICAL_DISCLAIMER,
    metrics,
    recommendations,
  };
};

/**
 * Updates human review decision for an automated recommendation
 */
export const updateRecommendationDecision = (report, recommendationId, decision, reviewNotes = '') => {
  if (!report || !Array.isArray(report.recommendations)) {
    throw new Error('Valid report with recommendations array is required');
  }

  if (!['accepted', 'rejected', 'pending'].includes(decision)) {
    throw new Error(`Invalid decision: ${decision}. Must be 'accepted', 'rejected', or 'pending'`);
  }

  const rec = report.recommendations.find((r) => r.id === recommendationId);
  if (!rec) {
    throw new Error(`Recommendation ${recommendationId} not found in report`);
  }

  rec.humanDecision = decision;
  rec.reviewNotes = reviewNotes;
  rec.decidedAt = new Date().toISOString();

  return report;
};

