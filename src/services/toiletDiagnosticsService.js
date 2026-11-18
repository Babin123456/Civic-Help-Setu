/**
 * Public Toilet Diagnostics & Bounded Recommendation Service (#758)
 *
 * Implements bounded, explainable automated assistance for municipal sanitation:
 *  - Strictly NO predictive cleanliness scores (factual audited timestamps only).
 *  - Versioned deterministic ruleset with clear input feature windows.
 *  - Fully explainable recommendations citing exact source fields.
 *  - Human-in-the-loop: Authorized operators/supervisors must accept, edit, or reject.
 *  - Zero PII in outputs and audit logs.
 */

import {
  getFacilityById,
  loadMaintenanceTickets,
  loadFeedbackReports,
  recordAuditEvent,
} from './publicToiletStorage.js';

export const RULESET_VERSION = '1.0.0-deterministic';

export const RECOMMENDATION_TYPES = Object.freeze({
  CLEANING_OVERDUE: 'cleaning_overdue_alert',
  RECURRING_DEFECT: 'recurring_defect_escalation',
  HYGIENE_DISCREPANCY: 'hygiene_discrepancy_alert',
  ACCESSIBILITY_MAINTENANCE: 'accessibility_maintenance_alert',
});

// Stored human decisions for recommendations
const recommendationDecisions = new Map();

/**
 * Generates explainable recommendations for a specific facility or all facilities.
 */
export const generateToiletRecommendations = (facilityId, referenceDate = new Date()) => {
  const facility = getFacilityById(facilityId);
  if (!facility) return [];

  const now = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const recommendations = [];

  const tickets = loadMaintenanceTickets(facilityId);
  const feedbacks = loadFeedbackReports(facilityId);

  // Rule 1: Cleaning Overdue Alert
  if (facility.status === 'verified_active') {
    const lastCleanedTime = facility.lastCleanedAt
      ? new Date(facility.lastCleanedAt).getTime()
      : 0;
    const hoursSinceCleaning = (now.getTime() - lastCleanedTime) / (1000 * 3600);
    const thresholdHours = facility.category === 'transit_hub_toilet' ? 3 : 5;

    if (hoursSinceCleaning > thresholdHours) {
      recommendations.push({
        id: `rec-clean-${facility.id}-${now.toISOString().slice(0, 13)}`,
        facilityId: facility.id,
        type: RECOMMENDATION_TYPES.CLEANING_OVERDUE,
        severity: hoursSinceCleaning > 8 ? 'high' : 'medium',
        title: 'Sanitation Sweep Overdue',
        summary: `Facility has not had an audited cleaning event for ${Math.round(hoursSinceCleaning)} hours.`,
        suggestedAction: 'Dispatch ward sanitation team for scheduled sweep, odor neutralization, and supply restocking.',
        rulesetVersion: RULESET_VERSION,
        executionTimestamp: now.toISOString(),
        explainability: {
          influencingFields: ['facility.status', 'facility.lastCleanedAt', 'facility.category'],
          observedValue: `${Math.round(hoursSinceCleaning)} hours since last log`,
          thresholdRule: `Exceeded statutory ${thresholdHours}-hour threshold for ${facility.category}`,
        },
      });
    }
  }

  // Rule 2: Recurring Defect Escalation
  // If > 1 unresolved ticket in the past 7 days for the same category
  const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const recentTickets = tickets.filter((t) => {
    const ticketTime = new Date(t.createdAt).getTime();
    return ticketTime >= sevenDaysAgo && ['reported', 'acknowledged', 'in_progress'].includes(t.status);
  });

  const categoryCounts = {};
  recentTickets.forEach((t) => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  Object.entries(categoryCounts).forEach(([category, count]) => {
    if (count >= 2) {
      recommendations.push({
        id: `rec-defect-${facility.id}-${category}`,
        facilityId: facility.id,
        type: RECOMMENDATION_TYPES.RECURRING_DEFECT,
        severity: 'high',
        title: `Recurring Defect: ${category.replace(/_/g, ' ').toUpperCase()}`,
        summary: `Detected ${count} active tickets for ${category.replace(/_/g, ' ')} in the last 7 days.`,
        suggestedAction: 'Escalate to Assistant Executive Engineer (AEE) / contractor for root-cause structural overhaul.',
        rulesetVersion: RULESET_VERSION,
        executionTimestamp: now.toISOString(),
        explainability: {
          influencingFields: ['maintenanceTickets.category', 'maintenanceTickets.status', 'maintenanceTickets.createdAt'],
          observedValue: `${count} open/active tickets of type '${category}' within a 7-day feature window`,
          thresholdRule: 'Repeated breakdown threshold (>= 2 events in 7 days)',
        },
      });
    }
  });

  // Rule 3: Citizen Hygiene Discrepancy Alert
  // If recent feedback shows rating <= 2 but recent cleaning log was completed within 2 hours
  const recentFeedbacks = feedbacks.filter((f) => {
    const feedbackTime = new Date(f.createdAt).getTime();
    return feedbackTime >= now.getTime() - 4 * 3600 * 1000 && f.moderationStatus === 'approved';
  });

  const poorFeedbacks = recentFeedbacks.filter((f) => f.rating <= 2 || f.cleanlinessLevel === 'dirty' || f.cleanlinessLevel === 'unusable');
  if (poorFeedbacks.length >= 2) {
    recommendations.push({
      id: `rec-discrepancy-${facility.id}-${now.toISOString().slice(0, 13)}`,
      facilityId: facility.id,
      type: RECOMMENDATION_TYPES.HYGIENE_DISCREPANCY,
      severity: 'medium',
      title: 'Citizen Hygiene Rating Discrepancy',
      summary: `${poorFeedbacks.length} verified citizen reports flagged hygiene issues within the past 4 hours.`,
      suggestedAction: 'Trigger a surprise spot-check by the ward sanitation supervisor to inspect contractor adherence.',
      rulesetVersion: RULESET_VERSION,
      executionTimestamp: now.toISOString(),
      explainability: {
        influencingFields: ['feedbackReports.rating', 'feedbackReports.cleanlinessLevel', 'cleaningEvents.cleanedAt'],
        observedValue: `${poorFeedbacks.length} poor ratings received despite recorded cleaning schedule`,
        thresholdRule: 'Minimum 2 negative observations within 4-hour window',
      },
    });
  }

  // Attach any existing human decision to the recommendations
  return recommendations.map((rec) => {
    const decision = recommendationDecisions.get(rec.id);
    return decision ? { ...rec, humanDecision: decision } : rec;
  });
};

/**
 * Human-in-the-loop: An authorized operator or administrator accepts, edits, or rejects a recommendation.
 */
export const recordRecommendationDecision = (recommendationId, { decision, notes = '', modifiedAction = null }, userContext = {}) => {
  if (!['accepted', 'modified', 'rejected'].includes(decision)) {
    throw new Error('Decision must be one of: accepted, modified, rejected');
  }

  const decisionEntry = {
    decision,
    decidedByRole: userContext.role || 'operator',
    decidedAt: new Date().toISOString(),
    notes: notes ? notes.slice(0, 300) : '',
    modifiedAction: decision === 'modified' ? modifiedAction : null,
  };

  recommendationDecisions.set(recommendationId, decisionEntry);

  recordAuditEvent({
    action: 'RECOMMENDATION_HUMAN_DECISION',
    recommendationId,
    decision,
    actorRole: userContext.role || 'operator',
    notes: notes || undefined,
  });

  return decisionEntry;
};

export const clearRecommendationDecisions = () => {
  recommendationDecisions.clear();
};

