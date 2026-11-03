/**
 * catalogueConflictDetectorService.js
 *
 * Scans civic service catalogue records for internal contradictions between
 * sections (fee table vs description, eligibility vs documents checklist)
 * and detects cross-jurisdictional disparities across similar schemes.
 *
 * Safety & Governance:
 * - Admin-facing diagnostic only.
 * - Never mutates catalogue records automatically.
 * - Supports dismissal and review tracking via dedicated local storage keys.
 */

export const CONFLICT_TYPES = {
  FEE_CONTRADICTION: 'FEE_CONTRADICTION',
  DOCUMENT_CONTRADICTION: 'DOCUMENT_CONTRADICTION',
  ELIGIBILITY_CONTRADICTION: 'ELIGIBILITY_CONTRADICTION',
  CROSS_JURISDICTION_DISPARITY: 'CROSS_JURISDICTION_DISPARITY',
};

export const DISMISSED_CONFLICTS_KEY = 'civicbridge_dismissed_catalogue_conflicts';

/**
 * Retrieves dismissed conflict IDs from local storage.
 */
export function getDismissedConflictIds() {
  try {
    const raw = localStorage.getItem(DISMISSED_CONFLICTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Marks a conflict finding as dismissed by administrator.
 */
export function dismissConflict(conflictId) {
  try {
    const current = getDismissedConflictIds();
    if (!current.includes(conflictId)) {
      current.push(conflictId);
      localStorage.setItem(DISMISSED_CONFLICTS_KEY, JSON.stringify(current));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Restores a previously dismissed conflict finding.
 */
export function restoreConflict(conflictId) {
  try {
    const current = getDismissedConflictIds();
    const updated = current.filter((id) => id !== conflictId);
    localStorage.setItem(DISMISSED_CONFLICTS_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets all dismissed conflict findings.
 */
export function resetDismissedConflicts() {
  try {
    localStorage.removeItem(DISMISSED_CONFLICTS_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluates a single service catalogue record for internal contradictions.
 *
 * @param {Object} service - Service record from catalogue
 * @param {Array<Object>} [allServices=[]] - Entire catalogue for cross-jurisdiction checks
 * @returns {Array<Object>} List of detected conflicts
 */
export function scanServiceForContradictions(service, allServices = []) {
  if (!service || typeof service !== 'object') return [];

  const conflicts = [];
  const sId = service.id || 'unknown';
  const name = service.title || service.name || service.serviceName || 'Unnamed Service';

  const desc = String(service.description || '').toLowerCase();
  const notes = String(service.notes || '').toLowerCase();
  const feeStr = String(service.fees || service.fee || '').toLowerCase();
  const eligibility = Array.isArray(service.eligibility)
    ? service.eligibility
    : typeof service.eligibility === 'string'
      ? [service.eligibility]
      : [];
  const documents = Array.isArray(service.documents)
    ? service.documents
    : [];

  const combinedNarrative = `${desc} ${notes}`;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. FEE CONTRADICTION
  // ──────────────────────────────────────────────────────────────────────────
  const claimsFree =
    combinedNarrative.includes('free of cost') ||
    combinedNarrative.includes('zero fee') ||
    combinedNarrative.includes('no charges') ||
    combinedNarrative.includes('free service') ||
    combinedNarrative.includes('gratis');

  const hasSpecificFeeAmount =
    /\b(rs\.?|₹|\binr)\s*\d+/i.test(feeStr) ||
    (typeof service.feeAmount === 'number' && service.feeAmount > 0);

  if (claimsFree && hasSpecificFeeAmount) {
    conflicts.push({
      id: `${sId}_fee_contradiction`,
      serviceId: sId,
      serviceName: name,
      serviceTitle: name,
      type: CONFLICT_TYPES.FEE_CONTRADICTION,
      severity: 'HIGH',
      confidence: 95,
      fieldA: 'description / notes',
      valueA: 'Claims service is "Free of cost / Zero charges"',
      fieldB: 'fees',
      valueB: service.fees || `₹${service.feeAmount}`,
      explanation:
        'The overview narrative explicitly tells citizens the service is free of cost, but the fee schedule specifies a mandatory government charge. This causes confusion at payment gateways or counter desks.',
      recommendedAction:
        'Verify with current government gazette whether statutory application fees have been abolished or if nominal charges still apply.',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. DOCUMENT CONTRADICTION
  // ──────────────────────────────────────────────────────────────────────────
  const claimsZeroDocs =
    combinedNarrative.includes('no documents required') ||
    combinedNarrative.includes('zero documentation') ||
    combinedNarrative.includes('zero paperwork') ||
    combinedNarrative.includes('no paperwork') ||
    combinedNarrative.includes('no paperwork needed') ||
    eligibility.some((e) => /no\s+(identity|id|document)\s+required/i.test(String(e)));

  if (claimsZeroDocs && documents.length > 0) {
    conflicts.push({
      id: `${sId}_doc_contradiction`,
      serviceId: sId,
      serviceName: name,
      serviceTitle: name,
      type: CONFLICT_TYPES.DOCUMENT_CONTRADICTION,
      severity: 'HIGH',
      confidence: 90,
      fieldA: 'description / eligibility',
      valueA: 'Claims "No documents / zero paperwork required"',
      fieldB: 'documents list',
      valueB: `${documents.length} document(s) listed (${documents.slice(0, 2).map((d) => (typeof d === 'string' ? d : d.name)).join(', ')})`,
      explanation:
        'The catalogue states that zero documentation is needed, yet the required documents checklist specifies mandatory attachments. Applicants risk rejection at submission.',
      recommendedAction:
        'Harmonize the documents checklist. If faceless Aadhaar authentication eliminates paperwork, clarify that physical paperwork is waived only for online e-KYC.',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ELIGIBILITY CONTRADICTION
  // ──────────────────────────────────────────────────────────────────────────
  const claimsUniversal =
    combinedNarrative.includes('open to all citizens') ||
    combinedNarrative.includes('universal entitlement') ||
    combinedNarrative.includes('all residents eligible') ||
    combinedNarrative.includes('no income criteria');

  const hasRestrictiveIncomeCriteria = eligibility.some((c) =>
    /bpl|below poverty|income\s+(below|less than|ceiling)|creamy layer/i.test(String(c))
  );

  if (claimsUniversal && hasRestrictiveIncomeCriteria) {
    conflicts.push({
      id: `${sId}_eligibility_contradiction`,
      serviceId: sId,
      serviceName: name,
      serviceTitle: name,
      type: CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION,
      severity: 'MEDIUM',
      confidence: 85,
      fieldA: 'description',
      valueA: 'States "Universal entitlement open to all citizens"',
      fieldB: 'eligibility criteria',
      valueB: eligibility.find((c) => /bpl|income/i.test(String(c))) || 'Income restrictions',
      explanation:
        'The narrative advertises universal citizen coverage, but the structured eligibility criteria enforce strict income caps or Below Poverty Line (BPL) restrictions.',
      recommendedAction:
        'Clarify whether universal access applies only to registration, with financial subsidies restricted to means-tested households.',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CROSS-JURISDICTION DISPARITY
  // ──────────────────────────────────────────────────────────────────────────
  if (allServices.length > 0 && service.category) {
    const peers = allServices.filter(
      (s) => s.id !== service.id && s.category === service.category && s.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
    );

    peers.forEach((peer) => {
      const peerFee = Number(peer.feeAmount) || (parseInt(peer.fees, 10) || 0);
      const myFee = Number(service.feeAmount) || (parseInt(service.fees, 10) || 0);

      if (peerFee > 0 && myFee > 0 && (myFee >= peerFee * 5 || peerFee >= myFee * 5)) {
        conflicts.push({
          id: `${sId}_cross_disparity_${peer.id}`,
          serviceId: sId,
          serviceName: name,
      serviceTitle: name,
          type: CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY,
          severity: 'LOW',
          confidence: 70,
          fieldA: `fees (${service.state || 'Local'})`,
          valueA: `₹${myFee}`,
          fieldB: `fees in ${peer.name} (${peer.state || 'State'})`,
          valueB: `₹${peerFee}`,
          explanation: `Statutory fee for ${name} differs by more than 5x compared to similar scheme "${peer.name}". Confirm if local state amendment applies.`,
          recommendedAction: 'Verify if local state gazette notification justifies the fee disparity.',
        });
      }
    });
  }

  return conflicts;
}

/**
 * Scans entire catalogue and returns structured conflict report.
 *
 * @param {Array<Object>} [catalog=[]] - Full catalogue list
 * @returns {Object} Comprehensive scan audit report
 */
export function scanCatalogueForContradictions(catalog = []) {
  const items = Array.isArray(catalog) ? catalog : [];
  const dismissed = getDismissedConflictIds();

  const allFindings = [];

  items.forEach((service) => {
    const serviceConflicts = scanServiceForContradictions(service, items);
    allFindings.push(...serviceConflicts);
  });

  const activeFindings = allFindings.filter((f) => !dismissed.includes(f.id));
  const dismissedFindings = allFindings.filter((f) => dismissed.includes(f.id));

  // Breakdown by type
  const countsByType = {
    [CONFLICT_TYPES.FEE_CONTRADICTION]: activeFindings.filter((f) => f.type === CONFLICT_TYPES.FEE_CONTRADICTION).length,
    [CONFLICT_TYPES.DOCUMENT_CONTRADICTION]: activeFindings.filter((f) => f.type === CONFLICT_TYPES.DOCUMENT_CONTRADICTION).length,
    [CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION]: activeFindings.filter((f) => f.type === CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION).length,
    [CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY]: activeFindings.filter((f) => f.type === CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY).length,
  };

  return {
    totalScanned: items.length,
    totalFindingsCount: allFindings.length,
    activeFindingsCount: activeFindings.length,
    dismissedCount: dismissedFindings.length,
    countsByType,
    activeFindings,
    dismissedFindings,
  };
}

/**
 * Convenience alias for scanning conflicts across a catalogue.
 * Returns an array of conflict items.
 *
 * @param {Array<Object>} catalog
 * @param {Object} [options={}]
 * @returns {Array<Object>}
 */
export function detectCatalogueConflicts(catalog = [], options = {}) {
  const report = scanCatalogueForContradictions(catalog);
  if (options.includeDismissed) {
    return [...report.activeFindings, ...report.dismissedFindings];
  }
  return report.activeFindings;
}
