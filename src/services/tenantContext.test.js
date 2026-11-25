/**
 * @file Tenant Context Tests
 * 
 * Tests for tenant boundary resolution, validation, and scoping utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock accessControl using vi.hoisted to avoid hoisting issues
const { mockGetCurrentActor, mockResolveActorJurisdictions } = vi.hoisted(() => ({
  mockGetCurrentActor: vi.fn(() => null),
  mockResolveActorJurisdictions: vi.fn(() => []),
}));

vi.mock('./accessControl.js', () => ({
  getCurrentActor: mockGetCurrentActor,
  resolveActorJurisdictions: mockResolveActorJurisdictions,
}));

import {
  TenantLevel,
  TENANT_LEVEL_HIERARCHY,
  parseTenantId,
  isValidTenantId,
  getParentTenantId,
  getAncestorTenantIds,
  isDescendantOf,
  resolveTenantContext,
  assertTenantAccess,
  createTenantScopedId,
  extractTenantIdFromScopedId,
} from './tenantContext.js';

describe('Tenant Context Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentActor.mockReturnValue(null);
    mockResolveActorJurisdictions.mockReturnValue([]);
  });

  describe('parseTenantId', () => {
    it('parses state-level tenant ID', () => {
      const result = parseTenantId('STATE:IN-KA');
      expect(result).toEqual({
        level: 'state',
        code: 'IN-KA',
        fullId: 'STATE:IN-KA',
      });
    });

    it('parses district-level tenant ID', () => {
      const result = parseTenantId('DISTRICT:IN-KA-BLR');
      expect(result).toEqual({
        level: 'district',
        code: 'IN-KA-BLR',
        fullId: 'DISTRICT:IN-KA-BLR',
      });
    });

    it('parses municipality-level tenant ID', () => {
      const result = parseTenantId('MUNICIPALITY:IN-KA-BLR-BBMP');
      expect(result).toEqual({
        level: 'municipality',
        code: 'IN-KA-BLR-BBMP',
        fullId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
      });
    });

    it('parses department-level tenant ID', () => {
      const result = parseTenantId('DEPARTMENT:IN-KA-BLR-BBMP-WATER');
      expect(result).toEqual({
        level: 'department',
        code: 'IN-KA-BLR-BBMP-WATER',
        fullId: 'DEPARTMENT:IN-KA-BLR-BBMP-WATER',
      });
    });

    it('returns null for invalid format', () => {
      expect(parseTenantId('INVALID')).toBeNull();
      expect(parseTenantId('STATE')).toBeNull();
      expect(parseTenantId('')).toBeNull();
      expect(parseTenantId(null)).toBeNull();
    });

    it('normalizes code to uppercase', () => {
      const result = parseTenantId('state:in-ka');
      expect(result.code).toBe('IN-KA');
    });
  });

  describe('isValidTenantId', () => {
    it('validates correct tenant IDs', () => {
      expect(isValidTenantId('STATE:IN-KA')).toBe(true);
      expect(isValidTenantId('DISTRICT:IN-KA-BLR')).toBe(true);
      expect(isValidTenantId('MUNICIPALITY:IN-KA-BLR-BBMP')).toBe(true);
      expect(isValidTenantId('DEPARTMENT:IN-KA-BLR-BBMP-WATER')).toBe(true);
    });

    it('rejects invalid tenant IDs', () => {
      expect(isValidTenantId('INVALID')).toBe(false);
      expect(isValidTenantId('STATE')).toBe(false);
      expect(isValidTenantId('')).toBe(false);
      expect(isValidTenantId('state:in-ka')).toBe(false); // lowercase level
    });
  });

  describe('getParentTenantId', () => {
    it('returns parent for district', () => {
      expect(getParentTenantId('DISTRICT:IN-KA-BLR')).toBe('STATE:IN-KA');
    });

    it('returns parent for municipality', () => {
      expect(getParentTenantId('MUNICIPALITY:IN-KA-BLR-BBMP')).toBe('DISTRICT:IN-KA-BLR');
    });

    it('returns parent for department', () => {
      expect(getParentTenantId('DEPARTMENT:IN-KA-BLR-BBMP-WATER')).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('returns null for state (top level)', () => {
      expect(getParentTenantId('STATE:IN-KA')).toBeNull();
    });

    it('returns null for invalid ID', () => {
      expect(getParentTenantId('INVALID')).toBeNull();
    });
  });

  describe('getAncestorTenantIds', () => {
    it('returns all ancestors for department', () => {
      const ancestors = getAncestorTenantIds('DEPARTMENT:IN-KA-BLR-BBMP-WATER');
      expect(ancestors).toEqual([
        'MUNICIPALITY:IN-KA-BLR-BBMP',
        'DISTRICT:IN-KA-BLR',
        'STATE:IN-KA',
      ]);
    });

    it('returns ancestors for municipality', () => {
      const ancestors = getAncestorTenantIds('MUNICIPALITY:IN-KA-BLR-BBMP');
      expect(ancestors).toEqual([
        'DISTRICT:IN-KA-BLR',
        'STATE:IN-KA',
      ]);
    });

    it('returns empty for state', () => {
      expect(getAncestorTenantIds('STATE:IN-KA')).toEqual([]);
    });
  });

  describe('isDescendantOf', () => {
    it('returns true for direct parent-child', () => {
      expect(isDescendantOf('DISTRICT:IN-KA-BLR', 'STATE:IN-KA')).toBe(true);
      expect(isDescendantOf('MUNICIPALITY:IN-KA-BLR-BBMP', 'DISTRICT:IN-KA-BLR')).toBe(true);
      expect(isDescendantOf('DEPARTMENT:IN-KA-BLR-BBMP-WATER', 'MUNICIPALITY:IN-KA-BLR-BBMP')).toBe(true);
    });

    it('returns true for multi-level ancestry', () => {
      expect(isDescendantOf('DEPARTMENT:IN-KA-BLR-BBMP-WATER', 'STATE:IN-KA')).toBe(true);
      expect(isDescendantOf('MUNICIPALITY:IN-KA-BLR-BBMP', 'STATE:IN-KA')).toBe(true);
    });

    it('returns false for non-ancestor', () => {
      expect(isDescendantOf('DISTRICT:IN-KA-BLR', 'STATE:IN-MH')).toBe(false);
      expect(isDescendantOf('STATE:IN-KA', 'DISTRICT:IN-KA-BLR')).toBe(false);
    });

    it('returns false for invalid IDs', () => {
      expect(isDescendantOf('INVALID', 'STATE:IN-KA')).toBe(false);
      expect(isDescendantOf('DISTRICT:IN-KA-BLR', 'INVALID')).toBe(false);
    });
  });

  describe('resolveTenantContext', () => {
    it('returns system context for null actor', () => {
      const context = resolveTenantContext(null);
      expect(context).toEqual({
        tenantId: null,
        level: null,
        isSystem: true,
      });
    });

    it('returns explicit tenant from actor', () => {
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      const context = resolveTenantContext(actor);
      expect(context).toEqual({
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        level: 'municipality',
        code: 'IN-KA-BLR-BBMP',
        isSystem: false,
      });
    });

    it('returns system context when actor has no tenant', () => {
      const actor = { role: 'admin' };
      const context = resolveTenantContext(actor);
      expect(context.isSystem).toBe(true);
    });

    it('resolves tenant from jurisdictions when no explicit tenantId', () => {
      const actor = { role: 'operator' };
      mockResolveActorJurisdictions.mockReturnValue(['MUNICIPALITY:IN-KA-BLR-BBMP', 'MUNICIPALITY:IN-KA-MYS-MCC']);
      
      const context = resolveTenantContext(actor);
      expect(context.tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP'); // Most specific (deepest)
      expect(context.level).toBe('municipality');
      expect(context.isSystem).toBe(false);
    });

    it('returns system context when no jurisdictions', () => {
      const actor = { role: 'admin' };
      mockResolveActorJurisdictions.mockReturnValue([]);
      
      const context = resolveTenantContext(actor);
      expect(context.isSystem).toBe(true);
    });
  });

  describe('assertTenantAccess', () => {
    it('allows system actor to access any tenant', () => {
      const actor = { role: 'admin' };
      mockResolveActorJurisdictions.mockReturnValue([]);
      
      expect(() => assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP')).not.toThrow();
    });

    it('allows actor to access their own tenant', () => {
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      expect(() => assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP')).not.toThrow();
    });

    it('allows actor to access descendant tenant', () => {
      const actor = { tenantId: 'DISTRICT:IN-KA-BLR' };
      expect(() => assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP')).not.toThrow();
    });

    it('allows actor to access assigned jurisdiction', () => {
      const actor = { 
        tenantId: 'STATE:IN-KA',
        jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP', 'MUNICIPALITY:IN-KA-MYS-MCC']
      };
      expect(() => assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP')).not.toThrow();
    });

    it('denies access to unrelated tenant', () => {
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      expect(() => assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-MYS-MCC'))
        .toThrow('TENANT_ACCESS_DENIED');
    });

    it('denies access to parent tenant (no upward access)', () => {
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      expect(() => assertTenantAccess(actor, 'DISTRICT:IN-KA-BLR'))
        .toThrow('TENANT_ACCESS_DENIED');
    });

    it('throws for missing target tenant', () => {
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      expect(() => assertTenantAccess(actor, null))
        .toThrow('Target tenant ID is required');
    });

    it('allows access via assigned jurisdiction ancestor', () => {
      const actor = { 
        tenantId: 'STATE:IN-KA',
        jurisdictionIds: ['DISTRICT:IN-KA-BLR']
      };
      expect(() => assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP')).not.toThrow();
    });
  });

  describe('createTenantScopedId', () => {
    it('creates scoped ID with tenant prefix', () => {
      const id = createTenantScopedId('MUNICIPALITY:IN-KA-BLR-BBMP', 'doc123');
      expect(id).toBe('MUNICIPALITY_IN-KA-BLR-BBMP_doc123');
    });

    it('throws for invalid tenant ID', () => {
      expect(() => createTenantScopedId('INVALID', 'doc123')).toThrow('Invalid tenant ID');
    });
  });

  describe('extractTenantIdFromScopedId', () => {
    it('extracts tenant ID from scoped ID', () => {
      const scopedId = 'MUNICIPALITY_IN-KA-BLR-BBMP_doc123';
      const result = extractTenantIdFromScopedId(scopedId);
      expect(result).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('returns null for non-scoped ID', () => {
      expect(extractTenantIdFromScopedId('doc123')).toBeNull();
      expect(extractTenantIdFromScopedId('INVALID_doc123')).toBeNull();
    });

    it('handles scoped ID with underscores in local ID', () => {
      const scopedId = 'STATE_IN-KA_doc_123_test';
      const result = extractTenantIdFromScopedId(scopedId);
      expect(result).toBe('STATE:IN-KA');
    });
  });
});