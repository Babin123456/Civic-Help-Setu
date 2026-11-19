import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEE_VERSION_STATUS,
  FEE_COMPONENT_TYPES,
  COMMUNITY_OBSERVATION_STATUS,
  RECEIPT_REDACTION_DEFAULT,
  JURISDICTION_LEVELS,
  createVersionedFeeRecord,
  createGovernmentFee,
  createPortalCharge,
  createAuthorisedCentreCharge,
  createOptionalServiceCharge,
  validateVersionedFeeRecord,
  createFeeFingerprint,
  getFeeHistory,
  recordFeeVersion,
  getFeeVersion,
  getApplicableFeeVersion,
  listVerifiedServices,
  resetFeeEvidenceAssistantData,
  redactReceiptText,
  createReceiptEvidence,
  correctOcrText,
  detectOcrCorrections,
  inferFeeComponentType,
  parseReceiptText,
  generateDiscrepancyReport,
  getGrievanceRoute,
  containsPaymentCredentials,
  createCommunityFeeObservation,
  moderateCommunityObservation,
  getModeratedObservations,
  getPendingCommunityObservations,
} from './nationalPublicServiceCentreService';

const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorageMock();
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

const baseRecord = (overrides = {}) => ({
  serviceId: 'passport',
  componentType: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
  authority: 'Ministry of External Affairs',
  jurisdiction: 'national',
  effectiveDate: '2024-01-01',
  source: 'https://www.passportindia.gov.in',
  verificationDate: '2024-06-15',
  amount: 1500,
  isMandatory: true,
  status: FEE_VERSION_STATUS.PUBLISHED,
  currency: 'INR',
  label: 'Standard Adult Passport Fee (36 Pages)',
  ...overrides,
});

beforeEach(() => {
  globalThis.localStorage?.clear?.();
  resetFeeEvidenceAssistantData();
});

// ============================================================
// VERSIONED FEE RECORDS
// ============================================================

describe('Versioned fee records', () => {
  it('exposes the required status, component, and jurisdiction constants', () => {
    expect(FEE_VERSION_STATUS.PUBLISHED).toBe('published');
    expect(FEE_VERSION_STATUS.FREE).toBe('free');
    expect(FEE_VERSION_STATUS.UNVERIFIED).toBe('unverified');
    expect(FEE_VERSION_STATUS.OBSOLETE).toBe('obsolete');

    expect(FEE_COMPONENT_TYPES.GOVERNMENT_FEE).toBe('government_fee');
    expect(FEE_COMPONENT_TYPES.PORTAL_CHARGE).toBe('portal_charge');
    expect(FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE).toBe(
      'authorised_centre_charge',
    );
    expect(FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE).toBe(
      'optional_service_charge',
    );

    expect(JURISDICTION_LEVELS).toEqual([
      'national',
      'state',
      'district',
      'local',
    ]);
  });

  it('creates a valid government fee record with an audit-ready id', () => {
    const record = createGovernmentFee({
      serviceId: 'passport',
      authority: 'Ministry of External Affairs',
      jurisdiction: 'national',
      effectiveDate: '2024-01-01',
      source: 'https://www.passportindia.gov.in',
      verificationDate: '2024-06-15',
      amount: 1500,
      label: 'Standard Adult Passport Fee (36 Pages)',
    });

    expect(record.serviceId).toBe('passport');
    expect(record.componentType).toBe('government_fee');
    expect(record.jurisdiction).toBe('national');
    expect(record.amount).toBe(1500);
    expect(record.status).toBe('published');
    expect(record.currency).toBe('INR');
    expect(record.id).toMatch(/^fee-passport-government-fee-\d+$/);
    expect(record.fingerprint).toMatch(/^fee-[0-9a-f]{8}$/);
    expect(record.createdAt).toBeDefined();
    expect(record.validationErrors).toBeUndefined();
  });

  it('lets the component helpers record an explicitly obsolete version', () => {
    const record = createGovernmentFee(
      baseRecord({ status: FEE_VERSION_STATUS.OBSOLETE }),
    );
    expect(record.status).toBe('obsolete');
  });

  it('creates portal, authorised-centre, and optional charge records separately', () => {
    const portal = createPortalCharge({
      ...baseRecord(),
      serviceId: 'driving-license',
      amount: 30,
      label: 'Online portal convenience charge',
    });
    const centre = createAuthorisedCentreCharge({
      ...baseRecord(),
      serviceId: 'pan-card',
      amount: 50,
      label: 'CSC scanning and upload charge',
    });
    const optional = createOptionalServiceCharge({
      ...baseRecord(),
      serviceId: 'aadhaar-card',
      amount: 50,
      label: 'Optional SMS updates',
    });

    expect(portal.componentType).toBe('portal_charge');
    expect(centre.componentType).toBe('authorised_centre_charge');
    expect(optional.componentType).toBe('optional_service_charge');
  });

  it('preserves supplementary metadata and creates a stable fingerprint', () => {
    const record = createVersionedFeeRecord({
      ...baseRecord(),
      amount: 100,
      supplementary: { notificationNumber: 'G.S.R. 123(E)' },
    });
    const same = createFeeFingerprint({ ...record });
    const changed = createFeeFingerprint({ ...record, amount: 200 });

    expect(record.notificationNumber).toBe('G.S.R. 123(E)');
    expect(same).toBe(record.fingerprint);
    expect(changed).not.toBe(record.fingerprint);
  });

  it('passes validation for a complete record', () => {
    const result = validateVersionedFeeRecord(baseRecord());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing or malformed required fields', () => {
    const cases = [
      [{ serviceId: '' }, 'serviceId'],
      [{ componentType: 'invalid_type' }, 'componentType'],
      [{ authority: '' }, 'authority'],
      [{ jurisdiction: 'invalid_level' }, 'jurisdiction'],
      [{ jurisdiction: 'state' }, 'state is required'],
      [{ jurisdiction: 'district', state: 'Delhi' }, 'district is required'],
      [
        { jurisdiction: 'local', state: 'Delhi', district: 'New Delhi' },
        'localBody is required',
      ],
      [{ effectiveDate: '01/15/2024' }, 'effectiveDate'],
      [{ effectiveDate: '2024-02-31' }, 'effectiveDate'],
      [{ source: 'ftp://invalid.example' }, 'source'],
      [{ verificationDate: '' }, 'verificationDate'],
      [{ verificationDate: '2024-13-40' }, 'verificationDate'],
      [{ amount: -50 }, 'non-negative'],
      [{ amount: Number.NaN }, 'non-negative'],
      [{ status: 'invented' }, 'status'],
      [{ currency: 'IN' }, '3-letter'],
      [{ version: 0 }, 'version'],
    ];

    cases.forEach(([overrides, expected]) => {
      const result = validateVersionedFeeRecord(baseRecord(overrides));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes(expected))).toBe(true);
    });
  });

  it('rejects effective dates more than 365 days in the future', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);
    const result = validateVersionedFeeRecord(
      baseRecord({ effectiveDate: future.toISOString().slice(0, 10) }),
    );

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((error) => error.includes('365 days in the future')),
    ).toBe(true);
  });

  it('rejects verification dates in the future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const result = validateVersionedFeeRecord(
      baseRecord({ verificationDate: future.toISOString().slice(0, 10) }),
    );

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((error) => error.includes('cannot be in the future')),
    ).toBe(true);
  });

  it('marks invalid created records instead of throwing', () => {
    const record = createGovernmentFee(
      baseRecord({ jurisdiction: 'invalid-level' }),
    );
    expect(record.validationErrors).toBeDefined();
    expect(record.validationErrors.length).toBeGreaterThan(0);
  });
});

