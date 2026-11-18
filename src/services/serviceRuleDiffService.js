/**
 * Citizen-Facing Service Rule Change Visual Diff with Saved-Checklist Impact Service
 * 
 * Implements deterministic semantic version diffing between service rules:
 * - Detects ADDED, REMOVED, and MODIFIED requirement groups (documents, fees, deadlines, steps)
 * - Evaluates direct impact badges on citizen's private saved service checklists
 * - Cites official gazette order / circular for every changed rule
 * - Tracks citizen acknowledgment / dismissal of rule change alerts
 * - Prohibits AI hallucination or retroactive legal assumptions
 */

export const RULE_CHANGE_TYPES = {
  ADDED: 'ADDED',
  REMOVED: 'REMOVED',
  MODIFIED: 'MODIFIED',
  UNCHANGED: 'UNCHANGED'
};

export const SERVICE_VERSION_ROLLBACK_PROCEDURE = [
  'Never mutate or overwrite historical version records in the database.',
  'To roll back an errant policy revision, publish a new incremented version (e.g., v3.0) restoring v1.0 specifications with a reference to the superseding cancellation circular.'
];

/**
 * Returns canonical version rollback guidelines.
 * @returns {Array<string>}
 */
export function getVersionRollbackGuidelines() {
  return SERVICE_VERSION_ROLLBACK_PROCEDURE;
}

export const RETROACTIVE_LEGAL_EFFECT_SAFEGUARD = {
  rule: 'PROHIBIT_RETROACTIVE_APPLICATION',
  legalNotice: 'Under standard administrative jurisprudence, revised service fees and prerequisites apply prospectively from the date of official gazette publication unless explicitly stated otherwise by state statute.'
};

/**
 * Returns retroactive policy enforcement constraints.
 * @returns {Object}
 */
export function getRetroactiveSafeguardPolicy() {
  return RETROACTIVE_LEGAL_EFFECT_SAFEGUARD;
}

export const RULE_CATEGORIES = {
  DOCUMENT: 'DOCUMENT',
  FEE: 'FEE',
  DEADLINE_SLA: 'DEADLINE_SLA',
  ELIGIBILITY: 'ELIGIBILITY'
};

/**
 * Computes deterministic diff between previous and newly published service rules.
 * @param {Object} previousVersion 
 * @param {Object} currentVersion 
 * @returns {Object} diffReport
 */
export function computeServiceRuleDiff(previousVersion = {}, currentVersion = {}) {
  const prevRules = previousVersion.rules || [];
  const currRules = currentVersion.rules || [];

  const prevMap = new Map(prevRules.map(r => [r.ruleId, r]));
  const currMap = new Map(currRules.map(r => [r.ruleId, r]));

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  // Check current against previous
  currRules.forEach(curr => {
    if (!prevMap.has(curr.ruleId)) {
      added.push({ ...curr, changeType: RULE_CHANGE_TYPES.ADDED });
    } else {
      const prev = prevMap.get(curr.ruleId);
      if (JSON.stringify(prev.value) !== JSON.stringify(curr.value)) {
        modified.push({
          ruleId: curr.ruleId,
          category: curr.category,
          title: curr.title,
          previousValue: prev.value,
          currentValue: curr.value,
          officialGazetteRef: curr.officialGazetteRef || currentVersion.officialGazetteRef,
          changeType: RULE_CHANGE_TYPES.MODIFIED
        });
      } else {
        unchanged.push(curr);
      }
    }
  });

  // Check for removed rules
  prevRules.forEach(prev => {
    if (!currMap.has(prev.ruleId)) {
      removed.push({ ...prev, changeType: RULE_CHANGE_TYPES.REMOVED });
    }
  });

  return {
    serviceId: currentVersion.serviceId,
    previousVersionId: previousVersion.versionId || 'v1.0',
    currentVersionId: currentVersion.versionId || 'v2.0',
    publishedDate: currentVersion.publishedDate || new Date().toISOString(),
    officialGazetteRef: currentVersion.officialGazetteRef || 'Gazette Notification',
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: unchanged.length
    },
    added,
    removed,
    modified,
    unchanged
  };
}

