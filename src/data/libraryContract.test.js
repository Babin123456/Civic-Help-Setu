import { describe, it, expect } from 'vitest';
import {
  validateLibraryRecord,
  validateLibraryDirectory,
  LIBRARY_TYPES,
  MEMBERSHIP_CATEGORIES,
  FORBIDDEN_LIBRARY_FIELDS,
} from './libraryContract';
import { VERIFIED_LIBRARY_FACILITIES } from './libraryFacilities';

describe('libraryContract validation (#727)', () => {
  const validRecord = {
    id: 'test-city-library',
    name: 'District City Public Library',
    libraryType: 'city_central_library',
    managingAuthority: 'Department of Public Libraries',
    jurisdiction: {
      level: 'district',
      states: ['Delhi'],
      districts: ['Central Delhi'],
      localBody: '',
    },
    address: '123 Main Library Lane, Connaught Place',
    district: 'Central Delhi',
    state: 'Delhi',
    pincode: '110001',
    coordinates: { lat: 28.6304, lng: 77.2177 },
    officialContact: {
      phone: ['011-23344556'],
      email: 'library@delhi.gov.in',
      portalUrl: 'https://library.delhi.gov.in',
      opacCatalogueUrl: 'https://opac.delhi.gov.in',
    },
    operatingHours: {
      hours: '09:00 AM - 07:00 PM',
      readingRoomHours: '09:00 AM - 08:00 PM',
    },
    membershipCategories: [
      {
        category: 'general_adult',
        eligibility: 'Residents of Delhi aged 18 and above',
        annualFee: 100,
        cautionDeposit: 200,
        isDepositRefundable: true,
        maxBooksAllowed: 2,
        loanPeriodDays: 14,
      },
      {
        category: 'student',
        eligibility: 'Bona fide students with institutional ID',
        annualFee: 50,
        cautionDeposit: 100,
        isDepositRefundable: true,
        maxBooksAllowed: 3,
        loanPeriodDays: 14,
      },
    ],
    statutoryCharges: {
      isFree: false,
      feeSchedule: [{ item: 'Annual Adult Membership', amount: 100 }],
      cautionDeposit: { amount: 200, refundable: true },
      lateFinesPerDay: 1,
    },
    renewalRules: {
      loanPeriodDays: 14,
      maxRenewalsAllowed: 2,
      onlineRenewalAvailable: true,
      renewalWindowDays: 3,
    },
    digitalLearningResources: [
      {
        name: 'National Digital Library of India (NDLI)',
        provider: 'Ministry of Education',
        accessType: 'open_access',
        url: 'https://ndl.iitkgp.ac.in',
        description: 'Open public academic repository',
      },
    ],
    requiredDocuments: [
      { name: 'Photo ID', type: 'required' },
      { name: 'Student ID', type: 'conditional', condition: 'For student concession' },
    ],
    accessibility: {
      wheelchairAccessible: true,
      brailleSection: true,
      screenReaderWorkstations: true,
      audioBooksAvailable: true,
    },
    auditMetadata: {
      sourceUrl: 'https://delhi.gov.in/gazette/libraries',
      effectiveDate: '2024-01-01',
      lastVerified: '2026-10-01',
      verifiedBy: 'State Library Directorate',
    },
  };

  it('passes on a valid library record', () => {
    const errors = validateLibraryRecord(validRecord);
    expect(errors).toEqual([]);
  });

  it('rejects forbidden personal fields (citizen privacy protection)', () => {
    FORBIDDEN_LIBRARY_FIELDS.forEach((forbiddenField) => {
      const contaminated = { ...validRecord, [forbiddenField]: 'sensitive_data' };
      const errors = validateLibraryRecord(contaminated);
      expect(errors.some((e) => e.field === forbiddenField)).toBe(true);
    });
  });

  it('strictly rejects speculative live seat claims', () => {
    const liveSeatRecord = {
      ...validRecord,
      liveSeats: 42,
      availableSeats: 5,
    };
    const errors = validateLibraryRecord(liveSeatRecord);
    expect(errors.some((e) => e.field.includes('liveSeats'))).toBe(true);
    expect(errors.some((e) => e.field.includes('availableSeats'))).toBe(true);
  });

  it('validates required fields: id, name, libraryType, managingAuthority, auditMetadata', () => {
    const badRecord = { id: 'BAD ID WITH SPACES', libraryType: 'unknown_type' };
    const errors = validateLibraryRecord(badRecord);
    expect(errors.some((e) => e.field === 'id')).toBe(true);
    expect(errors.some((e) => e.field === 'name')).toBe(true);
    expect(errors.some((e) => e.field === 'libraryType')).toBe(true);
    expect(errors.some((e) => e.field === 'managingAuthority')).toBe(true);
    expect(errors.some((e) => e.field === 'auditMetadata')).toBe(true);
  });

  it('enforces dated official HTTPS source URL in auditMetadata', () => {
    const insecureSource = {
      ...validRecord,
      auditMetadata: {
        sourceUrl: 'http://insecure-source.com',
        effectiveDate: 'invalid-date',
        lastVerified: '2024-01-01',
        verifiedBy: 'Tester',
      },
    };
    const errors = validateLibraryRecord(insecureSource);
    expect(errors.some((e) => e.field === 'auditMetadata.sourceUrl')).toBe(true);
    expect(errors.some((e) => e.field === 'auditMetadata.effectiveDate')).toBe(true);
  });

  it('validates conditional documents require a condition description', () => {
    const missingCondition = {
      ...validRecord,
      requiredDocuments: [{ name: 'Income Proof', type: 'conditional' }],
    };
    const errors = validateLibraryRecord(missingCondition);
    expect(errors.some((e) => e.field === 'requiredDocuments[0].condition')).toBe(true);
  });

  it('validates entire directory envelope and catches duplicates', () => {
    const dir = [validRecord, { ...validRecord }];
    const res = validateLibraryDirectory(dir);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'id' && e.reason.includes('duplicate'))).toBe(true);
  });

  it('validates every seed library in VERIFIED_LIBRARY_FACILITIES', () => {
    const res = validateLibraryDirectory(VERIFIED_LIBRARY_FACILITIES);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
    expect(VERIFIED_LIBRARY_FACILITIES.length).toBeGreaterThanOrEqual(5);
  });
});