// ============================================================
// FEE HISTORY AND JURISDICTION VARIANTS
// ============================================================

describe('Fee history and jurisdiction variants', () => {
  it('versions fee changes instead of overwriting them', () => {
    const first = recordFeeVersion(
      createGovernmentFee(baseRecord({ amount: 1500 })),
      { actor: 'fee-admin', reason: 'Initial publication' },
    );
    const second = recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 2000,
          effectiveDate: '2026-01-01',
          verificationDate: '2026-01-02',
        }),
      ),
      { actor: 'fee-admin', reason: 'Gazette revision' },
    );

    expect(first.success).toBe(true);
    expect(first.version).toBe(1);
    expect(second.success).toBe(true);
    expect(second.version).toBe(2);

    const history = getFeeHistory('passport', { includeBaseline: false });
    expect(history).toHaveLength(2);
    expect(history[0].amount).toBe(2000);
    expect(history[0].version).toBe(2);
    expect(history[0].auditTrail.at(-1).action).toBe('version-recorded');
    expect(history[0].auditTrail.at(-1).actor).toBe('fee-admin');
    expect(history[1].amount).toBe(1500);
  });

  it('rejects invalid versions without storing them', () => {
    const result = recordFeeVersion(baseRecord({ amount: -1 }));
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(getFeeHistory('passport', { includeBaseline: false })).toEqual([]);
  });

  it('reads one recorded version by number', () => {
    recordFeeVersion(createGovernmentFee(baseRecord()));
    expect(getFeeVersion('passport', 1)?.amount).toBe(1500);
    expect(getFeeVersion('passport', 99)).toBeNull();
  });

  it('exposes the published schedule as auditable baseline versions', () => {
    const history = getFeeHistory('passport');
    expect(history.length).toBeGreaterThan(0);

    const baseline = history.find(
      (record) =>
        record.origin === 'dataset' &&
        record.label.includes('Standard Adult Passport Fee'),
    );
    expect(baseline).toBeDefined();
    expect(baseline.version).toBe(0);
    expect(baseline.authority).toContain('External Affairs');
    expect(baseline.effectiveDate).toBe('2024-01-01');
    expect(baseline.verificationDate).toBe('2026-07-10');
    expect(baseline.source).toBe('https://www.passportindia.gov.in');
    expect(baseline.auditTrail[0].action).toBe('dataset-import');
  });

  it('resolves the applicable version by effective date', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 1500,
          effectiveDate: '2024-01-01',
          verificationDate: '2024-01-02',
        }),
      ),
    );
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 2000,
          effectiveDate: '2026-01-01',
          verificationDate: '2026-01-02',
        }),
      ),
    );

    expect(
      getApplicableFeeVersion('passport', { effectiveDate: '2025-06-01' })?.amount,
    ).toBe(1500);
    expect(
      getApplicableFeeVersion('passport', { effectiveDate: '2026-06-01' })?.amount,
    ).toBe(2000);
  });

  it('prefers a state version over the national baseline', () => {
    const stateVersion = createGovernmentFee(
      baseRecord({
        authority: 'Delhi Fee Authority',
        jurisdiction: 'state',
        state: 'Delhi',
        amount: 1600,
        effectiveDate: '2025-01-01',
        verificationDate: '2025-01-02',
        source: 'https://delhi.gov.in/fees',
        label: 'Standard Adult Passport Fee',
      }),
    );
    recordFeeVersion(stateVersion);

    const applicable = getApplicableFeeVersion('passport', {
      jurisdiction: 'state',
      state: 'Delhi',
      effectiveDate: '2026-01-01',
    });
    expect(applicable.jurisdiction).toBe('state');
    expect(applicable.state).toBe('Delhi');
    expect(applicable.amount).toBe(1600);

    const nationalOnly = getApplicableFeeVersion('passport', {
      jurisdiction: 'national',
      effectiveDate: '2026-01-01',
    });
    expect(nationalOnly.jurisdiction).toBe('national');
  });

  it('does not apply a state version to a different state', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          jurisdiction: 'state',
          state: 'Delhi',
          amount: 1600,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
        }),
      ),
    );

    const applicable = getApplicableFeeVersion('passport', {
      jurisdiction: 'state',
      state: 'Kerala',
      effectiveDate: '2026-01-01',
    });
    expect(applicable.jurisdiction).toBe('national');
  });

  it('does not apply a state version when no State/UT was selected', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          jurisdiction: 'state',
          state: 'Delhi',
          amount: 1600,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
        }),
      ),
    );

    const applicable = getApplicableFeeVersion('passport', {
      jurisdiction: 'state',
      effectiveDate: '2026-01-01',
    });
    expect(applicable.jurisdiction).toBe('national');
    expect(applicable.amount).toBe(1500);
  });

  it('only applies a district version when the district matches', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          jurisdiction: 'district',
          state: 'Delhi',
          district: 'New Delhi',
          amount: 1700,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
        }),
      ),
    );

    const withoutDistrict = getApplicableFeeVersion('passport', {
      jurisdiction: 'district',
      state: 'Delhi',
      effectiveDate: '2026-01-01',
    });
    expect(withoutDistrict.amount).toBe(1500);

    const withDistrict = getApplicableFeeVersion('passport', {
      jurisdiction: 'district',
      state: 'Delhi',
      district: 'New Delhi',
      effectiveDate: '2026-01-01',
    });
    expect(withDistrict.amount).toBe(1700);
    expect(withDistrict.district).toBe('New Delhi');
  });

  it('ignores obsolete versions', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 8888,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
          status: FEE_VERSION_STATUS.OBSOLETE,
        }),
      ),
    );
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 1600,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
        }),
      ),
    );

    const applicable = getApplicableFeeVersion('passport', {
      effectiveDate: '2026-01-01',
    });
    expect(applicable.amount).toBe(1600);
    expect(applicable.version).toBe(2);
  });

  it('lists verified services and excludes unverified test fixtures', () => {
    const services = listVerifiedServices();
    expect(services.some((service) => service.serviceId === 'passport')).toBe(
      true,
    );
    expect(
      services.some((service) => service.serviceId === 'aadhaar-card'),
    ).toBe(true);
    expect(
      services.some((service) => service.serviceId === 'test-expired-scheme'),
    ).toBe(false);
  });
});

