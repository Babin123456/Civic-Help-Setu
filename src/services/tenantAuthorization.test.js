/**
 * @file Tenant Authorization Tests
 * 
 * Tests for tenant-scoped authorization middleware and guards.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies using vi.hoisted
const {
  mockDefaultAuthorizationService,
  mockCivicRole,
  mockCivicAction,
} = vi.hoisted(() => ({
  mockDefaultAuthorizationService: {
    evaluate: vi.fn(),
  },
  mockCivicRole: {
    SUPER_ADMIN: 'super_admin',
    STATE_ADMIN: 'state_admin',
    WARD_OFFICER: 'ward_officer',
    VERIFIER: 'verifier',
    CITIZEN: 'citizen',
    ANONYMOUS: 'anonymous',
  },
  mockCivicAction: {
    VIEW: 'view',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    APPROVE: 'approve',
    EXPORT_AUDIT: 'export_audit',
  },
}));

vi.mock('./serverAuthorizationPolicyService.js', () => ({
  defaultAuthorizationService: mockDefaultAuthorizationService,
  CivicRole: mockCivicRole,
  CivicAction: mockCivicAction,
}));

// Mock tenantContext using vi.hoisted
const {
  mockAssertTenantAccess,
  mockParseTenantId,
  mockIsDescendantOf,
  mockCreateTenantScopedId,
} = vi.hoisted(() => ({
  mockAssertTenantAccess: vi.fn(),
  mockParseTenantId: vi.fn(),
  mockIsDescendantOf: vi.fn(),
  mockCreateTenantScopedId: vi.fn(),
}));

vi.mock('./tenantContext.js', () => ({
  assertTenantAccess: mockAssertTenantAccess,
  parseTenantId: mockParseTenantId,
  isDescendantOf: mockIsDescendantOf,
  createTenantScopedId: mockCreateTenantScopedId,
}));

// Import the module under test after mocks are set up
import {
  TenantAuthorizationErrorCode,
  TenantAuthorizationError,
  evaluateTenantAuthorization,
  assertTenantAuthorization,
  createTenantAuthMiddleware,
  guardTenantOperation,
  filterTenantResponse,
  createTenantAuditEntry,
} from './tenantAuthorization.js';
import { defaultAuthorizationService } from './serverAuthorizationPolicyService.js';
import { assertTenantAccess, parseTenantId, isDescendantOf, createTenantScopedId } from './tenantContext.js';

describe('Tenant Authorization Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockParseTenantId.mockImplementation((id) => {
      const match = id?.match(/^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT):(.+)$/);
      if (!match) return null;
      return { level: match[1].toLowerCase(), code: match[2].toUpperCase(), fullId: id };
    });
    mockIsDescendantOf.mockReturnValue(false);
    mockCreateTenantScopedId.mockReturnValue('MUNICIPALITY_IN-KA-BLR-BBMP_doc123');
    
    mockDefaultAuthorizationService.evaluate.mockReturnValue({ allowed: true, code: 'AUTHORIZED' });
  });

  describe('TenantAuthorizationError', () => {
    it('creates error with code and details', () => {
      const error = new TenantAuthorizationError('Access denied', TenantAuthorizationErrorCode.TENANT_ACCESS_DENIED, { tenantId: 'STATE:IN-KA' });
      
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe(TenantAuthorizationErrorCode.TENANT_ACCESS_DENIED);
      expect(error.details).toEqual({ tenantId: 'STATE:IN-KA' });
    });
  });

  describe('evaluateTenantAuthorization', () => {
    it('returns base auth result when base auth fails', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({
        allowed: false,
        code: 'UNAUTHENTICATED',
        reason: 'Not authenticated',
      });
      
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1' },
        action: 'VIEW',
        resourceType: 'documents',
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('UNAUTHENTICATED');
    });

    it('allows system-level resources without tenant', async () => {
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1' },
        action: 'VIEW',
        resourceType: 'auditLogs',
      });
      
      expect(result.allowed).toBe(true);
      expect(result.code).toBe('AUTHORIZED_SYSTEM_RESOURCE');
    });

    it('denies tenant-scoped resources without tenant context', async () => {
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1' },
        action: 'VIEW',
        resourceType: 'documents',
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TENANT_CONTEXT_REQUIRED');
    });

    it('allows access when tenant matches principal', async () => {
      mockAssertTenantAccess.mockImplementationOnce(() => {});
      
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'VIEW',
        resourceType: 'documents',
        resource: { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      });
      
      expect(result.allowed).toBe(true);
      expect(result.tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('denies cross-tenant access', async () => {
      mockAssertTenantAccess.mockImplementationOnce(() => {
        throw new Error('TENANT_ACCESS_DENIED');
      });
      
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'VIEW',
        resourceType: 'documents',
        resource: { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TENANT_ACCESS_DENIED');
    });

    it('rejects invalid tenant ID format', async () => {
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1' },
        action: 'VIEW',
        resourceType: 'documents',
        tenantId: 'INVALID_FORMAT',
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TENANT_ID_INVALID');
    });

    it('detects cross-tenant leak in resource when explicit tenantId differs from resource tenantId', async () => {
      mockAssertTenantAccess.mockImplementationOnce(() => {});
      
      // Provide explicit tenantId that differs from resource.tenantId
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'VIEW',
        resourceType: 'documents',
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', // Explicit tenant context
        resource: { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' }, // Resource from different tenant
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CROSS_TENANT_LEAK');
    });

    it('detects cross-tenant leak in array response', async () => {
      mockAssertTenantAccess.mockImplementationOnce(() => {});
      
      const result = await evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'view', // lowercase to match CivicAction.VIEW
        resourceType: 'documents',
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        resource: [
          { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
          { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' }, // Cross-tenant leak
          { id: '3', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        ],
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CROSS_TENANT_LEAK');
      expect(result.details.leakedCount).toBe(1);
    });
  });

  describe('assertTenantAuthorization', () => {
    it('returns tenant ID when authorized', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({ allowed: true });
      mockAssertTenantAccess.mockImplementationOnce(() => {});
      
      const tenantId = await assertTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'VIEW',
        resourceType: 'documents',
        resource: { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      });
      
      expect(tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('throws TenantAuthorizationError when denied', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({
        allowed: false,
        code: 'TENANT_ACCESS_DENIED',
        reason: 'Access denied',
        details: { targetTenantId: 'STATE:IN-KA' },
      });
      
      await expect(assertTenantAuthorization({
        principal: { id: 'user1' },
        action: 'VIEW',
        resourceType: 'documents',
        tenantId: 'STATE:IN-KA',
      })).rejects.toThrow('Access denied');
    });
  });

  describe('createTenantAuthMiddleware', () => {
    it('creates middleware that attaches tenant context', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({
        allowed: true,
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
      });
      
      const middleware = createTenantAuthMiddleware({
        resourceType: 'documents',
        getTenantId: (req) => req.query.tenantId,
      });
      
      const req = {
        auth: { user: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] } },
        method: 'GET',
        query: { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.tenantContext).toEqual({
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        authorized: true,
      });
    });

    it('returns 401 when no principal', async () => {
      const middleware = createTenantAuthMiddleware({ resourceType: 'documents' });
      
      const req = { method: 'GET' };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        code: 'UNAUTHENTICATED',
      });
    });

    it('returns 403 when authorization denied', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({
        allowed: false,
        code: 'TENANT_ACCESS_DENIED',
        reason: 'Access denied',
        details: { targetTenantId: 'STATE:IN-KA' },
      });
      
      const middleware = createTenantAuthMiddleware({ resourceType: 'documents' });
      
      const req = {
        auth: { user: { id: 'user1' } },
        method: 'GET',
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        code: 'TENANT_ACCESS_DENIED',
        message: 'Access denied',
        details: { targetTenantId: 'STATE:IN-KA' },
      });
    });
  });

  describe('guardTenantOperation', () => {
    it('allows authorized operation', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({
        allowed: true,
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
      });
      mockAssertTenantAccess.mockImplementationOnce(() => {});
      
      const tenantId = await guardTenantOperation({
        actor: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        operation: 'read',
        targetTenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        resourceType: 'documents',
      });
      
      expect(tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('throws when denied', async () => {
      mockDefaultAuthorizationService.evaluate.mockReturnValueOnce({
        allowed: false,
        code: 'TENANT_ACCESS_DENIED',
        reason: 'Access denied',
        details: { targetTenantId: 'STATE:IN-KA' },
      });
      
      await expect(guardTenantOperation({
        actor: { id: 'user1' },
        operation: 'read',
        targetTenantId: 'STATE:IN-KA',
        resourceType: 'documents',
      })).rejects.toThrow('Access denied');
    });
  });

  describe('filterTenantResponse', () => {
    it('filters array to authorized tenant', () => {
      const data = [
        { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
        { id: '3', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      ];
      
      const result = filterTenantResponse(data, 'MUNICIPALITY:IN-KA-BLR-BBMP');
      
      expect(result).toHaveLength(2);
      expect(result.every(d => d.tenantId === 'MUNICIPALITY:IN-KA-BLR-BBMP')).toBe(true);
    });

    it('returns non-tenant-scoped data unchanged', () => {
      const data = [
        { id: '1', name: 'Public data' },
        { id: '2', name: 'More public data' },
      ];
      
      const result = filterTenantResponse(data, 'MUNICIPALITY:IN-KA-BLR-BBMP');
      
      expect(result).toEqual(data);
    });

    it('allows system view to see all', () => {
      const data = [
        { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
      ];
      
      const result = filterTenantResponse(data, null, true);
      
      expect(result).toEqual(data);
    });

    it('returns null for single object with wrong tenant', () => {
      const data = { id: '1', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' };
      
      const result = filterTenantResponse(data, 'MUNICIPALITY:IN-KA-BLR-BBMP');
      
      expect(result).toBeNull();
    });
  });

  describe('createTenantAuditEntry', () => {
    it('creates audit entry with all fields', () => {
      const entry = createTenantAuditEntry({
        actor: { id: 'user1', role: 'operator' },
        action: 'VIEW',
        resourceType: 'documents',
        resourceId: 'doc123',
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        outcome: 'allowed',
        details: { query: 'test' },
      });
      
      expect(entry.actorId).toBe('user1');
      expect(entry.actorRole).toBe('operator');
      expect(entry.action).toBe('VIEW');
      expect(entry.resourceType).toBe('documents');
      expect(entry.resourceId).toBe('doc123');
      expect(entry.tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
      expect(entry.outcome).toBe('allowed');
      expect(entry.details).toEqual({ query: 'test' });
      expect(entry.id).toMatch(/^audit_\d+_[a-z0-9]+$/);
      expect(entry._schemaVersion).toBe('1.0.0');
    });
  });
});