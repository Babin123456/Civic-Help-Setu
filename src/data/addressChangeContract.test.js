import { describe, it, expect } from 'vitest';
import {
  validateAddressChangeRecord,
  validateAddressChangeCatalog,
  FORBIDDEN_ADDRESS_PLANNER_FIELDS,
} from './addressChangeContract';
import { VERIFIED_ADDRESS_CHANGE_RECORDS } from './addressChangeRecords';

describe('addressChangeContract validation (#725)', () => {
  const validRecord = {
    id: 'aadhaar-address-update',
    name: 'Aadhaar Address Update (Online / myAadhaar)',
    recordType: 'aadhaar',
    authority: {
      name: 'Unique Identification Authority of India (UIDAI)',
      jurisdictionLevel: 'national',
      portalUrl: 'https://myaadhaar.uidai.gov.in',
    },
    applicableMoveTypes: ['same_city', 'inter_district', 'inter_state'],
    dependencyOrder: 1,
    prerequisites: [],
    acceptedProofs: [
      {
        proofType: 'rent_agreement',
        name: 'Registered Rent / Lease Agreement',
        issuingAuthority: 'Sub-Registrar Office',
        description: 'Registered rental agreement in applicant name with new address.',
      },
    ],
    officialInstructions: 'Under Regulation 3 of Aadhaar (Enrolment and Update) Regulations, 2016, residents can update address online by uploading valid supporting documents.',
    editorialNotes: 'Update your Aadhaar address first. An updated Aadhaar card acts as a widely accepted Proof of Address (POA) for other department records.',
    sourceUrl: 'https://uidai.gov.in/en/my-aadhaar/about-your-aadhaar/updating-data-on-aadhaar.html',
    effectiveDate: '2024-01-15',
    lastVerified: '2026-03-01',
    unavailableData: {
      isUnavailable: false,
      reason: null,
      unverifiedFields: [],
    },
  };

  it('passes on a valid address change record', () => {
    const errors = validateAddressChangeRecord(validRecord);
    expect(errors).toEqual([]);
  });

  it('rejects forbidden citizen credentials and sensitive personal keys', () => {
    for (const key of FORBIDDEN_ADDRESS_PLANNER_FIELDS) {
      const cloned = { ...validRecord, [key]: 'secret123' };
      const errors = validateAddressChangeRecord(cloned);
      expect(errors.some((e) => e.field === key)).toBe(true);
    }
  });

  it('rejects invalid or non-https authority portal and source URLs', () => {
    const invalidPortal = {
      ...validRecord,
      authority: { ...validRecord.authority, portalUrl: 'http://insecure-portal.gov.in' },
    };
    expect(validateAddressChangeRecord(invalidPortal).length).toBeGreaterThan(0);

    const invalidSource = {
      ...validRecord,
      sourceUrl: 'ftp://files.gov.in/update.pdf',
    };
    expect(validateAddressChangeRecord(invalidSource).length).toBeGreaterThan(0);
  });

  it('requires explicit unavailable rationale when isUnavailable is true', () => {
    const missingRationale = {
      ...validRecord,
      unavailableData: {
        isUnavailable: true,
        reason: null,
        unverifiedFields: ['inter_state_online_portal'],
      },
    };
    const errors = validateAddressChangeRecord(missingRationale);
    expect(errors.some((e) => e.field === 'unavailableData.reason')).toBe(true);
  });

  it('validates catalog array and catches duplicate IDs', () => {
    const catalog = [
      validRecord,
      { ...validRecord, name: 'Duplicate Record' },
    ];
    const errors = validateAddressChangeCatalog(catalog);
    expect(errors.some((e) => e.reason.includes('duplicate id'))).toBe(true);
  });

  it('validates every seed record in VERIFIED_ADDRESS_CHANGE_RECORDS without errors', () => {
    expect(VERIFIED_ADDRESS_CHANGE_RECORDS.length).toBeGreaterThanOrEqual(4);
    const errors = validateAddressChangeCatalog(VERIFIED_ADDRESS_CHANGE_RECORDS);
    expect(errors).toEqual([]);
  });
});

