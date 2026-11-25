/**
 * @file Cross-Tenant Repository & API Handler Integration Tests
 *
 * Verifies fail-closed cross-tenant isolation across repositories and API handlers
 * using synthetic data only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGhgMemoryRepository } from '../api/_lib/ghgInventoryRepository.js';
import { createMicroVolunteerMemoryRepository } from '../api/_lib/microVolunteerRepository.js';
import { FirestoreToiletStore } from '../api/_lib/publicToiletStore.js';
import tenantAdminHandler, { TENANT_ADMIN_QUEUE } from '../api/_lib/handlers/tenant-administration.js';

describe('Repository & API Handler Cross-Tenant Isolation', () => {
  beforeEach(() => {
    TENANT_ADMIN_QUEUE.length = 0;
  });

  describe('ghgInventoryRepository', () => {
    it('blocks cross-tenant getSubmission and listSubmissions while allowing same/ancestor tenant', async () => {
      const repo = createGhgMemoryRepository();
      await repo.recordSubmission({
        submission: {
          submissionId: 'sub-blr-1',
          tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
          jurisdictionId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
          title: 'Synthetic Water Pumping Emissions',
        },
        receipt: { submissionId: 'sub-blr-1' },
        idempotencyKey: 'key-1',
        jurisdictionId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        payloadHash: 'hash-1',
        actorId: 'op-blr',
      });

      const mysoreActor = { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC', role: 'operator' };
      const kaStateAdmin = { tenantId: 'STATE:IN-KA', role: 'state_admin' };

      await expect(repo.getSubmission('sub-blr-1', { actor: mysoreActor })).rejects.toThrow(
        'TENANT_ACCESS_DENIED'
      );
      await expect(
        repo.listSubmissions({ tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', actor: mysoreActor })
      ).rejects.toThrow('TENANT_ACCESS_DENIED');

      const allowed = await repo.getSubmission('sub-blr-1', { actor: kaStateAdmin });
      expect(allowed.submissionId).toBe('sub-blr-1');
    });
  });

  describe('microVolunteerRepository', () => {
    it('blocks cross-tenant withStorage access and allows same-tenant access', () => {
      const repo = createMicroVolunteerMemoryRepository();
      const actor = { tenantId: 'DEPARTMENT:IN-KA-BLR-BBMP-WATER', role: 'operator' };

      expect(() =>
        repo.withStorage((s) => s, {
          actor,
          tenantId: 'DEPARTMENT:IN-KA-BLR-BBMP-ROADS',
        })
      ).toThrow('TENANT_ACCESS_DENIED');

      expect(() =>
        repo.withStorage((s) => s, {
          actor,
          tenantId: 'DEPARTMENT:IN-KA-BLR-BBMP-WATER',
        })
      ).not.toThrow();
    });
  });

  describe('publicToiletStore', () => {
    it('rejects cross-tenant list and review operations', async () => {
      const docId = 'a'.repeat(64);
      const mockSnapshot = {
        exists: true,
        data: () => ({ id: docId, tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', status: 'queued_for_moderation' }),
      };
      const mockCollection = {
        doc: vi.fn(() => ({ id: docId })),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      };
      const mockDb = {
        collection: vi.fn(() => mockCollection),
        runTransaction: vi.fn((fn) => fn({ get: vi.fn().mockResolvedValue(mockSnapshot), update: vi.fn() })),
      };

      const store = new FirestoreToiletStore(mockDb);
      const otherActor = { tenantId: 'MUNICIPALITY:IN-MH-MUM-BMC', role: 'moderator' };

      await expect(
        store.list({ limit: 10, tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', actor: otherActor })
      ).rejects.toThrow('tenant_access_denied');

      await expect(
        store.review(docId, 'approved', 'mod-1', { actor: otherActor })
      ).rejects.toThrow('tenant_access_denied');
    });
  });

  describe('tenant-administration handler', () => {
    it('rejects cross-tenant mutation with 403 when authenticated principal belongs to another tenant', async () => {
      let statusCode = null;
      let body = null;
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.99' },
        user: { tenantId: 'MUNICIPALITY:IN-MH-MUM-BMC', role: 'admin' },
        body: {
          tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
          actorId: 'admin_1',
          action: 'PUBLISH_CATALOGUE_RECORD',
          reason: 'Synthetic cross-tenant mutation attempt that must fail closed',
        },
      };
      const res = {
        setHeader: vi.fn(),
        status(code) {
          statusCode = code;
          return this;
        },
        json(payload) {
          body = payload;
          return this;
        },
      };

      await tenantAdminHandler(req, res);
      expect(statusCode).toBe(403);
      expect(body.code).toBe('TENANT_ACCESS_DENIED');
    });
  });
});
