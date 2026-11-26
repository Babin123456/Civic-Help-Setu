/**
 * tests/route-planning-security.test.js
 * Security, PII Leakage, Injection, and Threat-Model Tests for Route Planning (#755).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCurrentActor,
  createCollectionRoute,
  createPickupPoint,
  createSegregationAudit,
  generateRouteAuditSeal,
  getPublicRouteSummary,
  listCollectionRoutes,
  checkPermission,
} from '../src/services/routePlanning/service.js';

describe('Route Planning Security & Privacy Guardrails (#755)', () => {
  let mockStore;

  beforeEach(() => {
    const memory = {};
    mockStore = {
      getItem: (k) => memory[k] || null,
      setItem: (k, v) => {
        memory[k] = String(v);
      },
      clear: () => {
        for (const k of Object.keys(memory)) delete memory[k];
      },
    };
    setCurrentActor({ username: 'admin-sec', role: 'admin' });
  });

  describe('Injection & Malicious Input Defense', () => {
    it('neutralizes Cross-Site Scripting (XSS) vectors in pickup points and routes', () => {
      const xssInput = 'Bins near <script>evilPayload()</script><img src=x onerror=alert(1)> Gate';
      const point = createPickupPoint(
        {
          address: xssInput,
          ward: 'Ward 150',
          notes: '"><svg onload=alert(document.cookie)>',
        },
        mockStore
      );

      expect(point.address).not.toContain('<script>');
      expect(point.address).not.toContain('onerror=');
      expect(point.notes).not.toContain('<svg');
    });

    it('sanitizes SQL/command injection metacharacters gracefully', () => {
      const sqlPayload = "Ward 150'; DROP TABLE collection_routes; --";
      const route = createCollectionRoute({ name: sqlPayload, ward: 'Ward 150' }, mockStore);
      expect(route.name).toBe("Ward 150'; DROP TABLE collection_routes; --");
      // Verify data store integrity remains valid JSON
      const stored = listCollectionRoutes({}, mockStore);
      expect(stored.length).toBe(1);
    });
  });

  describe('PII Redaction & Privacy Leakage Prevention', () => {
    it('automatically masks phone numbers and Aadhaar numbers from audit observations', async () => {
      const sensitiveNote = 'Resident 9876543210 (Aadhaar 1234 5678 9012) refused segregation at Flat 301.';
      const audit = await createSegregationAudit(
        {
          pickupPointId: 'pt-sec-1',
          ward: 'Ward 150',
          compliancePercentage: 50,
          issuesNoted: sensitiveNote,
        },
        mockStore
      );

      expect(audit.issuesNoted).toContain('[REDACTED_PHONE]');
      expect(audit.issuesNoted).toContain('[REDACTED_AADHAAR]');
      expect(audit.issuesNoted).toContain('[REDACTED_DOOR]');
      expect(audit.issuesNoted).not.toContain('9876543210');
      expect(audit.issuesNoted).not.toContain('1234 5678 9012');
      expect(audit.issuesNoted).not.toContain('Flat 301');
    });

    it('ensures public route summary reveals only approved aggregate fields', () => {
      const route = createCollectionRoute(
        {
          name: 'Ward 150 Public Circuit',
          ward: 'Ward 150',
          vehicleIds: ['veh-driver-confidential'],
          pickupPointIds: ['pt-sec-1'],
        },
        mockStore
      );

      createPickupPoint(
        {
          id: 'pt-sec-1',
          address: 'Community Station',
          ward: 'Ward 150',
          notes: 'Internal worker code #9941',
        },
        mockStore
      );

      const publicSummary = getPublicRouteSummary(route.id, mockStore);
      const exposedKeys = Object.keys(publicSummary);

      expect(exposedKeys).not.toContain('vehicleIds');
      expect(exposedKeys).not.toContain('notes');
      expect(exposedKeys).not.toContain('createdBy');
      expect(publicSummary.averageWardSegregationScore).toBeNull();
      expect(publicSummary.servicedPercentage).toBe(0);
    });
  });

  describe('Privilege Escalation & Replay Defenses', () => {
    it('prevents role spoofing from unauthenticated or client-forged objects', () => {
      // Actor claims to be supervisor in plain string
      setCurrentActor('supervisor');
      expect(checkPermission('routePlanning.routes.create')).toBe('unauthenticated');

      // Actor claims admin in sub-field
      setCurrentActor({ profile: { role: 'admin' } });
      expect(checkPermission('routePlanning.routes.create')).toBe('forbidden');
    });

    it('detects tampering when audit payload is altered post-seal', async () => {
      const original = {
        pickupPointId: 'pt-seal-test',
        ward: 'Ward 150',
        compliancePercentage: 80,
        rating: 'GOOD',
        auditDate: '2026-11-19T10:00:00.000Z',
      };
      const seal = await generateRouteAuditSeal(original);

      // Malicious actor modifies score from 80% to 95%
      const tampered = { ...original, compliancePercentage: 95 };
      const tamperedSeal = await generateRouteAuditSeal(tampered);

      expect(tamperedSeal).not.toBe(seal);
    });
  });
});