// ============================================================
// RECEIPT REDACTION
// ============================================================

describe('Receipt redaction', () => {
  it('redacts receipt identifiers by default', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'passport',
      rawText: 'Receipt for Rs. 1,500',
      receiptId: 'ARN-98234710',
      jurisdiction: 'national',
      captureDate: '2026-01-15',
    });

    expect(RECEIPT_REDACTION_DEFAULT).toBe(true);
    expect(receipt.receiptId).toBe('REDACTED');
    expect(receipt.metadata.redactionApplied).toBe(true);
    expect(receipt.rawText).not.toContain('ARN-98234710');
  });

  it('redacts identifiers found inside pasted receipt text', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'passport',
      rawText:
        'Receipt No: REC-12345678, mobile +91 9876543210, email citizen@example.org, Aadhaar 1234 5678 9012, PAN ABCDE1234F',
      feeComponents: [{ label: 'Passport Fee', amount: 1500 }],
      jurisdiction: 'national',
    });

    expect(receipt.rawText).not.toContain('REC-12345678');
    expect(receipt.rawText).not.toContain('9876543210');
    expect(receipt.rawText).not.toContain('citizen@example.org');
    expect(receipt.rawText).not.toContain('1234 5678 9012');
    expect(receipt.rawText).not.toContain('ABCDE1234F');
    expect(receipt.rawText).toContain('[REDACTED:');
    expect(receipt.metadata.redactedIdentifiers).toBeGreaterThanOrEqual(5);
    expect(receipt.metadata.redactedTypes).toEqual(
      expect.arrayContaining(['email', 'aadhaar', 'mobile', 'pan']),
    );
  });

  it('redacts payment credentials found in receipt text instead of storing them', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'passport',
      rawText:
        'Paid by card 4111 1111 1111 1111, CVV 123, UPI citizen@okhdfcbank, IFSC SBIN0001234',
      feeComponents: [{ label: 'Passport Fee', amount: 1500 }],
      jurisdiction: 'national',
    });

    expect(receipt.rawText).not.toContain('4111 1111 1111 1111');
    expect(receipt.rawText).not.toContain('CVV 123');
    expect(receipt.rawText).not.toContain('citizen@okhdfcbank');
    expect(receipt.rawText).not.toContain('SBIN0001234');
    expect(receipt.metadata.redactedTypes).toEqual(
      expect.arrayContaining([
        'payment-card',
        'payment-secret',
        'upi-id',
        'ifsc',
      ]),
    );
  });

  it('redacts any UPI handle and lower-case IFSC code', () => {
    const result = redactReceiptText(
      'Paid via asha@axl and IFSC sbin0001234',
    );

    expect(result.redactedText).not.toContain('asha@axl');
    expect(result.redactedText).not.toContain('sbin0001234');
    expect(result.redactedTypes).toEqual(
      expect.arrayContaining(['upi-id', 'ifsc']),
    );
    expect(containsPaymentCredentials('asha@axl')).toBe(true);
    expect(containsPaymentCredentials('IFSC sbin0001234')).toBe(true);
  });

  it('can preserve an identifier only with explicit opt-in', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'passport',
      rawText: 'Receipt for ARN-12345678',
      receiptId: 'ARN-12345678',
      redactIdentifiers: false,
      jurisdiction: 'national',
    });

    expect(receipt.receiptId).toBe('ARN-12345678');
    expect(receipt.rawText).toContain('ARN-12345678');
    expect(receipt.metadata.redactionApplied).toBe(false);
  });

  it('returns redaction categories without leaking the original values', () => {
    const result = redactReceiptText(
      'Call 9876543210 or email user@example.org about ABCDE1234F',
    );
    expect(result.redactionCount).toBe(3);
    expect(result.redactedTypes).toEqual(
      expect.arrayContaining(['mobile', 'email', 'pan']),
    );
    expect(result.redactedText).not.toContain('9876543210');
    expect(result.redactedText).not.toContain('user@example.org');
    expect(result.redactedText).not.toContain('ABCDE1234F');
  });

  it('stores normalized component amounts and labels', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'pan-card',
      feeComponents: [
        { label: 'Statutory Fee', amount: 107 },
        { label: 'CSC Scanning', amount: '50' },
        { label: 'Broken', amount: 'not-a-number' },
      ],
      jurisdiction: 'national',
    });

    expect(receipt.feeComponents).toHaveLength(3);
    expect(receipt.feeComponents[0].amount).toBe(107);
    expect(receipt.feeComponents[1].amount).toBe(50);
    expect(receipt.feeComponents[2].amount).toBe(0);
  });
});

