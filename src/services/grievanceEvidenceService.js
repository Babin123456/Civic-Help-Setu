/**
 * Civic Grievance Evidence Organizer Service (#143)
 *
 * Implements a private, user-controlled preparation workspace for citizens
 * before lodging an official public service grievance (e.g., on CPGRAMS,
 * State Jan Sunwai, or departmental vigilance portals).
 *
 * Scoped locally, zero telemetry on sensitive complaint notes,
 * exportable dossier, and clear boundary distinguishing preparation from official filing.
 */

export const GRIEVANCE_EVIDENCE_STORAGE_KEY = 'civic_grievance_evidence_drafts';

export const DEFAULT_EVIDENCE_ITEMS = [
  { id: 'ev-app-copy', label: 'Copy of Original Application / Form with Timestamp', completed: false },
  { id: 'ev-fee-receipt', label: 'Statutory Fee Payment Receipt / Challan Slip', completed: false },
  { id: 'ev-ack-slip', label: 'Official Acknowledgement Slip / Token Number', completed: false },
  { id: 'ev-reminder-log', label: 'Prior Reminder Letters, Emails, or In-Person Visit Notes', completed: false },
  { id: 'ev-statutory-sla', label: 'Departmental Citizen Charter / SLA Timeline Document', completed: false },
  { id: 'ev-supporting-proof', label: 'Photographic Proof, Defect Log, or RTI Inspection Reply', completed: false },
];

/**
 * Reads all stored grievance drafts safely from localStorage.
 * @param {Storage} [storage=localStorage]
 * @returns {Array} List of all drafts
 */
