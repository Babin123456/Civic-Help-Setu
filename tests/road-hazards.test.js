import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateRoadHazardReportPayload,
  generateRoadHazardSeal,
  ROAD_HAZARD_REPORT_QUEUE,
} from '../api/road-hazards.js';

describe('api/road-hazards', () => {
  beforeEach(() => {
    ROAD_HAZARD_REPORT_QUEUE.length = 0;
  });

  const validPayload = {
    segmentId: 'seg-ka-blr-nh44-01',
    hazardType: 'pothole_surface',
    description: 'High-speed down-ramp has developed a cluster of sharp edge potholes causing sudden lane swerving.',
    locationHint: 'Near Hebbal BMTC bus shelter down-ramp merge',
    evidenceUrl: 'https://morth.nic.in/reports/hebbal-audit.pdf',
  };

  it('validates a compliant citizen hazard report payload', () => {
    const errors = validateRoadHazardReportPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects missing required fields', () => {
    const errors = validateRoadHazardReportPayload({});
    expect(errors.some((e) => e.includes('segmentId'))).toBe(true);
    expect(errors.some((e) => e.includes('hazardType'))).toBe(true);
    expect(errors.some((e) => e.includes('description'))).toBe(true);
  });

  it('strictly rejects personal data (Aadhaar, PAN, Phone, Exact Address)', () => {
    const withAadhaar = { ...validPayload, description: 'Citizen Aadhaar: 1234 5678 9012 observed the accident.' };
    expect(validateRoadHazardReportPayload(withAadhaar).some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = { ...validPayload, description: 'Complainant PAN: ABCDE1234F reports pothole.' };
    expect(validateRoadHazardReportPayload(withPan).some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = { ...validPayload, description: 'Call citizen at 9876543210 for video evidence.' };
    expect(validateRoadHazardReportPayload(withPhone).some((e) => e.includes('phone'))).toBe(true);

    const withDoor = { ...validPayload, description: 'Pothole right outside Door No 42/B near junction.' };
    expect(validateRoadHazardReportPayload(withDoor).some((e) => e.includes('flat/door'))).toBe(true);
  });

  it('rejects insecure http URLs for evidence links', () => {
    const insecure = { ...validPayload, evidenceUrl: 'http://unsecured-camera.org/pic.jpg' };
    const errors = validateRoadHazardReportPayload(insecure);
    expect(errors.some((e) => e.includes('https://'))).toBe(true);
  });

  it('generates deterministic cryptographic seal', () => {
    const timestamp = '2026-11-14T10:00:00.000Z';
    const seal1 = generateRoadHazardSeal('seg-ka-blr-nh44-01', timestamp);
    const seal2 = generateRoadHazardSeal('seg-ka-blr-nh44-01', timestamp);
    expect(seal1).toBe(seal2);
    expect(seal1).toMatch(/^RH-HAZ-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('handles GET and POST HTTP requests successfully', async () => {
    const reqPost = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: validPayload,
    };
    const resPost = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };

    await handler(reqPost, resPost);
    expect(resPost.statusCode).toBe(201);
    expect(resPost.data.success).toBe(true);
    expect(resPost.data.verificationSeal).toBeDefined();
    expect(ROAD_HAZARD_REPORT_QUEUE.length).toBe(1);

    const reqGet = { method: 'GET' };
    const resGet = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; },
    };

    await handler(reqGet, resGet);
    expect(resGet.statusCode).toBe(200);
    expect(resGet.data.pendingCount).toBe(1);
    expect(resGet.data.items.length).toBe(1);
  });
});

