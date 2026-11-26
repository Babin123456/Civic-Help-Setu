/**
 * Synchronous query service for the differential-privacy ward analytics UI/API.
 * Keeps raw report counts internal and returns only noisy, thresholded aggregates.
 */
import {
  CIVIC_ISSUE_CATEGORIES,
  PRIVACY_LIMITS,
  SCHEMA_VERSION,
  validateAnalyticsQuery,
} from '../data/wardAnalyticsContract';
import {
  applyLaplaceMechanism,
  compute95ConfidenceInterval,
  suppressSparseCell,
} from './differentialPrivacyEngine';
import {
  allocateQueryBudget,
  cacheQueryResult,
  getClientBudgetStatus,
} from './privacyBudgetService';
import { filterReportsByWindow, getCivicReports } from './wardIssueHeatmapStorage';

export const fetchDifferentiallyPrivateWardAnalytics = (params = {}) => {
  const validation = validateAnalyticsQuery(params);
  if (!validation.valid) {
    return {
      success: false,
      error: 'INVALID_QUERY_PARAMS',
      message: validation.errors.join(' '),
      errors: validation.errors,
    };
  }

  const epsilon = params.epsilon === undefined || params.epsilon === null
    ? PRIVACY_LIMITS.DEFAULT_EPSILON
    : Number(params.epsilon);
  const sparseThreshold = params.sparseThreshold === undefined || params.sparseThreshold === null
    ? PRIVACY_LIMITS.DEFAULT_SPARSE_THRESHOLD
    : Number(params.sparseThreshold);
  const timeWindow = params.timeWindow || '30d';
  const clientId = params.clientId || 'anonymous';
  const queryKey = JSON.stringify({
    wardId: params.wardId || '',
    category: params.category || '',
    timeWindow,
    epsilon,
    sparseThreshold,
  });

  const allocation = allocateQueryBudget({ clientId, epsilon, queryKey });
  if (!allocation.allowed) {
    return {
      success: false,
      error: allocation.error || 'BUDGET_EXHAUSTED',
      message: allocation.message || 'Privacy budget exhausted.',
      retryAfterSeconds: allocation.retryAfterSeconds,
      budgetStatus: {
        totalBudget: allocation.totalBudget,
        consumedBudget: allocation.consumedBudget,
        remainingBudget: allocation.remainingBudget,
        isExhausted: allocation.isExhausted,
      },
    };
  }
  if (allocation.isCached && allocation.cachedResult) return allocation.cachedResult;

  try {
    const reports = filterReportsByWindow(getCivicReports(), timeWindow);
    const filtered = reports.filter((report) =>
      (!params.wardId || report.wardId === params.wardId) &&
      (!params.category || report.category === params.category)
    );

    const wardIds = params.wardId
      ? [params.wardId]
      : [...new Set(filtered.map((report) => report.wardId))].sort();
    const categories = params.category
      ? [params.category]
      : Object.keys(CIVIC_ISSUE_CATEGORIES);

    const data = [];
    let suppressedCells = 0;
    for (const wardId of wardIds) {
      for (const category of categories) {
        const rawCount = filtered.reduce(
          (count, report) => count + (report.wardId === wardId && report.category === category ? 1 : 0),
          0
        );
        const noisyCount = applyLaplaceMechanism(rawCount, epsilon);
        const cell = suppressSparseCell(rawCount, noisyCount, sparseThreshold);
        if (cell.isSuppressed) suppressedCells += 1;
        data.push({
          wardId,
          category,
          publishedCount: cell.publishedCount,
          isSuppressed: cell.isSuppressed,
        });
      }
    }

    const confidenceInterval95 = compute95ConfidenceInterval(epsilon);
    const result = {
      success: true,
      schemaVersion: SCHEMA_VERSION,
      data,
      budgetStatus: {
        totalBudget: allocation.totalBudget,
        consumedBudget: allocation.consumedBudget,
        remainingBudget: allocation.remainingBudget,
        isExhausted: allocation.isExhausted,
      },
      privacyMetadata: {
        appliedEpsilon: epsilon,
        sparseThreshold,
        suppressedCells,
        confidenceInterval95,
      },
    };
    cacheQueryResult(clientId, queryKey, result);
    return result;
  } catch (error) {
    return {
      success: false,
      error: 'ANALYTICS_QUERY_FAILED',
      message: error?.message || 'Unable to compute ward analytics.',
      budgetStatus: getClientBudgetStatus(clientId),
    };
  }
};