// ============================================================
// OCR CORRECTION AND PARSING
// ============================================================

describe('OCR correction and receipt parsing', () => {
  it('repairs digit confusions without changing words', () => {
    const corrected = correctOcrText(
      'Standard Adult Passport Fee Rs. 1,5O0 and ₹2OO',
    );
    expect(corrected).toContain('1,500');
    expect(corrected).toContain('₹200');
    expect(corrected).toContain('Passport');
  });

  it('reports every correction for user review', () => {
    const corrections = detectOcrCorrections('Fee 1,5O0 and 2OO');
    expect(corrections).toEqual(
      expect.arrayContaining([
        { original: '1,5O0', corrected: '1,500' },
        { original: '2OO', corrected: '200' },
      ]),
    );
  });

  it('corrects the number but keeps a currency prefix intact', () => {
    expect(correctOcrText('INR1,5O0 and Rs.2OO')).toBe('INR1,500 and Rs.200');
    expect(detectOcrCorrections('INR1,5O0')).toEqual([
      { original: 'INR1,5O0', corrected: 'INR1,500' },
    ]);
  });

  it('parses charges, applies OCR corrections, and ignores totals', () => {
    const parsed = parseReceiptText(
      [
        'Passport Fee Rs. 1,5O0',
        'SMS Updates Rs. 5O',
        'Total Rs. 1,550',
        'Receipt No: REC-12345678',
        'Date 15/01/2026',
      ].join('\n'),
    );

    expect(parsed.corrections).toHaveLength(2);
    expect(parsed.components).toHaveLength(2);
    expect(parsed.components[0]).toMatchObject({
      label: 'Passport Fee',
      amount: 1500,
      componentType: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
    });
    expect(parsed.components[1]).toMatchObject({
      label: 'SMS Updates',
      amount: 50,
      componentType: FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
    });
    expect(parsed.warnings.some((warning) => warning.includes('Total'))).toBe(
      true,
    );
    expect(parsed.correctedText).toContain('1,500');
    expect(parsed.correctedText).not.toContain('1,5O0');
  });

  it('cleans separators from parsed labels', () => {
    const parsed = parseReceiptText('Smart Card Fee - ₹2OO');
    expect(parsed.components).toHaveLength(1);
    expect(parsed.components[0].label).toBe('Smart Card Fee');
    expect(parsed.components[0].amount).toBe(200);
  });

  it('parses charge labels that begin with header-like words', () => {
    const parsed = parseReceiptText(
      ['Name Change Fee Rs. 5OO', 'Address Correction Fee Rs. 2OO'].join('\n'),
    );

    expect(parsed.components).toHaveLength(2);
    expect(parsed.components[0]).toMatchObject({
      label: 'Name Change Fee',
      amount: 500,
    });
    expect(parsed.components[1]).toMatchObject({
      label: 'Address Correction Fee',
      amount: 200,
    });
  });

  it('still skips identifier, phone, and date header lines', () => {
    const parsed = parseReceiptText(
      [
        'Receipt No: REC-12345678',
        'Mobile 9876543210',
        'Date 15/01/2026',
        'Passport Fee Rs. 1,500',
      ].join('\n'),
    );

    expect(parsed.components).toHaveLength(1);
    expect(parsed.components[0].label).toBe('Passport Fee');
    expect(parsed.components[0].amount).toBe(1500);
  });

  it('uses configurable component-type suggestions but never claims a match', () => {
    expect(inferFeeComponentType('Optional SMS alerts')).toBe(
      FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
    );
    expect(inferFeeComponentType('Online portal charge')).toBe(
      FEE_COMPONENT_TYPES.PORTAL_CHARGE,
    );
    expect(inferFeeComponentType('State fee')).toBe(
      FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
    );
    expect(inferFeeComponentType('Mystery amount')).toBe('unknown');

    const parsed = parseReceiptText('Mystery amount 999');
    expect(parsed.components[0].componentType).toBe('unknown');
    expect(parsed.components[0].requiresReview).toBe(true);
  });
});

