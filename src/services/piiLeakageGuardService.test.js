import { describe, it, expect } from 'vitest';
import {
  validateVerhoeff,
  calculateShannonEntropy,
  inspectStringForPII,
  inspectEntityRecord,
  evaluateKAnonymity,
  scanArtifactBundle,
  SYNTHETIC_WATERMARK,
} from './piiLeakageGuardService';

describe('piiLeakageGuardService (#778)', () => {
  describe('Verhoeff Algorithm', () => {
    it('validates authentic Aadhaar numbers with correct checksum', () => {
      // 234567890124 has valid Verhoeff check digit (4)
      expect(validateVerhoeff('234567890124')).toBe(true);
    });

    it('rejects numbers with invalid checksum', () => {
      expect(validateVerhoeff('234567890125')).toBe(false);
      expect(validateVerhoeff('')).toBe(false);
    });
  });

  describe('calculateShannonEntropy', () => {
    it('computes low entropy for repetitive text', () => {
      const entropy = calculateShannonEntropy('AAAAAAAAAAAAAA');
      expect(entropy).toBe(0);
    });

    it('computes high entropy for random base64 secret tokens', () => {
      const entropy = calculateShannonEntropy('k9X$zL2@mQ7!vR4#pW8&yB1*tN6^');
      expect(entropy).toBeGreaterThan(4.2);
    });
  });

  describe('inspectStringForPII', () => {
    it('passes completely clean strings', () => {
      const res = inspectStringForPII('Pune Municipal Corporation Ward Office No 3');
      expect(res.clean).toBe(true);
      expect(res.violations).toHaveLength(0);
    });

    it('detects real PAN card format', () => {
      const res = inspectStringForPII('Applicant submitted PAN: ABCDE1234F for verification');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'PAN_DETECTED')).toBe(true);
    });

    it('detects real Aadhaar format', () => {
      const res = inspectStringForPII('Citizen Aadhaar: 3456 7890 1234');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'AADHAAR_DETECTED')).toBe(true);
    });

    it('allows non-routable dummy test phone numbers (+91-99900-XXXXX)', () => {
      const res = inspectStringForPII('Contact Desk Phone: +91-99900-48291');
      expect(res.clean).toBe(true);
    });

    it('detects active Indian mobile numbers outside dummy prefix', () => {
      const res = inspectStringForPII('Call applicant at +91 9823012345 immediately');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'REAL_PHONE_DETECTED')).toBe(true);
    });

    it('detects real personal email addresses', () => {
      const res = inspectStringForPII('Notification sent to citizen.personal@gmail.com');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'REAL_EMAIL_DETECTED')).toBe(true);
    });

    it('detects high-entropy secret tokens embedded in text', () => {
      const res = inspectStringForPII('Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTpc8yKEAeEzGQuL1Ai22E5NMRpyg');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'HIGH_ENTROPY_TOKEN_DETECTED')).toBe(true);
    });
  });

  describe('inspectEntityRecord', () => {
    it('verifies valid synthetic records with proper watermark', () => {
      const record = {
        id: 'SYN-APP-12AB',
        applicantPseudonym: 'Rohan Deshmukh',
        serviceId: 'SYN-SRV-9988',
        isSynthetic: true,
        syntheticWatermark: SYNTHETIC_WATERMARK,
      };
      const res = inspectEntityRecord(record, 'SyntheticApplication');
      expect(res.clean).toBe(true);
    });

    it('flags records missing isSynthetic: true flag', () => {
      const record = {
        id: 'SYN-APP-12AB',
        syntheticWatermark: SYNTHETIC_WATERMARK,
      };
      const res = inspectEntityRecord(record, 'SyntheticApplication');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'MISSING_SYNTHETIC_FLAG')).toBe(true);
    });

    it('flags records with invalid watermark', () => {
      const record = {
        id: 'SYN-APP-12AB',
        isSynthetic: true,
        syntheticWatermark: 'INCORRECT_WATERMARK',
      };
      const res = inspectEntityRecord(record, 'SyntheticApplication');
      expect(res.clean).toBe(false);
      expect(res.violations.some((v) => v.type === 'INVALID_SYNTHETIC_WATERMARK')).toBe(true);
    });
  });

  describe('evaluateKAnonymity', () => {
    it('evaluates k-anonymity score correctly', () => {
      const records = [
        { district: 'Pune', status: 'APPROVED' },
        { district: 'Pune', status: 'APPROVED' },
        { district: 'Pune', status: 'APPROVED' },
        { district: 'Mumbai', status: 'SUBMITTED' },
        { district: 'Mumbai', status: 'SUBMITTED' },
      ];
      const result = evaluateKAnonymity(records, ['district', 'status']);
      expect(result.k).toBe(2);
      expect(result.distinctEquivalenceClasses).toBe(2);
    });
  });

  describe('scanArtifactBundle', () => {
    it('passes a fully compliant synthetic bundle', () => {
      const bundle = {
        offices: [
          {
            id: 'SYN-OFF-01',
            name: 'Ward Office',
            isSynthetic: true,
            syntheticWatermark: SYNTHETIC_WATERMARK,
          },
        ],
        services: [
          {
            id: 'SYN-SRV-01',
            name: 'Birth Certificate',
            isSynthetic: true,
            syntheticWatermark: SYNTHETIC_WATERMARK,
          },
        ],
        applications: [
          {
            id: 'SYN-APP-01',
            serviceId: 'SYN-SRV-01',
            district: 'Pune',
            status: 'APPROVED',
            isSynthetic: true,
            syntheticWatermark: SYNTHETIC_WATERMARK,
          },
        ],
        grievances: [],
      };

      const res = scanArtifactBundle(bundle);
      expect(res.passed).toBe(true);
      expect(res.recordsScanned).toBe(3);
      expect(res.piiViolationsCount).toBe(0);
    });
  });
});
