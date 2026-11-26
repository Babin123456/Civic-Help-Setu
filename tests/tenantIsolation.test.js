/**
 * @file Tenant Isolation Integration Tests
 * 
 * Cross-tenant access tests covering every repository/service layer.
 * Uses synthetic data only.
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
  mockDefaultAuthorizationService,
  mockCivicRole,
  mockCivicAction,
  mockGetCurrentActor,
  mockResolveActorJurisdictions,
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
    mockGetCurrentActor: vi.fn(() => null),
    mockResolveActorJurisdictions: vi.fn(() => []),
  };
});

vi.mock('../src/_lib/firebaseAdmin.js', () => ({
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

vi.mock('../src/services/serverAuthorizationPolicyService.js', () => ({
  defaultAuthorizationService: mockDefaultAuthorizationService,
  CivicRole: mockCivicRole,
  CivicAction: mockCivicAction,
}));

// Mock accessControl which is used by tenantContext
vi.mock('../src/services/accessControl.js', () => ({
  getCurrentActor: mockGetCurrentActor,
  resolveActorJurisdictions: mockResolveActorJurisdictions,
}));

// Import the actual implementations (not mocked)
import * as tenantContext from '../src/services/tenantContext.js';
import * as tenantQueries from '../src/services/tenantQueries.js';
import * as tenantAuthorization from '../src/services/tenantAuthorization.js';
import * as tenantMigration from '../src/services/tenantMigration.js';
import * as serverAuth from '../src/services/serverAuthorizationPolicyService.js';

describe('Tenant Isolation - Cross-Layer Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup accessControl mocks for tenantContext
    mockGetCurrentActor.mockReturnValue(null);
    mockResolveActorJurisdictions.mockReturnValue([]);
    
    // Setup server auth mock
    serverAuth.defaultAuthorizationService.evaluate.mockReturnValue({ allowed: true, code: 'AUTHORIZED' });
    
    // Firestore mock defaults
    mockQueryObj._constraints = [];
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }) });
  });

  describe('Tenant Context Layer', () => {
    it('resolves tenant context from actor', () => {
      const actor = { tenantId: 'DISTRICT:IN-KA-BLR' };
      const context = tenantContext.resolveTenantContext(actor);
      
      expect(context.tenantId).toBe('DISTRICT:IN-KA-BLR');
      expect(context.level).toBe('district');
      expect(context.isSystem).toBe(false);
    });

    it('returns system context for admin with no tenant', () => {
      const actor = { role: 'admin', jurisdictionIds: [] };
      const context = tenantContext.resolveTenantContext(actor);
      
      expect(context.isSystem).toBe(true);
    });

    it('validates tenant access for descendant tenants', () => {
      const actor = { tenantId: 'DISTRICT:IN-KA-BLR' };
      expect(() => tenantContext.assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP')).not.toThrow();
    });

    it('denies tenant access for unrelated tenants', () => {
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      expect(() => tenantContext.assertTenantAccess(actor, 'MUNICIPALITY:IN-KA-MYS-MCC')).toThrow('TENANT_ACCESS_DENIED');
    });

    it('creates tenant-scoped IDs', () => {
      const scopedId = tenantContext.createTenantScopedId('MUNICIPALITY:IN-KA-BLR-BBMP', 'doc123');
      expect(scopedId).toBe('MUNICIPALITY_IN-KA-BLR-BBMP_doc123');
    });
  });

  describe('Tenant Queries Layer', () => {
    it('builds tenant-scoped query for non-system actor', async () => {
      const query = await tenantQueries.buildTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        additionalConstraints: [],
      });
      
      expect(query).toBeDefined();
      expect(mockCollection).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
    });

    it('builds query without tenant filter for system actor', async () => {
      // Mock getCurrentActor to return null (system)
      mockGetCurrentActor.mockReturnValue(null);
      mockResolveActorJurisdictions.mockReturnValue([]);
      
      const query = await tenantQueries.buildTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'admin1', role: 'admin' },
        additionalConstraints: [],
      });
      
      expect(query).toBeDefined();
    });

    it('executes tenant-scoped query', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', data: () => ({ name: 'Test 1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }) },
          { id: 'doc2', data: () => ({ name: 'Test 2', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' }) },
        ],
      });
      
      const results = await tenantQueries.executeTenantQuery({
        collectionPath: 'test_collection',
        actor: { id: 'user1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      });
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Test 1');
    });

    it('validates document tenant membership', () => {
      const doc = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      
      expect(tenantQueries.validateDocumentTenant(doc, actor)).toBe(true);
    });

    it('rejects document from different tenant', () => {
      const doc = { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' };
      const actor = { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' };
      
      expect(tenantQueries.validateDocumentTenant(doc, actor)).toBe(false);
    });

    it('filters documents by tenant', () => {
      const docs = [
        { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
        { id: '3', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      ];
      
      const filtered = tenantQueries.filterDocumentsByTenant(docs, { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(d => d.tenantId === 'MUNICIPALITY:IN-KA-BLR-BBMP')).toBe(true);
    });
  });

  describe('Tenant Authorization Layer', () => {
    it('allows access when tenant matches', async () => {
      // Mock resolveActorJurisdictions to return the principal's jurisdictions
      mockResolveActorJurisdictions.mockReturnValue(['MUNICIPALITY:IN-KA-BLR-BBMP']);
      
      const result = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'view',
        resourceType: 'documents',
        resource: { tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      });
      
      expect(result.allowed).toBe(true);
      expect(result.tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('denies cross-tenant access', async () => {
      // Mock resolveActorJurisdictions to return the principal's jurisdictions
      mockResolveActorJurisdictions.mockReturnValue(['MUNICIPALITY:IN-KA-BLR-BBMP']);
      
      const result = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'view',
        resourceType: 'documents',
        resource: { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TENANT_ACCESS_DENIED');
    });

    it('detects cross-tenant leak in resource', async () => {
      const result = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'view',
        resourceType: 'documents',
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        resource: { tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CROSS_TENANT_LEAK');
    });

    it('detects cross-tenant leak in array response', async () => {
      const result = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] },
        action: 'view',
        resourceType: 'documents',
        tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP',
        resource: [
          { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
          { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
          { id: '3', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        ],
      });
      
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('CROSS_TENANT_LEAK');
      expect(result.details.leakedCount).toBe(1);
    });

    it('filters response data to prevent leaks', () => {
      const data = [
        { id: '1', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
        { id: '2', tenantId: 'MUNICIPALITY:IN-KA-MYS-MCC' },
        { id: '3', tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP' },
      ];
      
      const filtered = tenantAuthorization.filterTenantResponse(data, 'MUNICIPALITY:IN-KA-BLR-BBMP');
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(d => d.tenantId === 'MUNICIPALITY:IN-KA-BLR-BBMP')).toBe(true);
    });
  });

  describe('Tenant Migration Layer', () => {
    it('creates migration plan with tenant resolver', () => {
      const plan = tenantMigration.createMigrationPlan({
        id: 'test_migration',
        name: 'Test Migration',
        collectionPath: 'source_collection',
        targetCollectionPath: 'target_collection',
        tenantResolver: (doc) => 'MUNICIPALITY:IN-KA-BLR-BBMP',
      });
      
      expect(plan.id).toBe('test_migration');
      expect(plan.tenantResolver({})).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    });

    it('generates synthetic migration data across tenants', () => {
      const tenants = ['STATE:IN-KA', 'DISTRICT:IN-KA-BLR'];
      const documents = tenantMigration.generateSyntheticMigrationData({
        count: 10,
        tenants,
        template: (tenantId, index) => ({ id: `doc_${index}`, tenantId, value: index }),
      });
      
      expect(documents).toHaveLength(10);
      expect(documents[0].tenantId).toBe('STATE:IN-KA');
      expect(documents[1].tenantId).toBe('DISTRICT:IN-KA-BLR');
      expect(documents[2].tenantId).toBe('STATE:IN-KA');
    });
  });

  describe('Cross-Layer Integration', () => {
    it('enforces tenant isolation across all layers', async () => {
      // 1. Context layer resolves tenant
      const context = tenantContext.resolveTenantContext({ 
        tenantId: 'DISTRICT:IN-KA-BLR' 
      });
      expect(context.tenantId).toBe('DISTRICT:IN-KA-BLR');
      
      // 2. Queries layer builds tenant-scoped query
      const query = await tenantQueries.buildTenantQuery({
        collectionPath: 'documents',
        actor: { id: 'user1', tenantId: context.tenantId },
      });
      expect(query).toBeDefined();
      
      // 3. Authorization layer validates access
      const authResult = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1', jurisdictionIds: [context.tenantId] },
        action: 'view',
        resourceType: 'documents',
        resource: { tenantId: context.tenantId },
      });
      expect(authResult.allowed).toBe(true);
      
      // 4. Migration layer can partition by tenant
      const plan = tenantMigration.createMigrationPlan({
        id: 'cross_layer_test',
        name: 'Cross Layer Test',
        collectionPath: 'documents',
        targetCollectionPath: 'documents_partitioned',
        tenantResolver: () => context.tenantId,
      });
      expect(plan.tenantResolver({})).toBe(context.tenantId);
    });

    it('allows system actors to access system-level resources without tenant context', async () => {
      // Mock accessControl to return no actor (system)
      mockGetCurrentActor.mockReturnValue(null);
      mockResolveActorJurisdictions.mockReturnValue([]);
      
      // Queries layer allows system access
      const query = await tenantQueries.buildTenantQuery({
        collectionPath: 'documents',
        actor: { id: 'user1', role: 'admin', isSystem: true },
      });
      expect(query).toBeDefined();
      
      // Authorization layer allows system actors for system-level resources
      const authResult = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1', role: 'admin' },
        action: 'view',
        resourceType: 'auditLogs', // System-level resource
      });
      expect(authResult.allowed).toBe(true);
      expect(authResult.code).toBe('AUTHORIZED_SYSTEM_RESOURCE');
    });

    it('denies access for tenant-scoped resources without tenant context', async () => {
      // Authorization layer should deny for tenant-scoped resources without tenant context
      const authResult = await tenantAuthorization.evaluateTenantAuthorization({
        principal: { id: 'user1' },
        action: 'view',
        resourceType: 'documents',
      });
      expect(authResult.allowed).toBe(false);
      expect(authResult.code).toBe('TENANT_CONTEXT_REQUIRED');
    });
  });
});