// ============================================================
// DISCREPANCY REPORTS
// ============================================================

describe('Discrepancy reports', () => {
  const passportReceipt = (components) =>
    createReceiptEvidence({
      serviceId: 'passport',
      rawText: 'Passport receipt',
      feeComponents: components,
      jurisdiction: 'national',
    });

  it('labels every component unverified when no verified schedule exists', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
        { label: 'SMS Updates', amount: 50 },
      ]),
      'unknown-service',
    );

    expect(report.overallMatch).toBe('unverified');
    expect(report.isOfficialScheduleApplicable).toBe(false);
    expect(report.summary.componentsUnverified).toBe(2);
    expect(report.summary.totalCharged).toBe(1550);
    expect(report.componentComparisons).toHaveLength(2);
    report.componentComparisons.forEach((comparison) => {
      expect(comparison.status).toBe('unverified');
      expect(comparison.officialAmount).toBeNull();
      expect(comparison.discrepancy).toContain(
        'No overcharge conclusion is drawn',
      );
    });
    expect(JSON.stringify(report)).not.toMatch(/illegal/i);
  });

  it('labels an expired schedule unverified rather than overcharged', () => {
    const receipt = passportReceipt([
      { label: 'Anything', amount: 99999 },
    ]);
    const report = generateDiscrepancyReport(receipt, 'test-expired-scheme');

    expect(report.overallMatch).toBe('unverified');
    expect(report.summary.componentsUnverified).toBe(1);
    expect(report.warnings[0]).toContain('past its review window');
  });

  it('does not compare a receipt date with a schedule that was not effective then', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
      ]),
      'passport',
      { checkDate: '2023-06-01' },
    );

    expect(report.overallMatch).toBe('unverified');
    expect(report.isOfficialScheduleApplicable).toBe(false);
    expect(report.summary.componentsUnverified).toBe(1);
    expect(report.componentComparisons[0].officialAmount).toBeNull();
    expect(report.warnings[0]).toContain('No official fee version is effective');
  });

  it('matches a component against the published passport schedule', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
        { label: 'SMS Updates', amount: 50 },
      ]),
      'passport',
    );

    expect(report.isOfficialScheduleApplicable).toBe(true);
    expect(report.summary.totalCharged).toBe(1550);
    expect(report.summary.totalOfficial).toBe(1500);
    expect(report.summary.componentsMatched).toBe(1);
    expect(report.summary.componentsUnverified).toBe(1);
    expect(report.overallMatch).toBe('partial-match');

    const matched = report.componentComparisons[0];
    expect(matched.status).toBe('matched');
    expect(matched.officialAmount).toBe(1500);
    expect(matched.officialSource).toContain('Passport');
    expect(matched.officialSourceUrl).toBe('https://www.passportindia.gov.in');
    expect(matched.officialVerificationDate).toBe('2026-07-10');
    expect(matched.officialFeeVersion).toBe(0);
    expect(matched.officialAuthority).toContain('External Affairs');
    expect(matched.redactionApplied).toBe(true);
    expect(report.officialSchedule.name).toContain('Passport Rules');
    expect(report.officialSchedule.url).toBe(
      'https://www.passportindia.gov.in',
    );
    expect(report.officialSchedule.effectiveDate).toBe('2024-01-01');
  });

  it('detects an overcharge relative to the published fee', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 2000 },
      ]),
      'passport',
    );

    expect(report.overallMatch).toBe('overcharged');
    expect(report.summary.totalOvercharge).toBe(500);
    expect(report.summary.componentsOvercharged).toBe(1);
    expect(report.componentComparisons[0].status).toBe('overcharged');
    expect(report.componentComparisons[0].discrepancy).toContain(
      'Above the published fee',
    );
    expect(JSON.stringify(report)).not.toMatch(/illegal|unlawful/i);
  });

  it('detects an undercharge without treating it as a full match', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1000 },
      ]),
      'passport',
    );

    expect(report.overallMatch).toBe('undercharged');
    expect(report.summary.componentsUndercharged).toBe(1);
    expect(report.componentComparisons[0].status).toBe('undercharged');
    expect(report.componentComparisons[0].discrepancy).toContain(
      'Below the published fee',
    );
  });

  it('uses the newest applicable version instead of matching an old amount', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 1500,
          effectiveDate: '2024-01-01',
          verificationDate: '2024-01-02',
        }),
      ),
    );
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          amount: 2000,
          effectiveDate: '2026-01-01',
          verificationDate: '2026-01-02',
        }),
      ),
    );

    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
      ]),
      'passport',
      { checkDate: '2026-06-01' },
    );

    expect(report.componentComparisons[0].officialAmount).toBe(2000);
    expect(report.componentComparisons[0].officialFeeVersion).toBe(2);
    expect(report.componentComparisons[0].status).toBe('undercharged');
  });

  it('keeps a mixed undercharge and unknown component at partial-match', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1000 },
        { label: 'Mystery Surcharge', amount: 999 },
      ]),
      'passport',
    );

    expect(report.summary.componentsUndercharged).toBe(1);
    expect(report.summary.componentsUnverified).toBe(1);
    expect(report.overallMatch).toBe('partial-match');
  });

  it('inherits jurisdiction and district from the receipt when options omit them', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          jurisdiction: 'district',
          state: 'Delhi',
          district: 'New Delhi',
          amount: 1700,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
          source: 'https://delhi.gov.in/fees',
          label: 'Standard Adult Passport Fee',
          supplementary: { sourceName: 'Delhi District Fee Notification' },
        }),
      ),
    );

    const receipt = createReceiptEvidence({
      serviceId: 'passport',
      jurisdiction: 'district',
      state: 'Delhi',
      district: 'New Delhi',
      feeComponents: [
        { label: 'Standard Adult Passport Fee', amount: 1700 },
      ],
    });
    const report = generateDiscrepancyReport(receipt, 'passport', {
      checkDate: '2026-01-01',
    });

    expect(report.jurisdiction).toBe('district');
    expect(report.district).toBe('New Delhi');
    expect(report.componentComparisons[0].officialAmount).toBe(1700);
    expect(report.componentComparisons[0].status).toBe('matched');
    expect(report.officialSchedule.name).toBe('Delhi District Fee Notification');
    expect(report.officialSchedule.url).toBe('https://delhi.gov.in/fees');
  });

  it('accepts a small rounding tolerance', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([{ label: 'Standard Adult Passport Fee', amount: 1503 }]),
      'passport',
    );

    expect(report.componentComparisons[0].status).toBe('matched');
    expect(report.summary.totalOvercharge).toBe(0);
  });

  it('handles mixed matched and unknown components', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'driving-license',
      feeComponents: [
        { label: 'Driving Test Fee', amount: 300 },
        { label: 'Unknown Service', amount: 999 },
      ],
      jurisdiction: 'state',
    });
    const report = generateDiscrepancyReport(receipt, 'driving-license');

    expect(report.summary.componentsMatched).toBe(1);
    expect(report.summary.componentsUnverified).toBe(1);
    expect(report.summary.componentsUnmatched).toBe(1);
    expect(report.overallMatch).toBe('partial-match');

    const unknown = report.componentComparisons.find(
      (comparison) => comparison.chargedAmount === 999,
    );
    expect(unknown.status).toBe('unverified');
    expect(unknown.discrepancy).toContain('No official match found');
  });

  it('reports partial-overcharge when only some verified charges are above the schedule', () => {
    const report = generateDiscrepancyReport(
      passportReceipt([
        {
          label: 'Jumbo Adult Passport (60 Pages, 10 Years Validity)',
          amount: 2500,
        },
        { label: 'Standard Adult Passport Fee (36 Pages)', amount: 1000 },
      ]),
      'passport',
    );

    expect(report.summary.componentsOvercharged).toBe(1);
    expect(report.summary.componentsUndercharged).toBe(1);
    expect(report.summary.totalOvercharge).toBe(500);
    expect(report.summary.totalUndercharge).toBe(500);
    expect(report.overallMatch).toBe('partial-overcharge');
  });

  it('applies a recorded state fee version when jurisdiction matches', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          authority: 'Delhi Fee Authority',
          jurisdiction: 'state',
          state: 'Delhi',
          amount: 1600,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
          source: 'https://delhi.gov.in/fees',
          label: 'Standard Adult Passport Fee',
          supplementary: { sourceName: 'Delhi State Fee Notification' },
        }),
      ),
    );

    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
      ]),
      'passport',
      { jurisdiction: 'state', state: 'Delhi', checkDate: '2026-01-01' },
    );

    expect(report.jurisdiction).toBe('state');
    expect(report.componentComparisons[0].status).toBe('undercharged');
    expect(report.componentComparisons[0].officialAmount).toBe(1600);
    expect(report.componentComparisons[0].officialSource).toBe(
      'Delhi State Fee Notification',
    );
    expect(report.officialSchedule.name).toBe('Delhi State Fee Notification');
    expect(report.officialSchedule.url).toBe('https://delhi.gov.in/fees');
  });

  it('does not apply a state version when checking another state', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          jurisdiction: 'state',
          state: 'Delhi',
          amount: 1600,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
        }),
      ),
    );

    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
      ]),
      'passport',
      { jurisdiction: 'state', state: 'Kerala', checkDate: '2026-01-01' },
    );

    expect(report.componentComparisons[0].officialAmount).toBe(1500);
    expect(report.componentComparisons[0].status).toBe('matched');
  });

  it('does not apply a state version in a report without a selected state', () => {
    recordFeeVersion(
      createGovernmentFee(
        baseRecord({
          jurisdiction: 'state',
          state: 'Delhi',
          amount: 1600,
          effectiveDate: '2025-01-01',
          verificationDate: '2025-01-02',
        }),
      ),
    );

    const report = generateDiscrepancyReport(
      passportReceipt([
        { label: 'Standard Adult Passport Fee', amount: 1500 },
      ]),
      'passport',
      { jurisdiction: 'state', checkDate: '2026-01-01' },
    );

    expect(report.jurisdiction).toBe('state');
    expect(report.componentComparisons[0].officialAmount).toBe(1500);
    expect(report.componentComparisons[0].status).toBe('matched');
  });

  it('keeps identifiers redacted in the report and exposes no raw text', () => {
    const receipt = createReceiptEvidence({
      serviceId: 'passport',
      rawText: 'Receipt No REC-12345678, mobile 9876543210',
      receiptId: 'REC-12345678',
      feeComponents: [
        { label: 'Standard Adult Passport Fee', amount: 1500 },
      ],
      jurisdiction: 'national',
    });
    const report = generateDiscrepancyReport(receipt, 'passport');
    const serialized = JSON.stringify(report);

    expect(report.receiptEvidenceId).toContain('receipt-passport');
    expect(serialized).not.toContain('REC-12345678');
    expect(serialized).not.toContain('9876543210');
    report.componentComparisons.forEach((comparison) => {
      expect(comparison.redactionApplied).toBe(true);
    });
  });

  it('returns a no-components result for an empty receipt', () => {
    const report = generateDiscrepancyReport(
      createReceiptEvidence({ serviceId: 'passport' }),
      'passport',
    );
    expect(report.overallMatch).toBe('no-components');
    expect(report.summary.totalCharged).toBe(0);
  });
});

