/**
 * @file Tenant Migration Tests
 * 
 * Tests for tenant migration tooling with synthetic data only.
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

// Mock tenantContext using vi.mock with importOriginal to preserve TenantLevel
vi.mock('./tenantContext.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    parseTenantId: vi.fn(),
    isDescendantOf: vi.fn(),
    createTenantScopedId: vi.fn(),
    resolveTenantContext: vi.fn(),
    assertTenantAccess: vi.fn(),
    getAncestorTenantIds: vi.fn(),
  };
});

// Import mocks after vi.mock
import { parseTenantId, isDescendantOf, createTenantScopedId, resolveTenantContext, assertTenantAccess, getAncestorTenantIds, TenantLevel } from './tenantContext.js';

// Import the module under test after mocks are set up
import {
  MigrationStatus,
  MigrationErrorCode,
  MigrationError,
  createMigrationPlan,
  estimateMigrationCount,
  executeMigration,
  rollbackMigration,
  validateTenantIsolation,
  generateSyntheticMigrationData,
  createTestMigrationPlan,
} from './tenantMigration.js';

describe('Tenant Migration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    parseTenantId.mockImplementation((id) => {
      const match = id?.match(/^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT):(.+)$/i);
      if (!match) return null;
      return { level: match[1].toLowerCase(), code: match[2].toUpperCase(), fullId: id };
    });
    isDescendantOf.mockReturnValue(false);
    createTenantScopedId.mockReturnValue('MUNICIPALITY_IN-KA-BLR-BBMP_doc123');
    resolveTenantContext.mockReturnValue({ tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', level: 'municipality', code: 'IN-KA-BLR-BBMP', isSystem: false });
    assertTenantAccess.mockImplementation(() => {});
    getAncestorTenantIds.mockImplementation((id) => {
      const parsed = parseTenantId(id);
      if (!parsed) return [];
      const ancestors = [];
      let current = id;
      while (true) {
        const parts = current.split(':');
        if (parts.length !== 2) break;
        const [level, code] = parts;
        const codeParts = code.split('-');
        if (codeParts.length <= 1) break;
        const parentCode = codeParts.slice(0, -1).join('-');
        let parentLevel;
        switch (level) {
          case 'DISTRICT': parentLevel = 'STATE'; break;
          case 'MUNICIPALITY': parentLevel = 'DISTRICT'; break;
          case 'DEPARTMENT': parentLevel = 'MUNICIPALITY'; break;
          default: return ancestors;
        }
        current = `${parentLevel}:${parentCode}`;
        ancestors.push(current);
      }
      return ancestors;
    });
    
    // Firestore mock defaults
    mockQueryObj._constraints = [];
    mockGetDocs.mockResolvedValue({ docs: [], size: 0 });
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', _migrationId: 'test_migration' }) });
  });

  describe('createMigrationPlan', () => {
    it('creates valid migration plan', () => {
      const plan = createMigrationPlan({
        id: 'test_migration',
        name: 'Test Migration',
        collectionPath: 'source_collection',
        targetCollectionPath: 'target_collection',
        tenantResolver: (doc) => 'MUNICIPALITY:IN-KA-BLR-BBMP',
      });
      
      expect(plan.id).toBe('test_migration');
      expect(plan.name).toBe('Test Migration');
      expect(plan.options.dryRun).toBe(false);
      expect(plan.options.batchSize).toBe(500);
    });

    it('throws for missing required fields', () => {
      expect(() => createMigrationPlan({
        name: 'Test',
        collectionPath: 'source',
        targetCollectionPath: 'target',
        tenantResolver: () => 'STATE:IN-KA',
      })).toThrow('must include id, name, collectionPath, and tenantResolver');
    });

    it('applies default options', () => {
      const plan = createMigrationPlan({
        id: 'test',
        name: 'Test',
        collectionPath: 'source',
        targetCollectionPath: 'target',
        tenantResolver: () => 'STATE:IN-KA',
      });
      
      expect(plan.options.dryRun).toBe(false);
      expect(plan.options.batchSize).toBe(500);
      expect(plan.options.includeDescendants).toBe(true);
    });
  });

  describe('MigrationError', () => {
    it('creates error with code and details', () => {
      const error = new MigrationError('Test error', MigrationErrorCode.INVALID_TENANT, { docId: '123' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(MigrationErrorCode.INVALID_TENANT);
      expect(error.details).toEqual({ docId: '123' });
    });
  });

  describe('estimateMigrationCount', () => {
    it('returns document count from Firestore', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 1000 }) });
      
      const count = await estimateMigrationCount({
        collectionPath: 'test_collection',
      });
      
      expect(count).toBe(1000);
    });
  });

  describe('executeMigration', () => {
    it('executes migration in dry-run mode', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 5 }) });
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', data: () => ({ name: 'Test 1' }) },
          { id: 'doc2', data: () => ({ name: 'Test 2' }) },
        ],
        size: 2,
      });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      
      parseTenantId.mockReturnValue({ level: 'municipality', code: 'IN-KA-BLR-BBMP', fullId: 'MUNICIPALITY:IN-KA-BLR-BBMP' });
      
      const progressCallback = vi.fn();
      
      const progress = await executeMigration(createTestMigrationPlan(), {
        onProgress: progressCallback,
      });
      
      expect(progress.status).toBe('completed');
      expect(progress.totalDocuments).toBe(5);
      expect(progress.processedDocuments).toBe(2);
      expect(progress.successfulDocuments).toBe(2);
      expect(progress.failedDocuments).toBe(0);
      expect(progressCallback).toHaveBeenCalled();
    });

    it('handles tenant resolution failures', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 1 }) });
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'doc1', data: () => ({ name: 'Test' }) }],
        size: 1,
      });
      
      parseTenantId.mockReturnValueOnce(null); // Invalid tenant
      
      const plan = createTestMigrationPlan();
      plan.tenantResolver = () => 'INVALID_TENANT';
      plan.options.dryRun = false;
      
      const progress = await executeMigration(plan);
      
      // In dry-run mode, it doesn't throw but records errors
      expect(progress.failedDocuments).toBe(1);
      expect(progress.errors).toHaveLength(1);
      expect(progress.errors[0].code).toBe('MIGRATION_INVALID_TENANT');
    });

    it('respects filter option', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 3 }) });
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', data: () => ({ type: 'include' }) },
          { id: 'doc2', data: () => ({ type: 'exclude' }) },
          { id: 'doc3', data: () => ({ type: 'include' }) },
        ],
        size: 3,
      });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      
      parseTenantId.mockReturnValue({ level: 'municipality', code: 'IN-KA-BLR-BBMP', fullId: 'MUNICIPALITY:IN-KA-BLR-BBMP' });
      
      const plan = createTestMigrationPlan();
      plan.options.filter = (doc) => doc.type === 'include';
      plan.options.dryRun = false;
      
      const progress = await executeMigration(plan);
      
      expect(progress.processedDocuments).toBe(3);
      expect(progress.successfulDocuments).toBe(2);
      expect(progress.skippedDocuments).toBe(1);
    });
  });

  describe('rollbackMigration', () => {
    it('rolls back completed migration', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', ref: { id: 'doc1' }, data: () => ({ _migrationId: 'test_migration' }) },
        ],
        size: 1,
      });
      
      const batchMock = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(batchMock);
      
      const progress = {
        status: 'completed',
        successfulDocuments: 1,
      };
      
      const result = await rollbackMigration(createTestMigrationPlan(), progress);
      
      expect(result.status).toBe('rolled_back');
      expect(batchMock.delete).toHaveBeenCalled();
    });

    it('throws for non-completed migration', async () => {
      const progress = {
        status: 'running',
      };
      
      await expect(rollbackMigration(createTestMigrationPlan(), progress))
        .rejects.toThrow('Can only rollback completed migrations');
    });
  });

  describe('validateTenantIsolation', () => {
    it('validates migrated documents have tenantId', async () => {
      parseTenantId.mockImplementation((id) => {
        const match = id?.match(/^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT):(.+)$/i);
        if (!match) return null;
        return { level: match[1].toLowerCase(), code: match[2].toUpperCase(), fullId: id };
      });
      
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'doc1', data: () => ({ tenantId: 'MUNICIPALITY:IN-KA-BLR-BBMP', _migrationId: 'test_migration' }) },
          { id: 'doc2', data: () => ({ tenantId: 'DISTRICT:IN-KA-BLR', _migrationId: 'test_migration' }) },
          { id: 'doc3', data: () => ({ name: 'No tenant', _migrationId: 'test_migration' }) }, // Invalid
        ],
        size: 3,
      });
      
      const result = await validateTenantIsolation(createTestMigrationPlan());
      
      expect(result.totalDocuments).toBe(3);
      expect(result.validDocuments).toBe(2);
      expect(result.invalidDocuments).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('generateSyntheticMigrationData', () => {
    it('generates documents distributed across tenants', () => {
      const tenants = ['STATE:IN-KA', 'DISTRICT:IN-KA-BLR'];
      const documents = generateSyntheticMigrationData({
        count: 10,
        tenants,
        template: (tenantId, index) => ({ id: `doc_${index}`, tenantId, value: index }),
      });
      
      expect(documents).toHaveLength(10);
      expect(documents[0].tenantId).toBe('STATE:IN-KA');
      expect(documents[1].tenantId).toBe('DISTRICT:IN-KA-BLR');
      expect(documents[2].tenantId).toBe('STATE:IN-KA'); // Round robin
    });
  });

  describe('createTestMigrationPlan', () => {
    it('creates test plan with default tenants', () => {
      const plan = createTestMigrationPlan();
      
      expect(plan.id).toMatch(/^test_migration_\d+$/);
      expect(plan.options.dryRun).toBe(true);
      expect(plan.options.batchSize).toBe(100);
    });

    it('accepts custom collection paths', () => {
      const plan = createTestMigrationPlan({
        collectionPath: 'custom_source',
        targetCollectionPath: 'custom_target',
      });
      
      expect(plan.collectionPath).toBe('custom_source');
      expect(plan.targetCollectionPath).toBe('custom_target');
    });
  });

  describe('TenantLevel constants (re-exported from tenantContext)', () => {
    it('exports correct level hierarchy', () => {
      expect(TenantLevel.STATE).toBe('state');
      expect(TenantLevel.DISTRICT).toBe('district');
      expect(TenantLevel.MUNICIPALITY).toBe('municipality');
      expect(TenantLevel.DEPARTMENT).toBe('department');
    });
  });
});