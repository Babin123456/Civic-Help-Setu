/**
 * @file Tenant Queries Tests
 * 
 * Tests for tenant-scoped query helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted for mock functions to avoid hoisting issues
const {
  mockGetFirebaseAdminApp,
  mockGetFirestoreAdmin,
  mockResetFirebaseAdminCacheForTests,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockStartAfter,
  mockGetDocs,
  mockGetCountFromServer,
  mockDoc,
  mockGetDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockWriteBatch,
  mockAddDoc,
  mockServerTimestamp,
  mockQueryObj,
} = vi.hoisted(() => {
  const queryObj = {
    _constraints: [],
    where: vi.fn(function() { this._constraints.push({ type: 'where', args: Array.from(arguments) }); return this; }),
    orderBy: vi.fn(function() { this._constraints.push({ type: 'orderBy', args: Array.from(arguments) }); return this; }),
    limit: vi.fn(function() { this._constraints.push({ type: 'limit', args: Array.from(arguments) }); return this; }),
    startAfter: vi.fn(function() { this._constraints.push({ type: 'startAfter', args: Array.from(arguments) }); return this; }),
  };
  
  return {
    mockGetFirebaseAdminApp: vi.fn().mockResolvedValue({}),
    mockGetFirestoreAdmin: vi.fn().mockResolvedValue({}),
    mockResetFirebaseAdminCacheForTests: vi.fn(),
    mockQueryObj: queryObj,
    mockCollection: vi.fn(() => queryObj),
    mockQuery: vi.fn((colRef, ...constraints) => queryObj),
    mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
    mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    mockLimit: vi.fn((n) => ({ type: 'limit', n })),
    mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
    mockGetDocs: vi.fn(),
    mockGetCountFromServer: vi.fn(),
    mockDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockWriteBatch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
    mockAddDoc: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
    mockServerTimestamp: vi.fn(() => new Date().toISOString()),
  };
});

vi.mock('../_lib/firebaseAdmin.js', () => ({
  db: {},
  getFirebaseAdminApp: mockGetFirebaseAdminApp,
  getFirestoreAdmin: mockGetFirestoreAdmin,
  resetFirebaseAdminCacheForTests: mockResetFirebaseAdminCacheForTests,
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  getDocs: mockGetDocs,
  getCountFromServer: mockGetCountFromServer,
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  writeBatch: mockWriteBatch,
  addDoc: mockAddDoc,
  serverTimestamp: mockServerTimestamp,
}));

// Mock tenantContext
vi.mock('./tenantContext.js', () => ({
  resolveTenantContext: vi.fn(),
  assertTenantAccess: vi.fn(),
  parseTenantId: vi.fn(),
  isDescendantOf: vi.fn(),
  createTenantScopedId: vi.fn(),
  TenantLevel: {
    STATE: 'state',
    DISTRICT: 'district',
    MUNICIPALITY: 'municipality',
    DEPARTMENT: 'department',
  },
}));

// Import mocks after vi.mock
import { resolveTenantContext, assertTenantAccess, parseTenantId, isDescendantOf, createTenantScopedId, TenantLevel } from './tenantContext.js';

// Import the module under test after mocks are set up
import {
  buildTenantQuery,
  executeTenantQuery,
  countTenantQuery,
  paginateTenantQuery,
  validateDocumentTenant,
  filterDocumentsByTenant,
  createTenantDocument,
  updateTenantDocument,
  deleteTenantDocument,
} from './tenantQueries.js';

describe('Tenant Queries Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations - can be overridden in individual tests
    resolveTenantContext.mockImplementation((actor) => {
      if (!actor || actor.isSystem) {
        return { tenantId: null, level: null, isSystem: true };
      }
      if (actor.tenantId) {
        return {
          tenantId: actor.tenantId,
          level: 'municipality',
          code: 'IN-KA-BLR-BBMP',
          isSystem: false,
        };
      }
      return { tenantId: null, level: null, isSystem: true };
    });
    assertTenantAccess.mockImplementation(() => {});
    parseTenantId.mockImplementation((id) => {
      const match = id?.match(/^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT):(.+)$/i);
      if (!match) return null;
      return { level: match[1].toLowerCase(), code: match[2].toUpperCase(), fullId: id };
    });
    isDescendantOf.mockReturnValue(false);
    createTenantScopedId.mockReturnValue('MUNICIPALITY_IN-KA-BLR-BBMP_doc123');
    
    // Firestore mock defaults
    mockQueryObj._constraints = [];
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }) });
  });

  describe('buildTenantQuery', () => {
    it('builds query with tenant filter for non-system actor', async () => {
      const q = await buildTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', role: 'operator', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        additionalConstraints: [],
      });
      
      expect(q).toBeDefined();
      expect(mockCollection).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
    });

    it('builds query without tenant filter for system actor', async () => {
      const q = await buildTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'admin1', role: 'admin', isSystem: true },
        additionalConstraints: [],
      });
      
      expect(q).toBeDefined();
      expect(mockCollection).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
    });

    it('throws when tenant context cannot be resolved for non-system actor', async () => {
      // Override mock to return non-system context without tenantId
      resolveTenantContext.mockReturnValueOnce({ tenantId: null, level: null, isSystem: false });
      
      await expect(buildTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', role: 'operator' },
        additionalConstraints: [],
      })).rejects.toThrow('TENANT_CONTEXT_REQUIRED');
    });
  });

  describe('executeTenantQuery', () => {
    it('executes query and returns documents', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', data: () => ({ name: 'Test 1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }) },
          { id: 'doc2', data: () => ({ name: 'Test 2', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }) },
        ],
      });
      
      const result = await executeTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      });
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test 1');
    });
  });

  describe('countTenantQuery', () => {
    it('returns document count', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 42 }) });
      
      const count = await countTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      });
      
      expect(count).toBe(42);
    });
  });

  describe('paginateTenantQuery', () => {
    it('returns paginated results with cursor', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 100 }) });
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', data: () => ({ name: 'Test 1' }) },
          { id: 'doc2', data: () => ({ name: 'Test 2' }) },
          { id: 'doc3', data: () => ({ name: 'Test 3' }) },
        ],
      });
      
      const result = await paginateTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        pageSize: 2,
      });
      
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('doc2');
      expect(result.total).toBe(100);
      expect(result.hasNextPage).toBe(true);
    });
  });

  describe('validateDocumentTenant', () => {
    it('returns true for matching tenant', () => {
      const doc = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      
      const result = validateDocumentTenant(doc, actor);
      expect(result).toBe(true);
    });

    it('returns true for descendant tenant', () => {
      isDescendantOf.mockReturnValueOnce(true);
      
      const doc = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      const actor = { tenantId: 'DISTRICT:IN-KA-BLR' };
      
      const result = validateDocumentTenant(doc, actor);
      expect(result).toBe(true);
    });

    it('returns false for non-matching tenant', () => {
      isDescendantOf.mockReturnValue(false);
      
      const doc = { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' };
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      
      const result = validateDocumentTenant(doc, actor);
      expect(result).toBe(false);
    });

    it('returns true for system actor', () => {
      const doc = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      const actor = { isSystem: true };
      
      const result = validateDocumentTenant(doc, actor);
      expect(result).toBe(true);
    });

    it('returns false for document without tenantId', () => {
      const doc = { name: 'Test' };
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      
      const result = validateDocumentTenant(doc, actor);
      expect(result).toBe(false);
    });
  });

  describe('filterDocumentsByTenant', () => {
    it('filters documents to only matching tenant', () => {
      const docs = [
        { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
        { id: '3', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      ];
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      
      const result = filterDocumentsByTenant(docs, actor);
      expect(result).toHaveLength(2);
      expect(result.every(d => d.tenantId === 'MUNICIPALITY:IN-KA-BLR-BBMP')).toBe(true);
    });

    it('returns all documents for system actor', () => {
      const docs = [
        { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
      ];
      const actor = { isSystem: true };
      
      const result = filterDocumentsByTenant(docs, actor);
      expect(result).toHaveLength(2);
    });
  });

  describe('createTenantDocument', () => {
    it('creates document with tenant context', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-doc-id' });
      
      const result = await createTenantDocument('test_collection', { name: 'Test' }, { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' });
      
      expect(result.id).toBe('new-doc-id');
      expect(result.data.tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('throws when tenant context required', async () => {
      await expect(createTenantDocument('test_collection', { name: 'Test' }, { id: 'user1' }))
        .rejects.toThrow('TENANT_ID_REQUIRED');
    });
  });

  describe('updateTenantDocument', () => {
    it('updates document with tenant validation', async () => {
      await updateTenantDocument('test_collection', 'doc1', { name: 'Updated' }, { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' });
    });

    it('throws when tenant access denied', async () => {
      assertTenantAccess.mockImplementationOnce(() => {
        throw new Error('TENANT_ACCESS_DENIED');
      });
      
      await expect(updateTenantDocument('test_collection', 'doc1', { name: 'Updated' }, { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }))
        .rejects.toThrow('TENANT_ACCESS_DENIED');
    });

    it('prevents tenantId modification', async () => {
      await expect(updateTenantDocument('test_collection', 'doc1', { 
        tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' 
      }, { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' })).rejects.toThrow('TENANT_ID_IMMUTABLE');
    });
  });

  describe('deleteTenantDocument', () => {
    it('deletes document with tenant validation', async () => {
      await deleteTenantDocument('test_collection', 'doc1', { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' });
    });

    it('throws when tenant access denied', async () => {
      assertTenantAccess.mockImplementationOnce(() => {
        throw new Error('TENANT_ACCESS_DENIED');
      });
      
      await expect(deleteTenantDocument('test_collection', 'doc1', { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }))
        .rejects.toThrow('TENANT_ACCESS_DENIED');
    });
  });
});