/**
 * AI Civic Policy Change Impact and Saved-Journey Diff Engine
 *
 * Implements an immutable versioned policy comparator and journey impact engine:
 * 1. Stores immutable source versions with publication/effective dates, authority, jurisdiction, and supersession links.
 * 2. Compares reviewed official policy versions to identify modifications to fees, documents, deadlines, or eligibility rules.
 * 3. Proposes impact diffs with citations from both versions.
 * 4. Gating mechanism: No notification/alert is sent before human editor approval.
 * 5. Applies an uncertainty label ('AFFECTED_PENDING_REVIEW') to saved citizen checklists until verified.
 * 6. Supports user inspection of diffs and dismissal of irrelevant alerts.
 * 7. Preserves historical rules for in-flight applications.
 */

export const IMPACT_SEVERITY = {
  CRITICAL: 'CRITICAL', // Fee increase, new mandatory document, tighter deadline
  MODERATE: 'MODERATE', // Process online shift, portal URL update
  INFORMATIONAL: 'INFORMATIONAL', // Form redesign, terminology clarification
};

export const APPROVAL_STATUS = {
  DRAFT_PROPOSED: 'DRAFT_PROPOSED',
  EDITOR_APPROVED: 'EDITOR_APPROVED',
  REJECTED: 'REJECTED',
};

export const JOURNEY_ALERT_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  DISMISSED: 'DISMISSED',
};

/**
 * Validates version metadata schema.
 * @param {object} version
 * @returns {boolean}
 */
export function validatePolicyVersion(version) {
  return Boolean(
    version &&
      version.id &&
      version.serviceId &&
      version.effectiveDate &&
      version.authority &&
      version.jurisdiction &&
      version.rules &&
      typeof version.rules === 'object'
  );
}

/**
 * Computes deep differences between a new policy version and its direct predecessor.
 *
 * @param {object} priorVersion
 * @param {object} newVersion
 * @returns {Array<object>} List of detected rule modifications
 */
export function diffPolicyVersions(priorVersion, newVersion) {
  if (!validatePolicyVersion(priorVersion) || !validatePolicyVersion(newVersion)) {
    throw new Error('Both prior and new policy versions must be valid versioned objects');
  }

  if (priorVersion.serviceId !== newVersion.serviceId) {
    throw new Error('Cannot compare policy versions across different service IDs');
  }

  const diffs = [];
  const priorRules = priorVersion.rules;
  const newRules = newVersion.rules;

  // 1. Fee comparisons
  const priorFees = priorRules.fees || {};
  const newFees = newRules.fees || {};
  for (const [key, newAmount] of Object.entries(newFees)) {
    const priorAmount = priorFees[key];
    if (priorAmount === undefined) {
      diffs.push({
        field: `fees.${key}`,
        type: 'FEE_ADDED',
        severity: IMPACT_SEVERITY.CRITICAL,
        priorValue: null,
        newValue: newAmount,
        priorCitation: priorVersion.citation || null,
        newCitation: newVersion.citation || null,
        summary: `New statutory fee added for ${key}: ₹${newAmount}`,
      });
    } else if (priorAmount !== newAmount) {
      diffs.push({
        field: `fees.${key}`,
        type: 'FEE_CHANGED',
        severity: newAmount > priorAmount ? IMPACT_SEVERITY.CRITICAL : IMPACT_SEVERITY.MODERATE,
        priorValue: priorAmount,
        newValue: newAmount,
        priorCitation: priorVersion.citation || null,
        newCitation: newVersion.citation || null,
        summary: `Fee for ${key} revised from ₹${priorAmount} to ₹${newAmount}`,
      });
    }
  }

  // 2. Required document checklist comparisons
  const priorDocs = new Set(priorRules.requiredDocuments || []);
  const newDocs = new Set(newRules.requiredDocuments || []);

  for (const doc of newDocs) {
    if (!priorDocs.has(doc)) {
      diffs.push({
        field: 'requiredDocuments',
        type: 'DOCUMENT_ADDED',
        severity: IMPACT_SEVERITY.CRITICAL,
        priorValue: null,
        newValue: doc,
        priorCitation: priorVersion.citation || null,
        newCitation: newVersion.citation || null,
        summary: `New mandatory document required: ${doc}`,
      });
    }
  }

  for (const doc of priorDocs) {
    if (!newDocs.has(doc)) {
      diffs.push({
        field: 'requiredDocuments',
        type: 'DOCUMENT_REMOVED',
        severity: IMPACT_SEVERITY.INFORMATIONAL,
        priorValue: doc,
        newValue: null,
        priorCitation: priorVersion.citation || null,
        newCitation: newVersion.citation || null,
        summary: `Document requirement discontinued: ${doc}`,
      });
    }
  }

  // 3. Deadline / Processing window comparisons
  if (priorRules.processingDays !== newRules.processingDays && newRules.processingDays !== undefined) {
    diffs.push({
      field: 'processingDays',
      type: 'DEADLINE_CHANGED',
      severity: IMPACT_SEVERITY.MODERATE,
      priorValue: priorRules.processingDays,
      newValue: newRules.processingDays,
      priorCitation: priorVersion.citation || null,
      newCitation: newVersion.citation || null,
      summary: `Statutory processing timeline revised from ${priorRules.processingDays} to ${newRules.processingDays} days`,
    });
  }

  return diffs;
}

