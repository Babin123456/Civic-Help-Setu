import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  sanitizeString,
  PEDESTRIAN_BARRIER_QUEUE,
  AUDIT_EVENT_LOGS,
} from '../api/_lib/handlers/pedestrian-barriers.js';
import { pedestrianBarrierService } from '../src/services/pedestrianBarrierService.js';
import { resetPedestrianBarrierData } from '../src/services/pedestrianBarrierStorage.js';

describe('pedestrian-barriers security suite (#757)', () => {
  beforeEach(() => {
    PEDESTRIAN_BARRIER_QUEUE.length = 0;
    AUDIT_EVENT_LOGS.length = 0;
    resetPedestrianBarrierData();
  });

  describe('1. Injection & Malicious Payload Sanitization', () => {
    it('strips dangerous HTML and JavaScript tags from barrier descriptions', () => {
      const dirtyInput = '<script>alert("xss")</script><img src=x onerror=alert(1)>Broken pavement edge.';
      const cleaned = sanitizeString(dirtyInput);
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).not.toContain('onerror=');
      expect(cleaned).toContain('Broken pavement edge.');
    });

    it('rejects submissions with control characters and sanitizes text length', () => {
      const longInput = 'A'.repeat(2000);
      const cleaned = sanitizeString(longInput, 500);
      expect(cleaned.length).toBe(500);
    });
  });

  describe('2. Enumeration & Public Data Leakage Defense', () => {
    it('never leaks internal staff reviewer remarks or personal submitter details in public API queries', async () => {
      // Seed queue with an observation that has private notes
      PEDESTRIAN_BARRIER_QUEUE.push({
        id: 'BAR-LEAK-TEST',
        segmentId: 'SEG-101-102',
        coordinates: { lat: 12.915, lng: 77.67 },
        barrierType: 'open_drain_hazard',
        severity: 'high_barrier',
        ward: 'Ward 150 - Bellandur',
        description: 'Open drainage pit next to transit station.',
        status: 'verified',
        submitterIp: '192.168.1.100',
        submitterPhone: '+919876543210',
        internalReviewerNotes: 'CONFIDENTIAL: Contractor default notice issued to ABC Infra Corp.',
        reportedAt: new Date().toISOString(),
      });

      const req = {
        method: 'GET',
        query: { action: 'list' },
        headers: {},
      };

      let statusCode = null;
      let body = null;
      const res = {
        setHeader: () => {},
        status: (code) => {
          statusCode = code;
          return { json: (d) => { body = d; } };
        },
      };

      await handler(req, res);

      expect(statusCode).toBe(200);
      expect(body.observations.length).toBe(1);
      const publicRecord = body.observations[0];

      expect(publicRecord.id).toBe('BAR-LEAK-TEST');
      expect(publicRecord.internalReviewerNotes).toBeUndefined();
      expect(publicRecord.submitterIp).toBeUndefined();
      expect(publicRecord.submitterPhone).toBeUndefined();
    });
  });

  describe('3. Replay & Duplicate Submission Defense', () => {
    it('rejects duplicate or rapid-fire submissions exceeding rate limits', async () => {
      const baseReq = {
        method: 'POST',
        query: { action: 'report' },
        headers: { 'x-forwarded-for': '203.0.113.42' },
        body: {
          segmentId: 'SEG-101-102',
          barrierType: 'damaged_footpath',
          severity: 'moderate_impediment',
          ward: 'Ward 150 - Bellandur',
          description: 'Broken paver slabs causing pedestrians to step into vehicular traffic.',
        },
      };

      let lastStatus = null;
      let lastBody = null;

      const createRes = () => ({
        setHeader: () => {},
        status: (code) => {
          lastStatus = code;
          return { json: (d) => { lastBody = d; } };
        },
      });

      // Fire 15 consecutive requests from the same IP (limit is 12 req/min)
      for (let i = 0; i < 15; i += 1) {
        await handler(baseReq, createRes());
      }

      expect(lastStatus).toBe(429);
      expect(lastBody.errorCode).toBe('ERR_RATE_LIMITED');
    });

    it('ensures offline queue flush is idempotent and does not duplicate records', () => {
      const payload = {
        id: 'BAR-IDEM-999',
        segmentId: 'SEG-101-102',
        barrierType: 'missing_curb_ramp',
        severity: 'high_barrier',
        ward: 'Ward 150 - Bellandur',
        description: 'Missing dropped kerb at primary school pedestrian crossing.',
      };

      // Simulate offline queue with duplicate submissions of the same report
      pedestrianBarrierService.reportBarrierObservation(payload, {}, false);
      pedestrianBarrierService.reportBarrierObservation(payload, {}, false);

      const res = pedestrianBarrierService.flushOfflineQueue();
      expect(res.flushed).toBe(1); // Only 1 record should be flushed, duplicate ignored!

      const count = pedestrianBarrierService.getObservations().filter((o) => o.id === payload.id).length;
      expect(count).toBe(1);
    });
  });

  describe('4. Privilege Escalation & State Tampering Defense', () => {
    it('blocks unprivileged citizen roles from executing verification or resolution transitions', async () => {
      PEDESTRIAN_BARRIER_QUEUE.push({
        id: 'BAR-PRIV-1',
        segmentId: 'SEG-101-102',
        status: 'reported',
        ward: 'Ward 150 - Bellandur',
      });

      const escalateReq = {
        method: 'POST',
        query: { action: 'verify' },
        headers: { 'x-user-role': 'citizen' },
        body: { observationId: 'BAR-PRIV-1', decision: 'verify' },
      };

      let code = null;
      let body = null;
      const res = {
        setHeader: () => {},
        status: (c) => {
          code = c;
          return { json: (d) => { body = d; } };
        },
      };

      await handler(escalateReq, res);
      expect(code).toBe(403);
      expect(body.errorCode).toBe('ERR_UNAUTHORIZED');

      // Ensure state was NOT tampered with
      const target = PEDESTRIAN_BARRIER_QUEUE.find((b) => b.id === 'BAR-PRIV-1');
      expect(target.status).toBe('reported');
    });
  });

  describe('5. Data Leakage & PII Prevention', () => {
    it('strictly intercepts submissions containing Aadhaar, PAN, phone or email identifiers', async () => {
      const piiBodies = [
        {
          segmentId: 'SEG-101-102',
          barrierType: 'missing_curb_ramp',
          severity: 'high_barrier',
          ward: 'Ward 150',
          description: 'Contact resident at 9876543210 regarding the missing curb ramp.',
        },
        {
          segmentId: 'SEG-101-102',
          barrierType: 'missing_curb_ramp',
          severity: 'high_barrier',
          ward: 'Ward 150',
          description: 'Aadhaar 1234 5678 9012 submitted for verification of complaint.',
        },
        {
          segmentId: 'SEG-101-102',
          barrierType: 'missing_curb_ramp',
          severity: 'high_barrier',
          ward: 'Ward 150',
          description: 'Direct queries to officer.name@municipality.gov.in regarding this trench.',
        },
      ];

      for (const piiBody of piiBodies) {
        let code = null;
        let body = null;
        const res = {
          setHeader: () => {},
          status: (c) => {
            code = c;
            return { json: (d) => { body = d; } };
          },
        };

        await handler({ method: 'POST', query: { action: 'report' }, headers: {}, body: piiBody }, res);
        expect(code).toBe(400);
        expect(body.errorCode).toBe('ERR_PII_DETECTED');
      }
    });
  });
});
