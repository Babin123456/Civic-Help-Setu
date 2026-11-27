// Domain business logic and dependency solver for Civic Moving-Home Address-Change Action Planner (#725).
// Calculates prerequisite execution order, filters records based on relocation scope,
// and evaluates overall progress and conditional inter-state/inter-district requirements.

import { VERIFIED_ADDRESS_CHANGE_RECORDS } from '../data/addressChangeRecords';

/**
 * Filters catalog records based on move type, selection, and optional search keyword.
 */
export const filterRecordsForPlan = (
  catalog = VERIFIED_ADDRESS_CHANGE_RECORDS,
  { moveType = 'same_city', selectedRecordIds = null, searchQuery = '' } = {}
) => {
  if (!Array.isArray(catalog)) return [];

  const query = typeof searchQuery === 'string' ? searchQuery.toLowerCase().trim() : '';

  return catalog.filter((record) => {
    // 1. Move type check
    if (moveType && Array.isArray(record.applicableMoveTypes)) {
      if (!record.applicableMoveTypes.includes(moveType)) return false;
    }

    // 2. Selected records check
    if (Array.isArray(selectedRecordIds) && selectedRecordIds.length > 0) {
      if (!selectedRecordIds.includes(record.id)) return false;
    }

    // 3. Search query check
    if (query) {
      const matchName = record.name?.toLowerCase().includes(query);
      const matchAuth = record.authority?.name?.toLowerCase().includes(query);
      const matchStat = record.statutoryBasis?.toLowerCase().includes(query);
      const matchProofs = record.acceptedProofs?.some((p) =>
        p.name?.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
      );
      if (!matchName && !matchAuth && !matchStat && !matchProofs) return false;
    }

    return true;
  });
};

/**
 * Sorts records in deterministic prerequisite dependency sequence.
 */
export const sortRecordsByDependency = (records) => {
  if (!Array.isArray(records)) return [];

  return [...records].sort((a, b) => {
    const orderA = typeof a.dependencyOrder === 'number' ? a.dependencyOrder : 99;
    const orderB = typeof b.dependencyOrder === 'number' ? b.dependencyOrder : 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
};

/**
 * Calculates plan readiness metrics and flags blocked records whose prerequisites are unmet.
 */
export const calculatePlanReadiness = (records, itemsMap = {}) => {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      total: 0,
      notStarted: 0,
      documentsPrepared: 0,
      submitted: 0,
      completed: 0,
      percentage: 0,
      blockedRecords: [],
    };
  }

  const items = itemsMap && typeof itemsMap === 'object' ? itemsMap : {};
  let notStarted = 0;
  let documentsPrepared = 0;
  let submitted = 0;
  let completed = 0;
  const blockedRecords = [];

  for (const record of records) {
    const status = items[record.id]?.status || 'not_started';
    if (status === 'completed') completed += 1;
    else if (status === 'submitted') submitted += 1;
    else if (status === 'documents_prepared') documentsPrepared += 1;
    else notStarted += 1;

    // Check prerequisites
    if (Array.isArray(record.prerequisites) && record.prerequisites.length > 0) {
      const missingPrereqs = record.prerequisites.filter((preId) => {
        const preStatus = items[preId]?.status;
        return preStatus !== 'completed' && preStatus !== 'submitted';
      });

      if (missingPrereqs.length > 0) {
        blockedRecords.push({
          recordId: record.id,
          recordName: record.name,
          missingPrerequisites: missingPrereqs,
        });
      }
    }
  }

  const total = records.length;
  // Weighted percentage: completed = 100%, submitted = 75%, documents_prepared = 40%
  const score = (completed * 1.0 + submitted * 0.75 + documentsPrepared * 0.4) / total;
  const percentage = Math.min(100, Math.round(score * 100));

  return {
    total,
    notStarted,
    documentsPrepared,
    submitted,
    completed,
    percentage,
    blockedRecords,
  };
};

/**
 * Generates conditional relocation advice based on origin and destination jurisdiction.
 */
export const getConditionalMoveRules = (moveType, originState = '', destinationState = '') => {
  const rules = [];

  if (moveType === 'inter_state') {
    rules.push({
      category: 'Motor Vehicles & Driving Licence',
      title: 'Inter-State RTO Clearance & NOC Requirement (Form 28)',
      detail: 'If you are bringing your personal motor vehicle to the new state for more than 11 months, Section 47 of the Motor Vehicles Act 1988 requires applying for an NOC (Form 28) from your origin RTO before re-registering and paying road tax in the destination state.',
      severity: 'important',
    });
    rules.push({
      category: 'Food Security & Ration Card',
      title: 'One Nation One Ration Card (ONORC) vs Full Card Migration',
      detail: 'Under ONORC, you can immediately lift your subsidized grains at any ration shop in your new state using biometric Aadhaar authentication. You only need a formal Surrender/Deletion Certificate if you want a local state ration card for state-specific welfare subsidies.',
      severity: 'tip',
    });
    if (originState && destinationState && originState !== destinationState) {
      rules.push({
        category: 'Inter-State Journey Notice',
        title: `Relocating from ${originState} to ${destinationState}`,
        detail: `Official state portal processes vary between ${originState} and ${destinationState}. Make sure to download your digital insurance policy and updated Aadhaar PVC card before moving.`,
        severity: 'info',
      });
    }
  } else if (moveType === 'inter_district') {
    rules.push({
      category: 'Electoral Constituency Shifting',
      title: 'Form 8 (Within-State Constituency Shifting)',
      detail: 'When moving between districts in the same state, submit ECI Form 8 and select "Shifting to another constituency". You will retain your original EPIC number while your polling station and Assembly Constituency update.',
      severity: 'info',
    });
    rules.push({
      category: 'RTO Address Update',
      title: 'Intra-State RTO Change (No NOC Required)',
      detail: 'Moving across districts within the same state does NOT require Form 28 NOC or payment of new road tax. Simply submit Form 33 for intimation of address change.',
      severity: 'tip',
    });
  } else {
    rules.push({
      category: 'Same-City Relocation',
      title: 'Fast-Track Local Address Intimation',
      detail: 'For same-city moves, update Aadhaar online first with your registered rental deed or new utility bill. Once approved, use Aadhaar e-KYC to update bank accounts and telecom providers digitally without physical visits.',
      severity: 'tip',
    });
  }

  return rules;
};