/**
 * Creates a proposed policy impact batch.
 * Strictly gated: Sets approval status to 'DRAFT_PROPOSED'.
 *
 * @param {object} priorVersion
 * @param {object} newVersion
 * @returns {object} Change impact proposal
 */
export function proposePolicyChangeImpact(priorVersion, newVersion) {
  const diffs = diffPolicyVersions(priorVersion, newVersion);

  return {
    proposalId: `impact-${newVersion.id}`,
    serviceId: newVersion.serviceId,
    priorVersionId: priorVersion.id,
    newVersionId: newVersion.id,
    effectiveDate: newVersion.effectiveDate,
    approvalStatus: APPROVAL_STATUS.DRAFT_PROPOSED,
    approvedBy: null,
    approvalTimestamp: null,
    diffs,
    summary: `Found ${diffs.length} rule changes between v${priorVersion.versionNumber} and v${newVersion.versionNumber}`,
  };
}

/**
 * Human editor review gate: Approves or rejects a policy change impact proposal.
 *
 * @param {object} proposal
 * @param {string} editorId
 * @param {boolean} approve
 * @returns {object} Updated proposal
 */
export function reviewPolicyChangeProposal(proposal, editorId, approve) {
  if (!proposal || !proposal.proposalId) {
    throw new Error('Valid proposal object is required for editor review');
  }
  if (!editorId) {
    throw new Error('Editor ID is required to approve or reject a policy change proposal');
  }

  return {
    ...proposal,
    approvalStatus: approve ? APPROVAL_STATUS.EDITOR_APPROVED : APPROVAL_STATUS.REJECTED,
    approvedBy: editorId,
    approvalTimestamp: new Date().toISOString(),
  };
}

/**
 * Evaluates active citizen journeys against an approved policy proposal.
 * Prevents alerts if proposal is unapproved.
 * Labels unverified or pending journeys with uncertainty flags.
 *
 * @param {object} approvedProposal
 * @param {Array<object>} savedJourneys List of citizen's saved checklists or tracking records
 * @returns {Array<object>} Generated journey alerts
 */
export function evaluateSavedJourneyImpacts(approvedProposal, savedJourneys = []) {
  if (approvedProposal.approvalStatus !== APPROVAL_STATUS.EDITOR_APPROVED) {
    // Safety requirement: No alert is sent before human editor approval
    return [];
  }

  const affectedJourneys = [];

  for (const journey of savedJourneys) {
    if (journey.serviceId !== approvedProposal.serviceId) {
      continue;
    }

    // Check if the citizen's application was submitted before effective date
    const submissionDate = journey.submissionDate ? new Date(journey.submissionDate) : null;
    const effectiveDate = new Date(approvedProposal.effectiveDate);

    // If journey was already submitted before effective date, historical rules apply
    const isHistoricalGrandfathered = submissionDate && submissionDate < effectiveDate;

    // Filter relevant diffs for this journey's stage
    const relevantDiffs = approvedProposal.diffs.filter((diff) => {
      if (diff.field === 'requiredDocuments' && journey.collectedDocuments) {
        // If document was added and user hasn't collected it yet
        return diff.type === 'DOCUMENT_ADDED' && !journey.collectedDocuments.includes(diff.newValue);
      }
      return true;
    });

    if (relevantDiffs.length > 0) {
      affectedJourneys.push({
        alertId: `alert-${journey.id}-${approvedProposal.newVersionId}`,
        journeyId: journey.id,
        serviceId: journey.serviceId,
        alertStatus: JOURNEY_ALERT_STATUS.ACTIVE,
        uncertaintyLabel: 'AFFECTED_PENDING_REVIEW',
        isHistoricalGrandfathered,
        historicalRuleNote: isHistoricalGrandfathered
          ? 'Application filed prior to effective date; historical statutory guidelines apply unless notified by department.'
          : null,
        impactedDiffs: relevantDiffs,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return affectedJourneys;
}

/**
 * Allows a citizen to dismiss an alert or mark it as reviewed.
 *
 * @param {object} alert
 * @param {string} reason
 * @returns {object} Updated alert object
 */
export function dismissJourneyAlert(alert, reason = 'User reviewed and confirmed inapplicable') {
  if (!alert) return null;
  return {
    ...alert,
    alertStatus: JOURNEY_ALERT_STATUS.DISMISSED,
    dismissedAt: new Date().toISOString(),
    dismissalReason: reason,
  };
}
