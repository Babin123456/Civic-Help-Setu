/**
 * src/services/caregiverChecklistService.js
 *
 * Caregiver-Managed Multi-Person Civic Document Checklist (#1421).
 *
 * Extends `checklistStorage.js` and `checklistExportService.js` to provide:
 *   - Household workspaces with strictly isolated person partitions
 *   - Guardian / consent rules (minor_guardian, elderly_caregiver, adult_explicit_consent)
 *   - Per-person access scopes (read, checklist_write, export, delete, manage_consent)
 *   - Duplicate application/document warnings without combining identity data across applicants
 *   - Scoped export & delete controls with non-PII audit logging
 *   - Distinct provenance tags: citizen_entered | official_record | ai_suggestion
 */

import { readChecklist, writeChecklist, deleteChecklist } from './checklistStorage.js';
import { checklistExportService } from './checklistExportService.js';

export const CAREGIVER_HOUSEHOLD_STORAGE_KEY = 'civicbridge_caregiver_households_v1';

export const VALID_CONSENT_BASES = Object.freeze([
  'minor_guardian',
  'elderly_caregiver',
  'adult_explicit_consent',
]);

export const VALID_CONSENT_STATUSES = Object.freeze(['granted', 'pending', 'revoked']);

export const VALID_SCOPES = Object.freeze([
  'read',
  'checklist_write',
  'export',
  'delete',
  'manage_consent',
]);

export const VALID_PROVENANCE = Object.freeze([
  'citizen_entered',
  'official_record',
  'ai_suggestion',
]);

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const SENSITIVE_KEY_RE = /\b(aadhaar|password|otp|biometric|fingerprint|iris)\b/i;

export function hasForbiddenPII(input) {
  if (!input) return false;
  if (typeof input === 'string') {
    return AADHAAR_RE.test(input) || PAN_RE.test(input);
  }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (SENSITIVE_KEY_RE.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
        return true;
      }
      if (hasForbiddenPII(v)) return true;
    }
  }
  return false;
}

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readStore(storage = getDefaultStorage()) {
  if (!storage) return { households: {}, auditLog: [] };
  try {
    const raw = storage.getItem(CAREGIVER_HOUSEHOLD_STORAGE_KEY);
    if (!raw) return { households: {}, auditLog: [] };
    const parsed = JSON.parse(raw);
    return {
      households: parsed?.households && typeof parsed.households === 'object' ? parsed.households : {},
      auditLog: Array.isArray(parsed?.auditLog) ? parsed.auditLog : [],
    };
  } catch {
    return { households: {}, auditLog: [] };
  }
}