/**
 * Maps rule changes to a citizen's saved checklist and tags impact badges.
 * @param {Object} diffReport 
 * @param {Array<Object>} savedChecklistItems 
 * @returns {Array<Object>} impactedChecklist
 */
export function mapDiffToSavedChecklist(diffReport = {}, savedChecklistItems = []) {
  const modifiedMap = new Map((diffReport.modified || []).map(m => [m.ruleId, m]));
  const removedSet = new Set((diffReport.removed || []).map(r => r.ruleId));

  return savedChecklistItems.map(item => {
    if (removedSet.has(item.ruleId)) {
      return {
        ...item,
        impactBadge: 'RULE_REMOVED',
        impactDescription: 'This requirement has been abolished by recent government circular. You no longer need to submit this proof.'
      };
    }

    if (modifiedMap.has(item.ruleId)) {
      const mod = modifiedMap.get(item.ruleId);
      return {
        ...item,
        impactBadge: 'REQUIREMENT_MODIFIED',
        impactDescription: `Rule amended from [${JSON.stringify(mod.previousValue)}] to [${JSON.stringify(mod.currentValue)}]. Please re-verify.`,
        gazetteSource: mod.officialGazetteRef
      };
    }

    return {
      ...item,
      impactBadge: 'NO_CHANGE',
      impactDescription: 'Requirement remains active and unchanged under new version.'
    };
  });
}

/**
 * Records citizen acknowledgment of an in-app service rule change notice.
 * @param {string} citizenId 
 * @param {string} serviceId 
 * @param {string} versionId 
 * @returns {Object} ackRecord
 */
export function acknowledgeRuleChange(citizenId, serviceId, versionId) {
  return {
    ackId: 'ack_' + Math.random().toString(36).substring(2, 9),
    citizenId,
    serviceId,
    acknowledgedVersion: versionId,
    acknowledgedAt: new Date().toISOString(),
    status: 'DISMISSED'
  };
}

/**
 * Exports service rule change visual diff in markdown format.
 * @param {Object} diffReport 
 * @param {Array<Object>} impactedChecklist 
 * @returns {string} markdown
 */
export function exportRuleDiffSummary(diffReport = {}, impactedChecklist = []) {
  return [
    `# Service Rule Change & Checklist Impact Report`,
    `**Service:** ${diffReport.serviceId || 'Civic Service'}`,
    `**Version Transition:** ${diffReport.previousVersionId} ➔ **${diffReport.currentVersionId}**`,
    `**Legal Authority / Gazette:** ${diffReport.officialGazetteRef}`,
    `**Date Effective:** ${diffReport.publishedDate ? diffReport.publishedDate.split('T')[0] : 'Current'}`,
    ``,
    `## Summary of Amendments`,
    `- **New Requirements Added:** ${diffReport.summary?.addedCount || 0}`,
    `- **Requirements Modified:** ${diffReport.summary?.modifiedCount || 0}`,
    `- **Obsolete Rules Removed:** ${diffReport.summary?.removedCount || 0}`,
    ``,
    `## Modified Rules Detail`,
    ...(diffReport.modified?.length > 0
      ? diffReport.modified.map(
          m => `- **${m.title}**\n  *Old:* ${JSON.stringify(m.previousValue)}\n  *New:* ${JSON.stringify(m.currentValue)}\n  *Source:* ${m.officialGazetteRef}`
        )
      : ['No existing rules modified.']),
    ``,
    `## Saved Checklist Impact Badges`,
    ...(impactedChecklist.length > 0
      ? impactedChecklist.map(
          i => `- **${i.title || i.ruleId}:** \`[${i.impactBadge}]\` — ${i.impactDescription}`
        )
      : ['No active saved checklist items linked.']),
    ``,
    `---`,
    `*Notice: Changes reflect published executive circulars. Always check official gazettes for legal citations.*`
  ].join('\n');
}
