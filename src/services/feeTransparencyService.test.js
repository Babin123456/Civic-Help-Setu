import { describe, it, expect, beforeEach } from 'vitest';
import {
  getServiceFeeBreakdown,
  calculateTotalExpenditure,
  validateFeeRecord,
  isFeeScheduleExpired,
  formatCurrency,
  loadFeePreferences,
  saveFeePreferences,
  FEE_PREFERENCES_STORAGE_KEY,
  EXPIRY_THRESHOLD_DAYS,
} from './feeTransparencyService';

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

describe('feeTransparencyService (#145)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  describe('Acceptance Criteria: Free Services', () => {
    it('returns structured 100% free status for constitutional/statutory free services', () => {
      const breakdown = getServiceFeeBreakdown('aadhaar-card');

      expect(breakdown.serviceId).toBe('aadhaar-card');
      expect(breakdown.isVerified).toBe(true);
      expect(breakdown.isFreeService).toBe(true);
      expect(breakdown.status).toBe('free');
      expect(breakdown.currency).toBe('INR');
      expect(breakdown.minOfficialCost).toBe(0);
      expect(breakdown.officialStatutoryFees[0].amount).toBe(0);
      expect(breakdown.officialSource.name).toContain('UIDAI');
      expect(breakdown.disclaimer).toContain('Civic Help Setu does NOT collect');

      const voterBreakdown = getServiceFeeBreakdown('voter-id');
      expect(voterBreakdown.isFreeService).toBe(true);
      expect(voterBreakdown.status).toBe('free');
      expect(voterBreakdown.officialStatutoryFees[0].amount).toBe(0);
    });

    it('calculates zero total expenditure for free services with no optional items', () => {
      const breakdown = getServiceFeeBreakdown('voter-id');
      const calc = calculateTotalExpenditure(breakdown, null, []);

      expect(calc.officialTotal).toBe(0);
      expect(calc.optionalTotal).toBe(0);
      expect(calc.grandTotal).toBe(0);
      expect(calc.isFree).toBe(true);
      expect(calc.appliedOfficialItems.length).toBeGreaterThan(0);
    });
  });

  describe('Acceptance Criteria: Conditional / Tiered Fees', () => {
    it('returns conditional tiers for services with multi-tier statutory fees', () => {
      const breakdown = getServiceFeeBreakdown('passport');

      expect(breakdown.hasConditionalTiers).toBe(true);
      expect(breakdown.conditionalTiers.length).toBeGreaterThanOrEqual(4);

      const standard36 = breakdown.conditionalTiers.find((t) => t.id === 'tier-standard-36');
      expect(standard36).toBeDefined();
      expect(standard36.amount).toBe(1500);

      const tatkaal = breakdown.conditionalTiers.find((t) => t.id === 'tier-tatkaal-36');
      expect(tatkaal).toBeDefined();
      expect(tatkaal.amount).toBe(3500);

      const jumbo60 = breakdown.conditionalTiers.find((t) => t.id === 'tier-jumbo-60');
      expect(jumbo60).toBeDefined();
      expect(jumbo60.amount).toBe(2000);

      const minor36 = breakdown.conditionalTiers.find((t) => t.id === 'tier-minor-36');
      expect(minor36).toBeDefined();
      expect(minor36.amount).toBe(1000);
    });

    it('distinguishes official statutory fees from optional third-party charges', () => {
      const breakdown = getServiceFeeBreakdown('passport');

      expect(breakdown.hasOptionalCharges).toBe(true);
      expect(breakdown.optionalProviderCharges.length).toBeGreaterThan(0);

      const loungeCharge = breakdown.optionalProviderCharges.find((c) => c.id === 'psk-premium-lounge');
      expect(loungeCharge).toBeDefined();
      expect(loungeCharge.mandatory).toBe(false);
      expect(loungeCharge.amount).toBe(500);
      expect(loungeCharge.maxPermissibleCap).toBe(500);

      // Verify calculation when citizen selects standard tier + optional SMS and Lounge
      const calc = calculateTotalExpenditure(breakdown, 'tier-standard-36', [
        'psk-premium-lounge',
        'psk-sms-updates',
      ]);

      expect(calc.officialTotal).toBe(1500);
      expect(calc.optionalTotal).toBe(550); // 500 + 50
      expect(calc.grandTotal).toBe(2050);
      expect(calc.appliedOfficialItems[0].label).toContain('Standard Adult Passport');
      expect(calc.appliedOptionalItems.length).toBe(2);
    });

    it('updates total correctly when switching to Tatkaal fast-track tier', () => {
      const breakdown = getServiceFeeBreakdown('passport');
      const calcTatkaal = calculateTotalExpenditure(breakdown, 'tier-tatkaal-36', ['psk-sms-updates']);

      expect(calcTatkaal.officialTotal).toBe(3500);
      expect(calcTatkaal.optionalTotal).toBe(50);
      expect(calcTatkaal.grandTotal).toBe(3550);
    });
  });

  describe('Acceptance Criteria: Unavailable & Unverified Fee Information', () => {
    it('returns an unverified fallback rather than estimating or guessing unknown fees', () => {
      const unknownBreakdown = getServiceFeeBreakdown('unknown-random-service-999');

      expect(unknownBreakdown.status).toBe('unverified');
      expect(unknownBreakdown.isVerified).toBe(false);
      expect(unknownBreakdown.isFreeService).toBe(false);
      expect(unknownBreakdown.minOfficialCost).toBeNull();
      expect(unknownBreakdown.maxOfficialCost).toBeNull();
      expect(unknownBreakdown.officialStatutoryFees).toEqual([]);
      expect(unknownBreakdown.optionalProviderCharges).toEqual([]);
      expect(unknownBreakdown.reviewWarning).toContain('Unverified Fee Notice');
      expect(unknownBreakdown.reviewWarning).toContain('not verified on record');
      expect(unknownBreakdown.disclaimer).toContain('Civic Help Setu does NOT collect');
    });

    it('gracefully handles null, undefined, or empty service IDs', () => {
      expect(getServiceFeeBreakdown(null).status).toBe('unverified');
      expect(getServiceFeeBreakdown(undefined).status).toBe('unverified');
      expect(getServiceFeeBreakdown('').status).toBe('unverified');
    });

    it('returns zero expenditure and empty breakdowns for unverified services', () => {
      const fallback = getServiceFeeBreakdown('non-existent');
      const calc = calculateTotalExpenditure(fallback, 'tier-fake', ['fake-optional']);

      expect(calc.officialTotal).toBe(0);
      expect(calc.optionalTotal).toBe(0);
      expect(calc.grandTotal).toBe(0);
      expect(calc.appliedOfficialItems).toEqual([]);
      expect(calc.appliedOptionalItems).toEqual([]);
    });
  });

  describe('Acceptance Criteria: Expired Fee Records & Review Warnings', () => {
    it('detects expired records with explicit past expiry dates or audits older than 365 days', () => {
      const testRefDate = new Date('2026-10-27');
      const expiredRecord = getServiceFeeBreakdown('test-expired-scheme', { referenceDate: testRefDate });

      expect(expiredRecord.isExpired).toBe(true);
      expect(expiredRecord.reviewWarning).toContain('Caution: This fee schedule was published on 2022-01-01');
      expect(expiredRecord.reviewWarning).toContain(`past its ${EXPIRY_THRESHOLD_DAYS}-day review window`);
    });

    it('marks recent verified fee schedules as active and non-expired', () => {
      const testRefDate = new Date('2026-10-27');
      const freshRecord = getServiceFeeBreakdown('passport', { referenceDate: testRefDate });

      expect(freshRecord.isExpired).toBe(false);
      expect(freshRecord.reviewWarning).toBeNull();
    });

    it('evaluates helper isFeeScheduleExpired accurately', () => {
      const ref = new Date('2026-10-27');

      // Expired by expiryDate
      expect(isFeeScheduleExpired({ expiryDate: '2023-01-01' }, ref)).toBe(true);

      // Expired by old review date (> 365 days)
      expect(isFeeScheduleExpired({ lastReviewedDate: '2024-01-01' }, ref)).toBe(true);

      // Fresh review date (< 365 days)
      expect(isFeeScheduleExpired({ lastReviewedDate: '2026-08-01' }, ref)).toBe(false);

      // Null or empty record
      expect(isFeeScheduleExpired(null, ref)).toBe(false);
    });
  });

  describe('Acceptance Criteria: Admin Validation of Fee Records', () => {
    const validSample = {
      serviceId: 'sample-civic-permit',
      status: 'published',
      currency: 'INR',
      effectiveDate: '2026-01-15',
      officialSource: {
        name: 'State Gazette Notification 2026/04',
        url: 'https://state.gov.in/fees',
      },
      officialStatutoryFees: [
        { id: 'permit-base', label: 'Application Fee', amount: 250, mandatory: true },
      ],
      conditionalTiers: [
        { id: 'tier-normal', label: 'Normal Processing', amount: 250 },
        { id: 'tier-urgent', label: 'Fast Track Processing', amount: 500 },
      ],
      optionalProviderCharges: [
        { id: 'kiosk-charge', label: 'Kiosk Assistance', amount: 30, maxPermissibleCap: 50 },
      ],
    };

    it('passes validation for complete and well-formed fee record', () => {
      const result = validateFeeRecord(validSample, new Date('2026-10-27'));
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects malformed amounts (negative, NaN, non-numeric)', () => {
      const invalidAmountsRecord = {
        ...validSample,
        officialStatutoryFees: [
          { id: 'fee-neg', label: 'Negative fee', amount: -100 },
          { id: 'fee-nan', label: 'NaN fee', amount: NaN },
          { id: 'fee-str', label: 'String fee', amount: 'two hundred' },
        ],
      };

      const result = validateFeeRecord(invalidAmountsRecord, new Date('2026-10-27'));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('malformed amount'))).toBe(true);
    });

    it('rejects optional provider charges where cap is less than stated amount', () => {
      const invalidCapRecord = {
        ...validSample,
        optionalProviderCharges: [
          { id: 'kiosk', label: 'Kiosk', amount: 100, maxPermissibleCap: 50 }, // cap lower than amount!
        ],
      };

      const result = validateFeeRecord(invalidCapRecord, new Date('2026-10-27'));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('maximum permissible cap cannot be lower'))).toBe(true);
    });

    it('rejects invalid or far-future effective dates', () => {
      const refDate = new Date('2026-10-27');

      // Malformed date string
      const badFormat = validateFeeRecord({ ...validSample, effectiveDate: '27/10/2026' }, refDate);
      expect(badFormat.isValid).toBe(false);
      expect(badFormat.errors.some((e) => e.includes('YYYY-MM-DD format'))).toBe(true);

      // Date > 365 days into the future
      const farFuture = validateFeeRecord({ ...validSample, effectiveDate: '2029-01-01' }, refDate);
      expect(farFuture.isValid).toBe(false);
      expect(farFuture.errors.some((e) => e.includes('more than 365 days in the future'))).toBe(true);
    });

    it('rejects records with missing or invalid official sources', () => {
      const missingSource = validateFeeRecord(
        { ...validSample, officialSource: { name: '', url: 'not-a-valid-url' } },
        new Date('2026-10-27')
      );
      expect(missingSource.isValid).toBe(false);
      expect(missingSource.errors.some((e) => e.includes('valid HTTP/HTTPS URL'))).toBe(true);
    });
  });

  describe('Storage & Preference Helpers', () => {
    it('saves and loads user fee calculator preferences', () => {
      expect(loadFeePreferences('passport')).toBeNull();

      saveFeePreferences('passport', {
        selectedTierId: 'tier-tatkaal-36',
        selectedOptionalIds: ['psk-sms-updates'],
      });

      const loaded = loadFeePreferences('passport');
      expect(loaded).not.toBeNull();
      expect(loaded.selectedTierId).toBe('tier-tatkaal-36');
      expect(loaded.selectedOptionalIds).toEqual(['psk-sms-updates']);
      expect(loaded.updatedAt).toBeDefined();

      const raw = JSON.parse(localStorage.getItem(FEE_PREFERENCES_STORAGE_KEY));
      expect(raw['passport']).toBeDefined();
    });

    it('formats currency correctly in Indian Rupee format', () => {
      expect(formatCurrency(0)).toBe('Free');
      expect(formatCurrency(1500)).toBe('₹1,500');
      expect(formatCurrency(1017)).toBe('₹1,017');
      expect(formatCurrency(null)).toBe('Unverified');
    });
  });
});
