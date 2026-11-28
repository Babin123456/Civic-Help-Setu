import { describe, it, expect } from 'vitest';
import {
  createHouseholdWorkspace,
  addPersonRecord,
  updatePersonConsent,
  addApplicationChecklist,
  toggleChecklistItem,
  getPersonWorkspace,
  exportPersonChecklist,
  deletePersonOrApplication,
  getHouseholdAuditLog,
  hasForbiddenPII,
} from './caregiverChecklistService.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('caregiverChecklistService', () => {
  it('isolates person records, detects duplicate references, and preserves provenance', () => {
    const storage = makeMemoryStorage();
    const hh = createHouseholdWorkspace({
      householdName: 'Verma Family',
      caregiverId: 'caregiver-1',
      storage,
    });

    const p1 = addPersonRecord({
      householdId: hh.householdId,
      actorId: 'caregiver-1',
      displayLabel: 'Dependant A',
      relationship: 'child',
      jurisdiction: 'Delhi',
      consentBasis: 'minor_guardian',
      storage,
    });
    const p2 = addPersonRecord({
      householdId: hh.householdId,
      actorId: 'caregiver-1',
      displayLabel: 'Dependant B',
      relationship: 'parent',
      jurisdiction: 'Delhi',
      consentBasis: 'elderly_caregiver',
      storage,
    });

    expect(p1.ok).toBe(true);
    expect(p2.ok).toBe(true);
    expect(p1.person.personId).not.toBe(p2.person.personId);

    const app1 = addApplicationChecklist({
      householdId: hh.householdId,
      personId: p1.person.personId,
      actorId: 'caregiver-1',
      serviceName: 'Birth Certificate',
      applicationRef: 'REF-1001',
      officialSource: 'https://mcdonline.nic.in',
      effectiveDate: '2026-01-01',
      lastVerifiedAt: '2026-11-01',
      items: [
        { label: 'Hospital Discharge Slip', provenance: 'official_record' },
        { label: 'Parent Declaration Note', provenance: 'citizen_entered' },
      ],
      storage,
    });
    expect(app1.ok).toBe(true);
    expect(app1.application.officialMetadata.verificationStatus).toBe('VERIFIED');

    // Cross-person reference collision warning without merging records
    const app2 = addApplicationChecklist({
      householdId: hh.householdId,
      personId: p2.person.personId,
      actorId: 'caregiver-1',
      serviceName: 'Senior Citizen Card',
      applicationRef: 'REF-1001',
      items: [{ label: 'Age Proof', provenance: 'ai_suggestion' }],
      storage,
    });
    expect(app2.ok).toBe(true);
    expect(app2.application.officialMetadata.verificationStatus).toBe('UNVERIFIED');
    expect(app2.duplicateWarnings.some((w) => w.type === 'cross_person_reference_collision')).toBe(true);

    // Toggle item on Person 1 only; Person 2 remains untouched
    const tog = toggleChecklistItem({
      householdId: hh.householdId,
      personId: p1.person.personId,
      applicationId: app1.application.applicationId,
      itemLabel: 'Hospital Discharge Slip',
      checked: true,
      actorId: 'caregiver-1',
      storage,
    });
    expect(tog.ok).toBe(true);

    const ws1 = getPersonWorkspace({ householdId: hh.householdId, personId: p1.person.personId, actorId: 'caregiver-1', storage });
    const ws2 = getPersonWorkspace({ householdId: hh.householdId, personId: p2.person.personId, actorId: 'caregiver-1', storage });
    expect(ws1.person.applications[0].progress.checked).toEqual(['Hospital Discharge Slip']);
    expect(ws2.person.applications[0].progress.checked).toEqual([]);
  });

  it('enforces per-person scopes, consent revocation, and cross-profile authorization', () => {
    const storage = makeMemoryStorage();
    const hh = createHouseholdWorkspace({
      householdName: 'Rao Family',
      caregiverId: 'caregiver-1',
      storage,
    });

    const p1 = addPersonRecord({
      householdId: hh.householdId,
      actorId: 'caregiver-1',
      displayLabel: 'Adult Member',
      consentBasis: 'adult_explicit_consent',
      storage,
    });

    // Grant read-only scope to helper-2 for p1
    const scopeGrant = updatePersonConsent({
      householdId: hh.householdId,
      personId: p1.person.personId,
      actorId: 'caregiver-1',
      targetActorId: 'helper-2',
      scopes: ['read'],
      storage,
    });
    expect(scopeGrant.ok).toBe(true);

    // helper-2 can read, but cannot write/export/delete
    expect(getPersonWorkspace({ householdId: hh.householdId, personId: p1.person.personId, actorId: 'helper-2', storage }).ok).toBe(true);
    const blockedExport = exportPersonChecklist({ householdId: hh.householdId, personId: p1.person.personId, actorId: 'helper-2', storage });
    expect(blockedExport.ok).toBe(false);
    expect(blockedExport.code).toBe(403);

    // Unrelated caregiver-999 is completely blocked
    const crossProfile = getPersonWorkspace({ householdId: hh.householdId, personId: p1.person.personId, actorId: 'caregiver-999', storage });
    expect(crossProfile.ok).toBe(false);
    expect(crossProfile.code).toBe(403);

    // Revoke consent -> even caregiver-1 is blocked from reading/exporting until re-granted
    const revoked = updatePersonConsent({
      householdId: hh.householdId,
      personId: p1.person.personId,
      actorId: 'caregiver-1',
      consentStatus: 'revoked',
      storage,
    });
    expect(revoked.ok).toBe(true);
    const blockedAfterRevoke = getPersonWorkspace({ householdId: hh.householdId, personId: p1.person.personId, actorId: 'caregiver-1', storage });
    expect(blockedAfterRevoke.ok).toBe(false);
    expect(blockedAfterRevoke.code).toBe(403);

    // Delete still allowed for caregiver-1 with delete scope
    const del = deletePersonOrApplication({ householdId: hh.householdId, personId: p1.person.personId, actorId: 'caregiver-1', storage });
    expect(del.ok).toBe(true);

    const audit = getHouseholdAuditLog({ householdId: hh.householdId, actorId: 'caregiver-1', storage });
    expect(audit.ok).toBe(true);
    expect(audit.entries.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects forbidden PII (Aadhaar, PAN, OTP, password)', () => {
    const storage = makeMemoryStorage();
    expect(hasForbiddenPII('Aadhaar 1234 5678 9012')).toBe(true);
    expect(hasForbiddenPII({ otp: '123456' })).toBe(true);

    const hh = createHouseholdWorkspace({ householdName: 'Test', caregiverId: 'c1', storage });
    const badPerson = addPersonRecord({
      householdId: hh.householdId,
      actorId: 'c1',
      displayLabel: 'ABCDE1234F',
      storage,
    });
    expect(badPerson.ok).toBe(false);
    expect(badPerson.code).toBe(400);
  });
});
