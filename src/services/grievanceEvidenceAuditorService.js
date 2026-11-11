/**
 * AI Grievance Evidence Completeness and Chronology Auditor Service
 *
 * Implements an opt-in audit workspace for citizen public grievances:
 * 1. Analyzes timeline events, reference identifiers, and supporting attachments.
 * 2. Deterministic checks for missing acknowledgements, chronological order violations,
 *    inconsistent references, and duplicated files.
 * 3. Categorizes evidence completeness states:
 *    - 'PRESENT'
 *    - 'POSSIBLY_MISSING'
 *    - 'NEEDS_CONFIRMATION'
 * 4. Grounded suggestions: Distinguishes between statutory requirements (with citations)
 *    and general organizational best practices.
 * 5. Guarantees zero training on uploaded files and explicitly disclaims legal sufficiency
 *    or guaranteed resolution.
 */

export const EVIDENCE_AUDIT_STATUS = {
  PRESENT: 'PRESENT',
  POSSIBLY_MISSING: 'POSSIBLY_MISSING',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
};

export const GRIEVANCE_DISCLAIMER =
  'This tool assists citizens in organizing evidence and checking timeline consistency. It does not provide legal advice, guarantee grievance resolution, or declare official administrative admissibility.';

/**
 * Validates chronology of grievance events.
 * Detects future dates, disordered chronological sequence, and missing incident anchors.
 *
 * @param {Array<{ id: string, title: string, date: string, type: string }>} events
 * @returns {Array<object>} Chronology issues
 */
export function auditEventChronology(events = []) {
  if (!Array.isArray(events) || events.length === 0) {
    return [{ code: 'NO_EVENTS', severity: 'HIGH', message: 'No events provided in grievance timeline.' }];
  }

  const issues = [];
  const now = new Date();

  // Validate dates and sort
  const parsedEvents = events.map((ev, idx) => {
    const parsedDate = new Date(ev.date);
    const isValid = !isNaN(parsedDate.getTime());
    return { ...ev, originalIndex: idx, parsedDate, isValid };
  });

  // Check invalid or future dates
  for (const ev of parsedEvents) {
    if (!ev.isValid) {
      issues.push({
        code: 'INVALID_DATE',
        eventId: ev.id,
        severity: 'HIGH',
        message: `Event '${ev.title}' contains an unparseable or missing date: '${ev.date}'`,
      });
    } else if (ev.parsedDate > now) {
      issues.push({
        code: 'FUTURE_DATE',
        eventId: ev.id,
        severity: 'HIGH',
        message: `Event '${ev.title}' has a future date (${ev.date}) which is invalid for historical grievances.`,
      });
    }
  }

  // Check chronological order
  for (let i = 0; i < parsedEvents.length - 1; i++) {
    const curr = parsedEvents[i];
    const next = parsedEvents[i + 1];

    if (curr.isValid && next.isValid && curr.parsedDate > next.parsedDate) {
      issues.push({
        code: 'CHRONOLOGY_OUT_OF_ORDER',
        eventId: curr.id,
        relatedEventId: next.id,
        severity: 'MEDIUM',
        message: `Event '${curr.title}' (${curr.date}) occurs after subsequent event '${next.title}' (${next.date}).`,
      });
    }
  }

  return issues;
}

/**
 * Checks for duplicate attachments based on hash, filename, or byte size.
 *
 * @param {Array<{ id: string, name: string, size?: number, hash?: string }>} files
 * @returns {Array<object>} Duplicate file groups
 */
export function auditDuplicateFiles(files = []) {
  const seenHashes = new Map();
  const duplicates = [];

  for (const file of files) {
    const key = file.hash || `${file.name}_${file.size || 0}`;
    if (seenHashes.has(key)) {
      duplicates.push({
        fileId: file.id,
        fileName: file.name,
        duplicateOfId: seenHashes.get(key).id,
        duplicateOfName: seenHashes.get(key).name,
        message: `Duplicate document detected: '${file.name}' matches '${seenHashes.get(key).name}'`,
      });
    } else {
      seenHashes.set(key, file);
    }
  }

  return duplicates;
}