function writeStore(store, storage = getDefaultStorage()) {
  if (!storage) return false;
  storage.setItem(CAREGIVER_HOUSEHOLD_STORAGE_KEY, JSON.stringify(store));
  return true;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function appendAudit(store, { householdId, personId = null, actorId, action, outcome, detail = '' }) {
  store.auditLog.push({
    auditId: makeId('aud'),
    timestamp: new Date().toISOString(),
    householdId,
    personId,
    actorId: actorId || 'anonymous',
    action,
    outcome,
    detail: String(detail || '').slice(0, 140),
  });
}

function isConsentActive(person) {
  if (!person || person.consentStatus !== 'granted') return false;
  if (person.consentExpiresAt) {
    const exp = Date.parse(person.consentExpiresAt);
    if (!Number.isNaN(exp) && exp <= Date.now()) return false;
  }
  return true;
}

function authorizePersonAction({ household, personId, actorId, requiredScope, requireActiveConsent = true }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (!household) return { ok: false, code: 404, error: 'Household workspace not found.' };
  const person = household.persons?.[personId];
  if (!person) return { ok: false, code: 404, error: 'Person record not found in this household.' };

  const actorScopes = person.actorScopes?.[actorId] || [];
  const isPrimaryCaregiver = household.caregiverId === actorId;

  if (!isPrimaryCaregiver && !actorScopes.includes(requiredScope)) {
    return { ok: false, code: 403, error: `Missing '${requiredScope}' scope for this person record.` };
  }
  if (isPrimaryCaregiver && person.actorScopes?.[actorId] && !actorScopes.includes(requiredScope)) {
    return { ok: false, code: 403, error: `Scope '${requiredScope}' was explicitly restricted for this person.` };
  }

  if (requireActiveConsent && !isConsentActive(person)) {
    return {
      ok: false,
      code: 403,
      error: `Guardian/person consent is '${person.consentStatus}' or expired; action blocked.`,
    };
  }

  return { ok: true, person };
}

export function createHouseholdWorkspace({ householdName, caregiverId, storage = getDefaultStorage() }) {
  if (!caregiverId) throw new Error('caregiverId is required.');
  if (!householdName || !String(householdName).trim()) throw new Error('householdName is required.');
  if (hasForbiddenPII({ householdName })) throw new Error('Household name must not contain sensitive PII.');

  const store = readStore(storage);
  const householdId = makeId('hh');
  store.households[householdId] = {
    householdId,
    householdName: String(householdName).trim(),
    caregiverId,
    createdAt: new Date().toISOString(),
    persons: {},
  };
  appendAudit(store, {
    householdId,
    actorId: caregiverId,
    action: 'create_household',
    outcome: 'allowed',
  });
  writeStore(store, storage);
  return store.households[householdId];
}

export function addPersonRecord({
  householdId,
  actorId,
  displayLabel,
  relationship = 'dependant',
  jurisdiction = 'UNVERIFIED',
  consentBasis = 'minor_guardian',
  consentStatus = 'granted',
  consentExpiresAt = null,
  scopes = ['read', 'checklist_write', 'export', 'delete', 'manage_consent'],
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (hasForbiddenPII({ displayLabel, relationship, jurisdiction })) {
    return { ok: false, code: 400, error: 'Person record must not contain Aadhaar, PAN, OTPs, or passwords.' };
  }
  if (!displayLabel || !String(displayLabel).trim()) {
    return { ok: false, code: 400, error: 'displayLabel is required.' };
  }
  if (!VALID_CONSENT_BASES.includes(consentBasis)) {
    return { ok: false, code: 400, error: 'Invalid consentBasis.' };
  }
  if (!VALID_CONSENT_STATUSES.includes(consentStatus)) {
    return { ok: false, code: 400, error: 'Invalid consentStatus.' };
  }

  const store = readStore(storage);
  const household = store.households[householdId];
  if (!household) return { ok: false, code: 404, error: 'Household workspace not found.' };
  if (household.caregiverId !== actorId) {
    appendAudit(store, { householdId, actorId, action: 'add_person', outcome: 'denied', detail: 'Not primary caregiver' });
    writeStore(store, storage);
    return { ok: false, code: 403, error: 'Only the household caregiver can add person records.' };
  }

  const sanitizedScopes = Array.isArray(scopes)
    ? scopes.filter((s) => VALID_SCOPES.includes(s))
    : ['read', 'checklist_write'];

  const personId = makeId('per');
  const person = {
    personId,
    displayLabel: String(displayLabel).trim(),
    relationship: String(relationship || 'dependant').trim(),
    jurisdiction: String(jurisdiction || 'UNVERIFIED').trim(),
    consentBasis,
    consentStatus,
    consentGrantedAt: consentStatus === 'granted' ? new Date().toISOString() : null,
    consentExpiresAt: consentExpiresAt || null,
    consentedBy: actorId,
    actorScopes: { [actorId]: sanitizedScopes },
    applications: {},
    createdAt: new Date().toISOString(),
  };

  household.persons[personId] = person;
  appendAudit(store, {
    householdId,
    personId,
    actorId,
    action: 'add_person',
    outcome: 'allowed',
    detail: `basis=${consentBasis},status=${consentStatus}`,
  });
  writeStore(store, storage);
  return { ok: true, person };
}

export function updatePersonConsent({
  householdId,
  personId,
  actorId,
  consentStatus,
  consentExpiresAt = null,
  targetActorId = null,
  scopes = null,
  storage = getDefaultStorage(),
}) {
  const store = readStore(storage);
  const household = store.households[householdId];
  const auth = authorizePersonAction({
    household,
    personId,
    actorId,
    requiredScope: 'manage_consent',
    requireActiveConsent: false,
  });
  if (!auth.ok) {
    if (household) {
      appendAudit(store, { householdId, personId, actorId, action: 'update_consent', outcome: 'denied' });
      writeStore(store, storage);
    }
    return auth;
  }

  const person = auth.person;
  if (consentStatus) {
    if (!VALID_CONSENT_STATUSES.includes(consentStatus)) {
      return { ok: false, code: 400, error: 'Invalid consentStatus.' };
    }
    person.consentStatus = consentStatus;
    person.consentGrantedAt = consentStatus === 'granted' ? new Date().toISOString() : person.consentGrantedAt;
    person.consentExpiresAt = consentExpiresAt ?? person.consentExpiresAt;
  }

  if (targetActorId && Array.isArray(scopes)) {
    person.actorScopes[targetActorId] = scopes.filter((s) => VALID_SCOPES.includes(s));
  }

  appendAudit(store, {
    householdId,
    personId,
    actorId,
    action: 'update_consent',
    outcome: 'allowed',
    detail: `status=${person.consentStatus}`,
  });
  writeStore(store, storage);
  return { ok: true, person };
}

export function detectDuplicateWarnings({ household, personId, applicationRef = '', items = [] }) {
  const warnings = [];
  const person = household?.persons?.[personId];
  if (!person) return warnings;

  const normalizedRef = String(applicationRef || '').trim().toLowerCase();
  const normalizedLabels = new Set(
    (Array.isArray(items) ? items : []).map((i) => String(i?.label || i).trim().toLowerCase()).filter(Boolean)
  );

  // 1. Check within the same person's existing applications
  for (const app of Object.values(person.applications || {})) {
    if (normalizedRef && app.applicationRef && app.applicationRef.toLowerCase() === normalizedRef) {
      warnings.push({
        type: 'same_person_duplicate_ref',
        severity: 'warning',
        message: `Application reference "${applicationRef}" already exists in ${person.displayLabel}'s checklist.`,
      });
    }
    const existingLabels = (app.items || []).map((i) => i.label.toLowerCase());
    const overlapping = [...normalizedLabels].filter((lbl) => existingLabels.includes(lbl));
    if (overlapping.length > 0) {
      warnings.push({
        type: 'overlapping_document_item',
        severity: 'info',
        message: `${overlapping.length} document item(s) overlap with existing application "${app.serviceName}".`,
      });
    }
  }

  // 2. Cross-person reference collision check (without exposing other person's identity or documents)
  if (normalizedRef) {
    for (const [otherPersonId, otherPerson] of Object.entries(household.persons || {})) {
      if (otherPersonId === personId) continue;
      const hasSameRef = Object.values(otherPerson.applications || {}).some(
        (app) => app.applicationRef && app.applicationRef.toLowerCase() === normalizedRef
      );
      if (hasSameRef) {
        warnings.push({
          type: 'cross_person_reference_collision',
          severity: 'warning',
          message: `Application reference "${applicationRef}" is already assigned to another household member. Verify you are not mixing applicant records.`,
        });
        break;
      }
    }
  }

  return warnings;
}

export function addApplicationChecklist({
  householdId,
  personId,
  actorId,
  serviceId = 'custom-service',
  serviceName,
  applicationRef = '',
  jurisdiction = '',
  deadline = null,
  officialSource = '',
  effectiveDate = '',
  lastVerifiedAt = '',
  items = [],
  storage = getDefaultStorage(),
}) {
  if (hasForbiddenPII({ serviceName, applicationRef, jurisdiction, officialSource, items })) {
    return { ok: false, code: 400, error: 'Checklist payload must not contain Aadhaar, PAN, OTPs, or passwords.' };
  }
  if (!serviceName || !String(serviceName).trim()) {
    return { ok: false, code: 400, error: 'serviceName is required.' };
  }

  const store = readStore(storage);
  const household = store.households[householdId];
  const auth = authorizePersonAction({ household, personId, actorId, requiredScope: 'checklist_write' });
  if (!auth.ok) {
    if (household) {
      appendAudit(store, { householdId, personId, actorId, action: 'add_application', outcome: 'denied' });
      writeStore(store, storage);
    }
    return auth;
  }

  const normalizedItems = (Array.isArray(items) ? items : []).map((raw) => {
    const obj = typeof raw === 'string' ? { label: raw } : raw || {};
    const provenance = VALID_PROVENANCE.includes(obj.provenance) ? obj.provenance : 'citizen_entered';
    return {
      label: String(obj.label || '').trim(),
      provenance,
      note: obj.note ? String(obj.note).trim() : '',
    };
  }).filter((i) => i.label);

  const duplicateWarnings = detectDuplicateWarnings({
    household,
    personId,
    applicationRef,
    items: normalizedItems,
  });

  const applicationId = makeId('app');
  const checklistKey = `${householdId}:${personId}:${applicationId}`;
  const isOfficialVerified = Boolean(officialSource && effectiveDate && lastVerifiedAt);

  const application = {
    applicationId,
    checklistKey,
    serviceId,
    serviceName: String(serviceName).trim(),
    applicationRef: String(applicationRef || '').trim(),
    jurisdiction: String(jurisdiction || auth.person.jurisdiction || 'UNVERIFIED').trim(),
    deadline: deadline || null,
    officialMetadata: {
      source: officialSource || null,
      jurisdiction: jurisdiction || auth.person.jurisdiction || 'UNVERIFIED',
      effectiveDate: effectiveDate || null,
      lastVerifiedAt: lastVerifiedAt || null,
      verificationStatus: isOfficialVerified ? 'VERIFIED' : 'UNVERIFIED',
    },
    items: normalizedItems,
    createdAt: new Date().toISOString(),
  };

  auth.person.applications[applicationId] = application;
  writeChecklist(checklistKey, [], 0, storage);

  appendAudit(store, {
    householdId,
    personId,
    actorId,
    action: 'add_application',
    outcome: 'allowed',
    detail: `app=${applicationId}`,
  });
  writeStore(store, storage);

  return { ok: true, application, duplicateWarnings };
}

export function toggleChecklistItem({
  householdId,
  personId,
  applicationId,
  itemLabel,
  checked,
  actorId,
  expectedRev = null,
  storage = getDefaultStorage(),
}) {
  const store = readStore(storage);
  const household = store.households[householdId];
  const auth = authorizePersonAction({ household, personId, actorId, requiredScope: 'checklist_write' });
  if (!auth.ok) return auth;

  const app = auth.person.applications?.[applicationId];
  if (!app) return { ok: false, code: 404, error: 'Application checklist not found.' };

  const current = readChecklist(app.checklistKey, storage);
  const revToUse = expectedRev === null ? current.rev : expectedRev;
  const nextSet = new Set(current.checked);
  if (checked) nextSet.add(itemLabel);
  else nextSet.delete(itemLabel);

  const writeRes = writeChecklist(app.checklistKey, [...nextSet], revToUse, storage);
  if (!writeRes.ok) {
    return { ok: false, code: writeRes.reason === 'conflict' ? 409 : 400, error: `Checklist save ${writeRes.reason}` };
  }
  return { ok: true, state: writeRes.state };
}

export function getPersonWorkspace({ householdId, personId, actorId, storage = getDefaultStorage() }) {
  const store = readStore(storage);
  const household = store.households[householdId];
  const auth = authorizePersonAction({ household, personId, actorId, requiredScope: 'read' });
  if (!auth.ok) return auth;

  const applications = Object.values(auth.person.applications || {}).map((app) => ({
    ...app,
    progress: readChecklist(app.checklistKey, storage),
  }));

  return {
    ok: true,
    person: {
      personId: auth.person.personId,
      displayLabel: auth.person.displayLabel,
      relationship: auth.person.relationship,
      jurisdiction: auth.person.jurisdiction,
      consentBasis: auth.person.consentBasis,
      consentStatus: auth.person.consentStatus,
      consentExpiresAt: auth.person.consentExpiresAt,
      applications,
    },
  };
}

export function exportPersonChecklist({
  householdId,
  personId,
  applicationId = null,
  actorId,
  storage = getDefaultStorage(),
}) {
  const store = readStore(storage);
  const household = store.households[householdId];
  const auth = authorizePersonAction({ household, personId, actorId, requiredScope: 'export' });
  if (!auth.ok) {
    if (household) {
      appendAudit(store, { householdId, personId, actorId, action: 'export_checklist', outcome: 'denied' });
      writeStore(store, storage);
    }
    return auth;
  }

  const apps = applicationId
    ? [auth.person.applications?.[applicationId]].filter(Boolean)
    : Object.values(auth.person.applications || {});

  if (applicationId && apps.length === 0) {
    return { ok: false, code: 404, error: 'Application checklist not found.' };
  }

  const exportedApps = apps.map((app) => {
    const progress = readChecklist(app.checklistKey, storage);
    const baseText = checklistExportService.formatTextSummary({
      id: app.serviceId,
      name: `${app.serviceName} (${auth.person.displayLabel})`,
      category: app.jurisdiction,
      documents: app.items.map((i) => `[${i.provenance}] ${i.label}`),
    });
    return {
      applicationId: app.applicationId,
      serviceName: app.serviceName,
      applicationRef: app.applicationRef,
      officialMetadata: app.officialMetadata,
      checkedItems: progress.checked,
      items: app.items,
      textSummary: baseText,
    };
  });

  appendAudit(store, {
    householdId,
    personId,
    actorId,
    action: 'export_checklist',
    outcome: 'allowed',
    detail: `apps=${exportedApps.length}`,
  });
  writeStore(store, storage);

  return {
    ok: true,
    exportPayload: {
      exportedAt: new Date().toISOString(),
      householdId,
      personId: auth.person.personId,
      displayLabel: auth.person.displayLabel,
      consentStatus: auth.person.consentStatus,
      applications: exportedApps,
    },
  };
}

export function deletePersonOrApplication({
  householdId,
  personId,
  applicationId = null,
  actorId,
  storage = getDefaultStorage(),
}) {
  const store = readStore(storage);
  const household = store.households[householdId];
  const auth = authorizePersonAction({
    household,
    personId,
    actorId,
    requiredScope: 'delete',
    requireActiveConsent: false,
  });
  if (!auth.ok) {
    if (household) {
      appendAudit(store, { householdId, personId, actorId, action: 'delete_record', outcome: 'denied' });
      writeStore(store, storage);
    }
    return auth;
  }

  if (applicationId) {
    const app = auth.person.applications?.[applicationId];
    if (!app) return { ok: false, code: 404, error: 'Application checklist not found.' };
    deleteChecklist(app.checklistKey, storage);
    delete auth.person.applications[applicationId];
    appendAudit(store, {
      householdId,
      personId,
      actorId,
      action: 'delete_application',
      outcome: 'allowed',
      detail: `app=${applicationId}`,
    });
  } else {
    for (const app of Object.values(auth.person.applications || {})) {
      deleteChecklist(app.checklistKey, storage);
    }
    delete household.persons[personId];
    appendAudit(store, {
      householdId,
      personId,
      actorId,
      action: 'delete_person',
      outcome: 'allowed',
    });
  }

  writeStore(store, storage);
  return { ok: true };
}

export function getHouseholdAuditLog({ householdId, actorId, storage = getDefaultStorage() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const household = store.households[householdId];
  if (!household) return { ok: false, code: 404, error: 'Household workspace not found.' };
  if (household.caregiverId !== actorId) {
    return { ok: false, code: 403, error: 'Only the primary caregiver can read the household audit log.' };
  }
  const entries = store.auditLog.filter((e) => e.householdId === householdId);
  return { ok: true, entries };
}
