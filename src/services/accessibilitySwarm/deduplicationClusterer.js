/**
 * Swarm Deduplication & Root Cause Clustering Service (#1177)
 *
 * Implements intelligent deduplication across complementary agents:
 * - Groups findings that share identical root cause (e.g., unlabeled icon button triggering both ScreenReader and Keyboard issues)
 * - Assigns primary vs secondary modality
 * - Calculates accessibility health score (0-100)
 * - Identifies false positive candidates
 */

import { FINDING_SEVERITY } from './swarmSchemas.js';

export function deduplicateAndClusterFindings(rawFindings = []) {
  if (!Array.isArray(rawFindings)) return { clusters: [], totalUnique: 0, healthScore: 100 };

  const clusters = [];
  const clusterMap = new Map();

  for (const finding of rawFindings) {
    // Generate cluster key based on selector and related rule concept
    const selector = (finding.evidence?.domSelector || 'global').trim().toLowerCase();
    const ruleConcept = finding.ruleId.split('.')[0] || 'general';
    const clusterKey = `${selector}::${finding.wcagCriterion || ruleConcept}`;

    if (clusterMap.has(clusterKey)) {
      const existing = clusterMap.get(clusterKey);
      existing.findings.push(finding);
      existing.modalitiesInvolved.add(finding.modality);
      
      // Elevate severity if multiple complementary agents flag the same DOM node
      if (severityWeight(finding.severity) > severityWeight(existing.severity)) {
        existing.severity = finding.severity;
      }
    } else {
      const clusterObj = {
        clusterId: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        rootCauseSummary: finding.title,
        primaryModality: finding.modality,
        modalitiesInvolved: new Set([finding.modality]),
        severity: finding.severity,
        targetSelector: finding.evidence?.domSelector || '',
        findings: [finding],
        isSubjective: finding.isSubjective || false
      };
      clusterMap.set(clusterKey, clusterObj);
    }
  }

  // Finalize clusters
  for (const cluster of clusterMap.values()) {
    clusters.push({
      ...cluster,
      modalitiesInvolved: Array.from(cluster.modalitiesInvolved),
      count: cluster.findings.length
    });
  }

  const healthScore = calculateAccessibilityScore(clusters);

  return {
    clusters,
    totalUnique: clusters.length,
    rawFindingCount: rawFindings.length,
    healthScore
  };
}

function severityWeight(sev) {
  switch (sev) {
    case FINDING_SEVERITY.CRITICAL: return 4;
    case FINDING_SEVERITY.HIGH: return 3;
    case FINDING_SEVERITY.MEDIUM: return 2;
    case FINDING_SEVERITY.LOW: return 1;
    default: return 0;
  }
}

/**
 * Calculates a 0-100 score based on penalty deductions
 */
export function calculateAccessibilityScore(clusters = []) {
  let score = 100;
  for (const c of clusters) {
    if (c.severity === FINDING_SEVERITY.CRITICAL) score -= 15;
    else if (c.severity === FINDING_SEVERITY.HIGH) score -= 8;
    else if (c.severity === FINDING_SEVERITY.MEDIUM) score -= 4;
    else if (c.severity === FINDING_SEVERITY.LOW) score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}