// ============================================================
// GRIEVANCE ROUTES
// ============================================================

describe('Grievance routes', () => {
  it('returns the published passport route with categories', () => {
    const route = getGrievanceRoute('passport');
    expect(route.title).toBe('Passport Grievance Redressal');
    expect(route.status).toBe('available');
    expect(route.portalUrl).toBe('https://www.passportindia.gov.in');
    expect(route.cpgrsLink).toBe('https://pgportal.gov.in');
    expect(route.department).toContain('External Affairs');
    expect(route.complaintCategories).toContain('Overcharging');
    expect(route.complaintCategories).toContain('Missing receipt');
  });

  it('returns published routes for other verified services', () => {
    expect(getGrievanceRoute('aadhaar-card').portalUrl).toBe(
      'https://uidai.gov.in',
    );
    expect(getGrievanceRoute('driving-license').portalUrl).toBe(
      'https://parivahan.gov.in',
    );
    expect(getGrievanceRoute('pan-card').portalUrl).toBe(
      'https://www.onlineservices.nsdl.com',
    );
    expect(getGrievanceRoute('voter-id').portalUrl).toBe(
      'https://voters.eci.gov.in',
    );
  });

  it('marks an unknown service as having no published route', () => {
    const route = getGrievanceRoute('unknown-service-123');
    expect(route.status).toBe('unverified');
    expect(route.portalUrl).toBeNull();
    expect(route.cpgrsLink).toBe('https://pgportal.gov.in');
    expect(route.message).toContain('No service-specific');
  });

  it('flags a schedule past its review window', () => {
    const route = getGrievanceRoute('test-expired-scheme');
    expect(route.status).toBe('review-required');
    expect(route.portalUrl).toBeTruthy();
  });
});