export function getAllGrievanceDrafts(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GRIEVANCE_EVIDENCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves all drafts back to localStorage safely.
 * @param {Array} drafts
 * @param {Storage} [storage=localStorage]
 * @returns {boolean}
 */
export function saveAllGrievanceDrafts(drafts = [], storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return false;
  try {
    storage.setItem(GRIEVANCE_EVIDENCE_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists drafts scoped to a specific authenticated user (or local guest).
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Array} Filtered drafts
 */
export function listGrievanceDrafts(userId = 'anonymous_local', storage) {
  const all = getAllGrievanceDrafts(storage);
  const cleanUser = userId || 'anonymous_local';
  return all.filter((d) => d.userId === cleanUser);
}

/**
 * Retrieves a single draft by ID, scoped to user.
 * @param {string} draftId
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object|null}
 */
export function getGrievanceDraftById(draftId, userId = 'anonymous_local', storage) {
  if (!draftId) return null;
  const list = listGrievanceDrafts(userId, storage);
  return list.find((d) => d.id === draftId) || null;
}

/**
 * Creates a new grievance preparation draft.
 *
 * @param {Object} data - Initial draft details
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object} Created draft
 */
export function createGrievanceDraft(data = {}, userId = 'anonymous_local', storage) {
  const all = getAllGrievanceDrafts(storage);
  const cleanUser = userId || 'anonymous_local';

  const newDraft = {
    id: `GRV-DRAFT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: cleanUser,
    title: (data.title || 'Untitled Grievance Preparation Draft').trim(),
    department: (data.department || 'Municipal Administration').trim(),
    serviceId: data.serviceId || null,
    officialReferenceNumbers: Array.isArray(data.officialReferenceNumbers)
      ? data.officialReferenceNumbers.filter(Boolean)
      : [],
    issueSummary: (data.issueSummary || '').trim(),
    reliefSought: (data.reliefSought || '').trim(),
    timeline: Array.isArray(data.timeline) && data.timeline.length > 0
      ? data.timeline
      : [
          {
            id: `tl-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            title: 'Initial Application Submitted / Service Requested',
            notes: 'Record date and counter number where request was initiated.',
          },
        ],
    evidenceChecklist: Array.isArray(data.evidenceChecklist) && data.evidenceChecklist.length > 0
      ? data.evidenceChecklist
      : DEFAULT_EVIDENCE_ITEMS.map((item) => ({ ...item })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  all.unshift(newDraft);
  saveAllGrievanceDrafts(all, storage);
  return newDraft;
}

/**
 * Updates an existing grievance draft.
 *
 * @param {string} draftId
 * @param {Object} updates
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object|null} Updated draft
 */
export function updateGrievanceDraft(draftId, updates = {}, userId = 'anonymous_local', storage) {
  if (!draftId) return null;
  const all = getAllGrievanceDrafts(storage);
  const cleanUser = userId || 'anonymous_local';

  const index = all.findIndex((d) => d.id === draftId && d.userId === cleanUser);
  if (index === -1) return null;

  const current = all[index];
  const updated = {
    ...current,
    ...updates,
    id: current.id,
    userId: current.userId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveAllGrievanceDrafts(all, storage);
  return updated;
}

/**
 * Deletes a grievance draft.
 *
 * @param {string} draftId
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {boolean} Success
 */
export function deleteGrievanceDraft(draftId, userId = 'anonymous_local', storage) {
  if (!draftId) return false;
  const all = getAllGrievanceDrafts(storage);
  const cleanUser = userId || 'anonymous_local';

  const initialLength = all.length;
  const filtered = all.filter((d) => !(d.id === draftId && d.userId === cleanUser));

  if (filtered.length === initialLength) {
    return false; // Draft not found
  }

  return saveAllGrievanceDrafts(filtered, storage);
}

/**
 * Adds a dated event to a draft's timeline.
 *
 * @param {string} draftId
 * @param {Object} eventData - { date, title, notes }
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object|null} Updated draft
 */
export function addTimelineEvent(draftId, eventData = {}, userId = 'anonymous_local', storage) {
  const draft = getGrievanceDraftById(draftId, userId, storage);
  if (!draft) return null;

  const newEvent = {
    id: `tl-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    date: eventData.date || new Date().toISOString().split('T')[0],
    title: (eventData.title || 'Follow-up Event').trim(),
    notes: (eventData.notes || '').trim(),
  };

  const timeline = [...(draft.timeline || []), newEvent].sort((a, b) => a.date.localeCompare(b.date));
  return updateGrievanceDraft(draftId, { timeline }, userId, storage);
}

/**
 * Removes a dated event from a draft's timeline.
 *
 * @param {string} draftId
 * @param {string} eventId
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object|null} Updated draft
 */
export function removeTimelineEvent(draftId, eventId, userId = 'anonymous_local', storage) {
  const draft = getGrievanceDraftById(draftId, userId, storage);
  if (!draft || !eventId) return null;

  const timeline = (draft.timeline || []).filter((e) => e.id !== eventId);
  return updateGrievanceDraft(draftId, { timeline }, userId, storage);
}

/**
 * Toggles an evidence checklist item completion state.
 *
 * @param {string} draftId
 * @param {string} itemId
 * @param {boolean} completed
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object|null} Updated draft
 */
export function toggleEvidenceCheck(draftId, itemId, completed, userId = 'anonymous_local', storage) {
  const draft = getGrievanceDraftById(draftId, userId, storage);
  if (!draft || !itemId) return null;

  const evidenceChecklist = (draft.evidenceChecklist || []).map((item) =>
    item.id === itemId ? { ...item, completed: Boolean(completed) } : item
  );

  return updateGrievanceDraft(draftId, { evidenceChecklist }, userId, storage);
}

/**
 * Adds a custom evidence checklist item to gather.
 *
 * @param {string} draftId
 * @param {string} label
 * @param {string} [userId='anonymous_local']
 * @param {Storage} [storage]
 * @returns {Object|null} Updated draft
 */
export function addCustomEvidenceItem(draftId, label = '', userId = 'anonymous_local', storage) {
  const draft = getGrievanceDraftById(draftId, userId, storage);
  const cleanLabel = label.trim();
  if (!draft || !cleanLabel) return null;

  const newItem = {
    id: `ev-custom-${Date.now()}`,
    label: cleanLabel,
    completed: false,
  };

  const evidenceChecklist = [...(draft.evidenceChecklist || []), newItem];
  return updateGrievanceDraft(draftId, { evidenceChecklist }, userId, storage);
}

/**
 * Validates a grievance draft for readiness.
 *
 * @param {Object} draft
 * @returns {Object} { isValid, errors, completedEvidenceCount, totalEvidenceCount }
 */
export function validateGrievanceDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    return {
      isValid: false,
      errors: ['Draft is empty or non-existent.'],
      completedEvidenceCount: 0,
      totalEvidenceCount: 0,
    };
  }

  const errors = [];
  if (!draft.title || !draft.title.trim()) {
    errors.push('Grievance title is required.');
  }
  if (!draft.department || !draft.department.trim()) {
    errors.push('Department or public authority is required.');
  }
  if (!draft.issueSummary || draft.issueSummary.trim().length < 10) {
    errors.push('Issue summary must provide at least 10 characters explaining the grievance facts.');
  }

  const evidence = Array.isArray(draft.evidenceChecklist) ? draft.evidenceChecklist : [];
  const completedEvidence = evidence.filter((e) => e.completed).length;

  return {
    isValid: errors.length === 0,
    errors,
    completedEvidenceCount: completedEvidence,
    totalEvidenceCount: evidence.length,
  };
}

/**
 * Exports a user-requested, structured dossier summary.
 *
 * Acceptance Criteria Compliance:
 * "Export creates a user-requested summary without silently sending it anywhere."
 * "UI distinguishes preparation support from an officially filed grievance."
 *
 * @param {Object} draft
 * @returns {string} Formatted markdown dossier
 */
export function exportGrievanceDossier(draft) {
  if (!draft) return '';

  const refNumbers = Array.isArray(draft.officialReferenceNumbers) && draft.officialReferenceNumbers.length > 0
    ? draft.officialReferenceNumbers.join(', ')
    : 'None recorded';

  const lines = [
    `# GRIEVANCE EVIDENCE PREPARATION DOSSIER: ${draft.title || 'Public Service Complaint'}`,
    `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    `Target Department / Authority: ${draft.department || 'Not specified'}`,
    `Official Reference / Acknowledgement Numbers: ${refNumbers}`,
    '',
    '## IMPORTANT NOTICE & LEGAL DISCLAIMER',
    '> Civic Help Setu is an educational civic assistance platform. This dossier is a PRIVATE citizen preparation workspace and DOES NOT constitute an officially filed government grievance. To submit this complaint formally for statutory redressal, copy the details below and lodge directly at CPGRAMS (https://pgportal.gov.in) or your respective State Grievance Redressal Portal.',
    '',
    '## 1. Summary of Issue & Grievance Facts',
    draft.issueSummary || 'No summary recorded.',
    '',
    '## 2. Relief / Remedy Sought',
    draft.reliefSought || 'Statutory resolution and time-bound delivery as per citizen charter.',
    '',
    '## 3. Chronological Event Timeline',
  ];

  const timeline = Array.isArray(draft.timeline) ? draft.timeline : [];
  if (timeline.length === 0) {
    lines.push('- No dated events recorded.');
  } else {
    for (const event of timeline) {
      lines.push(`- **[${event.date}]** ${event.title}`);
      if (event.notes) {
        lines.push(`  - Details: ${event.notes}`);
      }
    }
  }

  lines.push('');
  lines.push('## 4. Supporting Evidence Checklist');

  const evidence = Array.isArray(draft.evidenceChecklist) ? draft.evidenceChecklist : [];
  if (evidence.length === 0) {
    lines.push('- No evidence checklist items configured.');
  } else {
    for (const item of evidence) {
      lines.push(`- [${item.completed ? 'x' : ' '}] ${item.label}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('Prepared privately on device with Civic Help Setu. No personal data was transmitted to external servers.');

  return lines.join('\n');
}
