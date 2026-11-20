import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateSchoolZoneAuditPayload,
  generateSchoolZoneAuditSeal,
  SCHOOL_ZONE_AUDIT_QUEUE,
} from '../api/_lib/handlers/school-zone-audits.js';
import { HAZARD_TYPES } from '../src/data/upSchoolZoneSafetyContract.js';

describe('api/school-zone-audits', () => {
  beforeEach(() => {
    SCHOOL_ZONE_AUDIT_QUEUE.length = 0;
  });

  const validPayload = {
    schoolId: 'SCH-UP-LKO-001',
    gateId: 'G1-NORTH',
    hazardType: HAZARD_TYPES.MISSING_ZEBRA_CROSSING,
    description: 'High-speed carriage-way lacks painted pedestrian crossing and warning signage for students.',
    reporterRole: 'Parent / SMC Member',
    photoUrl: 'https://images.civicsetu.gov.in/audits/up/lko-001-gate.jpg',
  };

  it('validates a compliant school-zone safety audit payload', () => {
    const errors = validateSchoolZoneAuditPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects missing or invalid required fields', () => {
    const errors = validateSchoolZoneAuditPayload({});
    expect(errors.some((e) => e.includes('schoolId'))).toBe(true);
    expect(errors.some((e) => e.includes('hazardType'))).toBe(true);
    expect(errors.some((e) => e.includes('description'))).toBe(true);

    const badHazard = validateSchoolZoneAuditPayload({
      ...validPayload,
      hazardType: 'unregistered_bogus_type',
    });
    expect(badHazard.some((e) => e.includes('hazardType must be one of'))).toBe(true);
  });

  it('strictly rejects personal data (Aadhaar, PAN, phone, door addresses)', () => {
    const withAadhaar = { ...validPayload, description: 'Auditor Aadhaar: 1234 5678 9012 recorded the issue.' };
    expect(validateSchoolZoneAuditPayload(withAadhaar).some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = { ...validPayload, description: 'Complainant PAN: ABCDE1234F observed speeding vehicles.' };
    expect(validateSchoolZoneAuditPayload(withPan).some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = { ...validPayload, description: 'Contact school guard at 9876543210 for gate key.' };
    expect(validateSchoolZoneAuditPayload(withPhone).some((e) => e.includes('phone'))).toBe(true);

    const withDoor = { ...validPayload, description: 'Waterlogging right in front of Door No 14/C near gate.' };
    expect(validateSchoolZoneAuditPayload(withDoor).some((e) => e.includes('flat/door'))).toBe(true);
  });

  it('generates deterministic verification seal', () => {
    const seal1 = generateSchoolZoneAuditSeal('SCH-UP-LKO-001', HAZARD_TYPES.MISSING_ZEBRA_CROSSING, '2026-11-20T00:00:00Z');
    const seal2 = generateSchoolZoneAuditSeal('SCH-UP-LKO-001', HAZARD_TYPES.MISSING_ZEBRA_CROSSING, '2026-11-20T00:00:00Z');
    expect(seal1).toMatch(/^SZ-AUD-[A-F0-9]{8}$/);
    expect(seal1).toBe(seal2);
  });

  it('handles valid POST request and queues audit for moderation', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: validPayload,
    };
    let statusCode = 200;
    let responseData = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          },
        };
      },
      setHeader: () => {},
    };

    await handler(req, res);

    expect(statusCode).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.seal).toMatch(/^SZ-AUD-/);
    expect(SCHOOL_ZONE_AUDIT_QUEUE.length).toBe(1);
    expect(SCHOOL_ZONE_AUDIT_QUEUE[0].schoolId).toBe('SCH-UP-LKO-001');
  });
});