// ============================================================
// COMMUNITY FEE OBSERVATIONS
// ============================================================

describe('Community fee observations', () => {
  const validObservation = (overrides = {}) => ({
    serviceId: 'passport',
    userId: 'user-123',
    observedAmount: 2000,
    officialAmount: 1500,
    componentType: FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
    location: 'Counter 2',
    jurisdiction: 'national',
    description:
      'Was charged Rs. 2000 for SMS updates at the Passport Seva Kendra; the published rate is Rs. 50.',
    ...overrides,
  });

  it('stores a new observation as PENDING', () => {
    const observation = createCommunityFeeObservation(validObservation());

    expect(observation.valid).toBe(true);
    expect(observation.status).toBe(COMMUNITY_OBSERVATION_STATUS.PENDING);
    expect(observation.observedAmount).toBe(2000);
    expect(observation.moderatorNotes).toBeNull();
    expect(getPendingCommunityObservations('passport')).toHaveLength(1);
  });

  it('rejects invalid amounts and short descriptions', () => {
    const result = createCommunityFeeObservation(
      validObservation({ observedAmount: -5, description: 'Too short' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('non-negative'))).toBe(
      true,
    );
    expect(result.errors.some((error) => error.includes('10 characters'))).toBe(
      true,
    );
  });

  it('rejects payment credentials instead of collecting them', () => {
    expect(containsPaymentCredentials('card 4111 1111 1111 1111')).toBe(true);
    expect(containsPaymentCredentials('CVV 123')).toBe(true);
    expect(containsPaymentCredentials('paid at the counter')).toBe(false);

    const result = createCommunityFeeObservation(
      validObservation({
        description:
          'I paid with card 4111 1111 1111 1111 and the operator kept the receipt number.',
      }),
    );
    expect(result.valid).toBe(false);
    expect(getPendingCommunityObservations('passport')).toHaveLength(0);
  });

  it('redacts identifier text and strips sensitive keys from evidence', () => {
    const observation = createCommunityFeeObservation(
      validObservation({
        evidence: {
          photoRef: 'counter-photo.jpg',
          note: 'receipt REC-12345678',
        },
      }),
    );

    expect(observation.valid).toBe(true);
    expect(observation.evidence.photoRef).toBe('counter-photo.jpg');
    expect(observation.evidence.note).not.toContain('REC-12345678');
  });

  it('rejects payment credentials placed in evidence', () => {
    const observation = createCommunityFeeObservation(
      validObservation({
        evidence: { cardNumber: '4111111111111111', cvv: '123' },
      }),
    );

    expect(observation.valid).toBe(false);
    expect(getPendingCommunityObservations('passport')).toHaveLength(0);
  });

  it('does not show pending observations publicly', () => {
    createCommunityFeeObservation(validObservation());
    expect(getModeratedObservations('passport')).toEqual([]);
    expect(getModeratedObservations('passport', 'pending')).toHaveLength(1);
  });

  it('redacts personal identifiers before storing an observation', () => {
    const observation = createCommunityFeeObservation(
      validObservation({
        location: 'Counter 3, call 9876543210',
        description:
          'Charged at the counter. Email citizen@example.org or call 9876543210. Receipt REC-12345678 was not given.',
      }),
    );

    expect(observation.valid).toBe(true);
    expect(observation.description).not.toContain('citizen@example.org');
    expect(observation.description).not.toContain('9876543210');
    expect(observation.description).not.toContain('REC-12345678');
    expect(observation.location).not.toContain('9876543210');
  });

  it('approves an observation before it is displayed', () => {
    const observation = createCommunityFeeObservation(
      validObservation({ evidence: { note: 'receipt copy held offline' } }),
    );
    const moderation = moderateCommunityObservation(
      observation.id,
      COMMUNITY_OBSERVATION_STATUS.APPROVED,
      'Receipt evidence reviewed.',
      { moderatorId: 'moderator-1' },
    );

    expect(moderation.valid).toBe(true);
    expect(moderation.observation.status).toBe('approved');

    const approved = getModeratedObservations('passport');
    expect(approved).toHaveLength(1);
    expect(approved[0].description).toContain('SMS updates');
    expect(approved[0].userId).toBeUndefined();
    expect(approved[0].evidence).toBeUndefined();
    expect(approved[0].moderatorNotes).toBeUndefined();
    expect(approved[0].moderatedBy).toBeUndefined();
    expect(approved[0].auditTrail).toBeUndefined();
    expect(approved[0].evidenceAttached).toBe(true);
    expect(getPendingCommunityObservations('passport')).toHaveLength(0);
  });

  it('keeps rejected observations hidden from public display', () => {
    const observation = createCommunityFeeObservation(validObservation());
    const moderation = moderateCommunityObservation(
      observation.id,
      COMMUNITY_OBSERVATION_STATUS.REJECTED,
      'No supporting evidence.',
    );

    expect(moderation.valid).toBe(true);
    expect(getModeratedObservations('passport')).toEqual([]);
    expect(getModeratedObservations('passport', 'rejected')).toHaveLength(1);
  });

  it('rejects invalid moderation decisions and unknown observations', () => {
    const observation = createCommunityFeeObservation(validObservation());
    expect(
      moderateCommunityObservation(observation.id, 'invalid_status').valid,
    ).toBe(false);
    expect(
      moderateCommunityObservation('missing-observation', 'approved').valid,
    ).toBe(false);
  });

  it('filters observations by service', () => {
    const passportObservation = createCommunityFeeObservation(
      validObservation(),
    );
    moderateCommunityObservation(
      passportObservation.id,
      COMMUNITY_OBSERVATION_STATUS.APPROVED,
    );
    createCommunityFeeObservation(
      validObservation({ serviceId: 'driving-license' }),
    );

    expect(getModeratedObservations('passport')).toHaveLength(1);
    expect(getModeratedObservations('driving-license')).toEqual([]);
  });
});