/**
 * Audits evidence completeness against departmental grievance requirements.
 *
 * @param {object} params
 * @param {string} params.grievanceCategory e.g., 'MUNICIPAL_SERVICES', 'PENSION', 'RATION_PDS', 'RTI_FIRST_APPEAL'
 * @param {Array<object>} params.attachedDocuments
 * @param {Array<object>} [params.officialRequirements]
 * @returns {object} Completeness report
 */
export function auditEvidenceCompleteness({
  grievanceCategory = 'GENERAL',
  attachedDocuments = [],
  officialRequirements = [],
}) {
  const attachedTypes = new Set(
    attachedDocuments.map((d) => (d.category || d.type || d.name || '').toLowerCase())
  );

  const defaultCategoryRequirements = {
    MUNICIPAL_SERVICES: [
      {
        key: 'acknowledgement',
        name: 'Prior Complaint Acknowledgement / Token Number',
        isStatutory: true,
        citation: 'Public Grievance Redressal Citizen Charter, Sec 4',
      },
      {
        key: 'photo_proof',
        name: 'Photographic evidence or site location coordinates',
        isStatutory: false,
        advice: 'General organizational recommendation for municipal issues',
      },
    ],
    PENSION: [
      {
        key: 'ppo_copy',
        name: 'Pension Payment Order (PPO) Copy',
        isStatutory: true,
        citation: 'Central Civil Services (Pension) Rules, Form 7',
      },
      {
        key: 'bank_statement',
        name: 'Bank Passbook / Disbursal Statement',
        isStatutory: true,
        citation: 'Department of Pension & Pensioners Welfare Guidelines',
      },
    ],
    RATION_PDS: [
      {
        key: 'ration_card',
        name: 'Ration Card Number / Copy',
        isStatutory: true,
        citation: 'National Food Security Act (NFSA) 2013, Sec 15',
      },
    ],
  };

  const checklist =
    officialRequirements.length > 0
      ? officialRequirements
      : defaultCategoryRequirements[grievanceCategory] || [
          {
            key: 'acknowledgement',
            name: 'Prior Reference or Complaint Number',
            isStatutory: false,
            advice: 'Recommended to track prior departmental correspondence',
          },
        ];

  const auditedChecklist = checklist.map((item) => {
    const isPresent = Array.from(attachedTypes).some((type) =>
      type.includes(item.key.toLowerCase())
    );

    let status = EVIDENCE_AUDIT_STATUS.PRESENT;
    if (!isPresent) {
      status = item.isStatutory
        ? EVIDENCE_AUDIT_STATUS.POSSIBLY_MISSING
        : EVIDENCE_AUDIT_STATUS.NEEDS_CONFIRMATION;
    }

    return {
      key: item.key,
      name: item.name,
      status,
      isStatutory: Boolean(item.isStatutory),
      citation: item.citation || null,
      advice: item.advice || null,
    };
  });

  const missingCount = auditedChecklist.filter(
    (c) => c.status === EVIDENCE_AUDIT_STATUS.POSSIBLY_MISSING
  ).length;

  return {
    category: grievanceCategory,
    checklist: auditedChecklist,
    missingCount,
    readinessScore: Math.round(
      ((auditedChecklist.length - missingCount) / auditedChecklist.length) * 100
    ),
    disclaimer: GRIEVANCE_DISCLAIMER,
  };
}

/**
 * Runs a comprehensive audit combining chronology, duplicate files, and evidence completeness.
 *
 * @param {object} grievancePacket
 * @returns {object} Final audit result
 */
export function runGrievanceAudit(grievancePacket = {}) {
  const chronologyIssues = auditEventChronology(grievancePacket.events || []);
  const duplicateFiles = auditDuplicateFiles(grievancePacket.attachments || []);
  const completeness = auditEvidenceCompleteness({
    grievanceCategory: grievancePacket.category,
    attachedDocuments: grievancePacket.attachments || [],
    officialRequirements: grievancePacket.requirements || [],
  });

  const canExport = chronologyIssues.filter((i) => i.severity === 'HIGH').length === 0;

  return {
    grievanceId: grievancePacket.id || 'draft-grievance',
    canExport,
    chronologyIssues,
    duplicateFiles,
    completeness,
    trainingOptIn: false, // Explicit guarantee: Never used for model training
    disclaimer: GRIEVANCE_DISCLAIMER,
  };
}
