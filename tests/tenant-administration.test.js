/**
 * tests/tenant-administration.test.js
 * Unit and integration tests for api/tenant-administration.js (#779).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateTenantAdminPayload,
  generateAdminActionSeal,
  TENANT_ADMIN_QUEUE,
  ALLOWED_ACTIONS,
} from '../api/tenant-administration.js';

describe('api/tenant-administration', () => {
  beforeEach(() => {
    TENANT_ADMIN_QUEUE.length = 0;
  });

  const validPayload = {
    tenantId: 'tenant-bmc',
    actorId: 'admin_patil',
    action: 'PUBLISH_CATALOGUE_RECORD',
    reason: 'Publishing standardized water pipeline repair checklist to state open catalogue',
    details: { recordId: 'ds-bmc-01', targetLevel: 'state' },
  };

  it('validates a compliant authority administration payload', () => {
    const errors = validateTenantAdminPayload(validPayload);
    expect(errors).toEqual([]);
  });

  it('rejects missing or malformed required fields', () => {
    const errors = validateTenantAdminPayload({});
    expect(errors.some((e) => e.includes('tenantId'))).toBe(true);
    expect(errors.some((e) => e.includes('actorId'))).toBe(true);
    expect(errors.some((e) => e.includes('action'))).toBe(true);
    expect(errors.some((e) => e.includes('reason'))).toBe(true);
  });

  it('rejects unsupported administrative actions', () => {
    const badAction = { ...validPayload, action: 'UNAUTHORIZED_MASS_DELETE' };
    const errors = validateTenantAdminPayload(badAction);
    expect(errors.some((e) => e.includes('action must be one of'))).toBe(true);
  });

  it('strictly rejects payloads containing personal identifiers (PII)', () => {
    const withAadhaar = {
      ...validPayload,
      reason: 'Overriding SLA for resident Aadhaar 2345 6789 0123 due to medical urgency',
    };
    expect(validateTenantAdminPayload(withAadhaar).some((e) => e.includes('Aadhaar'))).toBe(true);

    const withPan = {
      ...validPayload,
      reason: 'Contractor tax PAN ABCDE5678F verification pending',
    };
    expect(validateTenantAdminPayload(withPan).some((e) => e.includes('PAN'))).toBe(true);

    const withPhone = {
      ...validPayload,
      reason: 'Call commissioner mobile 9820098200 for authorization',
    };
    expect(validateTenantAdminPayload(withPhone).some((e) => e.includes('phone'))).toBe(true);

    const withDoor = {
      ...validPayload,
      reason: 'Inspection conducted at Flat No 404 Sunshine Apartments',
    };
    expect(validateTenantAdminPayload(withDoor).some((e) => e.includes('flat/door'))).toBe(true);
  });

  it('generates a deterministic cryptographic action seal', () => {
    const seal = generateAdminActionSeal('tenant-bmc', 'admin_patil', 'PUBLISH_CATALOGUE_RECORD', '2026-11-15T12:00:00Z');
    expect(seal).toContain('TENANT-TENANT-BMC-');
    expect(seal.length).toBeGreaterThan(15);
  });

  it('processes a valid POST request and enqueues an audited administrative receipt', async () => {
    let responseStatus = null;
    let responseJson = null;

    const req = {
      method: 'POST',
      headers: { 'x-real-ip': '127.0.0.1' },
      body: validPayload,
    };

    const res = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseJson = data;
          },
        };
      },
    };

    await handler(req, res);

    expect(responseStatus).toBe(200);
    expect(responseJson.success).toBe(true);
    expect(responseJson.code).toBe('ACTION_RECORDED');
    expect(responseJson.receipt.tenantId).toBe('tenant-bmc');
    expect(responseJson.receipt.actionSeal).toBeDefined();

    expect(TENANT_ADMIN_QUEUE.length).toBe(1);
    expect(TENANT_ADMIN_QUEUE[0].tenantId).toBe('tenant-bmc');
  });

  it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
    let responseStatus = null;
    let responseJson = null;

    const req = { method: 'GET', headers: {} };
    const res = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseJson = data;
          },
        };
      },
    };

    await handler(req, res);
    expect(responseStatus).toBe(405);
    expect(responseJson.code).toBe('METHOD_NOT_ALLOWED');
  });
});
