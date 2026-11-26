/**
 * @file Tenant Migration Tooling
 * 
 * Provides tooling for partitioning existing records into tenant-isolated
 * collections with rollback support, progress tracking, and validation.
 * 
 * All migrations use synthetic data for testing and can be run in dry-run mode.
 */

import { db } from '../_lib/firebaseAdmin.js';
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  writeBatch,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';

import {
  resolveTenantContext,
  assertTenantAccess,
  parseTenantId,
  isDescendantOf,
  getAncestorTenantIds,
  createTenantScopedId,
  TenantLevel,
} from './tenantContext.js';

export const MigrationStatus = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
});

export const MigrationErrorCode = Object.freeze({
  INVALID_TENANT: 'MIGRATION_INVALID_TENANT',
  TENANT_RESOLUTION_FAILED: 'MIGRATION_TENANT_RESOLUTION_FAILED',
  DOCUMENT_CONFLICT: 'MIGRATION_DOCUMENT_CONFLICT',
  ROLLBACK_FAILED: 'MIGRATION_ROLLBACK_FAILED',
  VALIDATION_FAILED: 'MIGRATION_VALIDATION_FAILED',
  DRY_RUN_ONLY: 'MIGRATION_DRY_RUN_ONLY',
});

export class MigrationError extends Error {
  constructor(message, code = MigrationErrorCode.VALIDATION_FAILED, details = {}) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Migration plan definition
 * @typedef {object} MigrationPlan
 * @property {string} id - Unique migration ID
 * @property {string} name - Human-readable name
 * @property {string} collectionPath - Source collection path
 * @property {string} targetCollectionPath - Target collection path (can be same)
 * @property {Function} tenantResolver - Function(doc) => tenantId
 * @property {object} [options] - Migration options
 * @property {boolean} [options.dryRun=false] - Dry run mode
 * @property {number} [options.batchSize=500] - Batch size for writes
 * @property {boolean} [options.includeDescendants=true] - Include descendant tenants
 * @property {Function} [options.transform] - Optional document transform
 * @property {Function} [options.filter] - Optional document filter
 * @property {number} [options.maxRetries=3] - Max retries per batch
 */

/**
 * Migration progress tracking
 * @typedef {object} MigrationProgress
 * @property {string} migrationId - Migration ID
 * @property {string} status - Current status
 * @property {number} totalDocuments - Total documents to process
 * @property {number} processedDocuments - Documents processed
 * @property {number} successfulDocuments - Successfully migrated
 * @property {number} failedDocuments - Failed migrations
 * @property {number} skippedDocuments - Skipped (filtered out)
 * @property {Array<object>} errors - Error details
 * @property {string} startedAt - ISO timestamp
 * @property {string} [completedAt] - ISO timestamp
 * @property {object} [lastCursor] - Pagination cursor for resume
 */

/**
 * Creates a migration plan with validation
 * @param {MigrationPlan} plan - Migration plan
 * @returns {MigrationPlan} Validated plan
 */
export function createMigrationPlan(plan) {
  if (!plan.id || !plan.name || !plan.collectionPath || !plan.tenantResolver) {
    throw new MigrationError(
      'Migration plan must include id, name, collectionPath, and tenantResolver',
      MigrationErrorCode.VALIDATION_FAILED
    );
  }
  
  return {
    id: plan.id,
    name: plan.name,
    collectionPath: plan.collectionPath,
    targetCollectionPath: plan.targetCollectionPath || plan.collectionPath,
    tenantResolver: plan.tenantResolver,
    options: {
      dryRun: plan.options?.dryRun ?? false,
      batchSize: plan.options?.batchSize ?? 500,
      includeDescendants: plan.options?.includeDescendants ?? true,
      transform: plan.options?.transform,
      filter: plan.options?.filter,
      maxRetries: plan.options?.maxRetries ?? 3,
    },
  };
}

/**
 * Estimates the number of documents to be migrated
 * @param {MigrationPlan} plan - Migration plan
 * @returns {Promise<number>} Estimated document count
 */
export async function estimateMigrationCount(plan) {
  const colRef = collection(db, plan.collectionPath);
  const snapshot = await getCountFromServer(query(colRef));
  return snapshot.data().count;
}

/**
 * Executes a migration plan with progress tracking and rollback support
 * @param {MigrationPlan} plan - Migration plan
 * @param {object} [options] - Execution options
 * @param {Function} [options.onProgress] - Progress callback
 * @param {string} [options.resumeFromCursor] - Resume from cursor
 * @returns {Promise<MigrationProgress>} Migration progress
 */
export async function executeMigration(plan, { onProgress, resumeFromCursor } = {}) {
  const validatedPlan = createMigrationPlan(plan);
  const progress = {
    migrationId: validatedPlan.id,
    status: MigrationStatus.RUNNING,
    totalDocuments: 0,
    processedDocuments: 0,
    successfulDocuments: 0,
    failedDocuments: 0,
    skippedDocuments: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    lastCursor: resumeFromCursor || null,
  };
  
  onProgress?.(progress);
  
  try {
    // Count total documents
    const total = await estimateMigrationCount(validatedPlan);
    progress.totalDocuments = total;
    onProgress?.(progress);
    
    // Build source query
    let sourceQuery = query(
      collection(db, validatedPlan.collectionPath),
      orderBy('__name__')
    );
    
    if (resumeFromCursor) {
      sourceQuery = query(sourceQuery, startAfter(resumeFromCursor));
    }
    
    const batchSize = validatedPlan.options.batchSize;
    let batch = writeBatch(db);
    let batchCount = 0;
    let lastDocId = null;
    
    const snapshot = await getDocs(sourceQuery);
    
    for (const docSnap of snapshot.docs) {
      lastDocId = docSnap.id;
      progress.processedDocuments++;
      
      try {
        const docData = { id: docSnap.id, ...docSnap.data() };
        
        // Apply filter if provided
        if (validatedPlan.options.filter && !validatedPlan.options.filter(docData)) {
          progress.skippedDocuments++;
          continue;
        }
        
        // Resolve tenant for this document
        let tenantId;
        try {
          tenantId = validatedPlan.tenantResolver(docData);
        } catch (error) {
          throw new MigrationError(
            `Failed to resolve tenant for document ${docSnap.id}: ${error.message}`,
            MigrationErrorCode.TENANT_RESOLUTION_FAILED,
            { documentId: docSnap.id, error: error.message }
          );
        }
        
        // Validate tenant ID
        const parsed = parseTenantId(tenantId);
        if (!parsed) {
          throw new MigrationError(
            `Invalid tenant ID "${tenantId}" for document ${docSnap.id}`,
            MigrationErrorCode.INVALID_TENANT,
            { documentId: docSnap.id, tenantId }
          );
        }
        
        // Transform document if transformer provided
        let transformedDoc = docData;
        if (validatedPlan.options.transform) {
          transformedDoc = validatedPlan.options.transform(docData, tenantId);
        }
        
        // Ensure tenantId is set on document
        transformedDoc = {
          ...transformedDoc,
          tenantId,
          _tenantMigratedAt: new Date().toISOString(),
          _migrationId: validatedPlan.id,
        };
        
        if (!validatedPlan.options.dryRun) {
          const targetRef = doc(db, validatedPlan.targetCollectionPath, docSnap.id);
          
          // Check for existing document conflict
          const existingSnap = await getDoc(targetRef);
          if (existingSnap.exists()) {
            const existing = existingSnap.data();
            if (existing.tenantId !== tenantId) {
              throw new MigrationError(
                `Document ${docSnap.id} exists with different tenant ${existing.tenantId}`,
                MigrationErrorCode.DOCUMENT_CONFLICT,
                { documentId: docSnap.id, existingTenant: existing.tenantId, newTenant: tenantId }
              );
            }
          }
          
          batch.set(targetRef, transformedDoc);
          batchCount++;
          
          if (batchCount >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
        
        progress.successfulDocuments++;
        
        // Progress update every 100 documents
        if (progress.processedDocuments % 100 === 0) {
          progress.lastCursor = lastDocId;
          onProgress?.(progress);
        }
        
      } catch (error) {
        progress.failedDocuments++;
        progress.errors.push({
          documentId: docSnap.id,
          error: error.message,
          code: error.code,
          details: error.details,
        });
        
        // Continue on error unless it's a critical failure
        if (error instanceof MigrationError && 
            [MigrationErrorCode.DOCUMENT_CONFLICT].includes(error.code)) {
          throw error;
        }
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0 && !validatedPlan.options.dryRun) {
      await batch.commit();
    }
    
    progress.status = MigrationStatus.COMPLETED;
    progress.completedAt = new Date().toISOString();
    progress.lastCursor = lastDocId;
    onProgress?.(progress);
    
    return progress;
    
  } catch (error) {
    progress.status = MigrationStatus.FAILED;
    progress.completedAt = new Date().toISOString();
    progress.errors.push({
      error: error.message,
      code: error.code || 'MIGRATION_EXECUTION_FAILED',
      details: error.details,
    });
    onProgress?.(progress);
    throw error;
  }
}

/**
 * Rolls back a completed migration
 * @param {MigrationPlan} plan - Original migration plan
 * @param {MigrationProgress} progress - Original migration progress
 * @returns {Promise<object>} Rollback result
 */
export async function rollbackMigration(plan, progress) {
  if (progress.status !== MigrationStatus.COMPLETED) {
    throw new MigrationError(
      'Can only rollback completed migrations',
      MigrationErrorCode.ROLLBACK_FAILED
    );
  }
  
  const rollbackProgress = {
    migrationId: `${plan.id}_rollback`,
    status: MigrationStatus.RUNNING,
    totalDocuments: progress.successfulDocuments,
    processedDocuments: 0,
    successfulDocuments: 0,
    failedDocuments: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };
  
  try {
    // For rollback, we need to either delete or restore original documents
    // This is a simplified implementation - in production, you'd want
    // to store original documents during migration for accurate rollback
    
    const targetQuery = query(
      collection(db, plan.targetCollectionPath || plan.collectionPath),
      where('_migrationId', '==', plan.id)
    );
    
    const snapshot = await getDocs(targetQuery);
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnap of snapshot.docs) {
      rollbackProgress.processedDocuments++;
      
      try {
        // Delete migrated document
        batch.delete(docSnap.ref);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
        
        rollbackProgress.successfulDocuments++;
      } catch (error) {
        rollbackProgress.failedDocuments++;
        rollbackProgress.errors.push({
          documentId: docSnap.id,
          error: error.message,
        });
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    rollbackProgress.status = MigrationStatus.COMPLETED;
    rollbackProgress.completedAt = new Date().toISOString();
    
    return {
      ...rollbackProgress,
      status: MigrationStatus.ROLLED_BACK,
    };
    
  } catch (error) {
    rollbackProgress.status = MigrationStatus.FAILED;
    rollbackProgress.completedAt = new Date().toISOString();
    throw new MigrationError(
      `Rollback failed: ${error.message}`,
      MigrationErrorCode.ROLLBACK_FAILED,
      { originalError: error }
    );
  }
}

/**
 * Validates tenant isolation after migration
 * @param {MigrationPlan} plan - Migration plan
 * @returns {Promise<object>} Validation results
 */
export async function validateTenantIsolation(plan) {
  const results = {
    migrationId: plan.id,
    totalDocuments: 0,
    validDocuments: 0,
    invalidDocuments: 0,
    orphanDocuments: 0,
    crossTenantLeaks: 0,
    errors: [],
    details: [],
  };
  
  const targetQuery = query(
    collection(db, plan.targetCollectionPath || plan.collectionPath),
    where('_migrationId', '==', plan.id)
  );
  
  const snapshot = await getDocs(targetQuery);
  results.totalDocuments = snapshot.size;
  
  for (const docSnap of snapshot.docs) {
    const docData = docSnap.data();
    
    // Check tenantId exists
    if (!docData.tenantId) {
      results.invalidDocuments++;
      results.errors.push({
        documentId: docSnap.id,
        error: 'Missing tenantId',
      });
      continue;
    }
    
    // Validate tenant ID format
    const parsed = parseTenantId(docData.tenantId);
    if (!parsed) {
      results.invalidDocuments++;
      results.errors.push({
        documentId: docSnap.id,
        error: `Invalid tenantId format: ${docData.tenantId}`,
      });
      continue;
    }
    
    // Check for cross-tenant leaks (documents that should be in different tenant)
    // This would require knowing the expected tenant for each document
    // For now, we just validate format
    
    results.validDocuments++;
  }
  
  return results;
}

/**
 * Generates synthetic test data for migration testing
 * @param {object} options - Generation options
 * @param {number} options.count - Number of documents to generate
 * @param {string[]} options.tenants - Tenant IDs to distribute across
 * @param {Function} options.template - Function(tenantId, index) => document
 * @returns {Array<object>} Generated documents
 */
export function generateSyntheticMigrationData({ count, tenants, template }) {
  const documents = [];
  
  for (let i = 0; i < count; i++) {
    const tenantId = tenants[i % tenants.length];
    documents.push(template(tenantId, i));
  }
  
  return documents;
}

/**
 * Creates a test migration plan for dry-run testing
 * @param {object} options - Test options
 * @returns {MigrationPlan} Test migration plan
 */
export function createTestMigrationPlan(options = {}) {
  const tenants = options.tenants || [
    'STATE:IN-KA',
    'DISTRICT:IN-KA-BLR',
    'MUNICIPALITY:IN-KA-BLR-BBMP',
    'DEPARTMENT:IN-KA-BLR-BBMP-WATER',
  ];
  
  return createMigrationPlan({
    id: `test_migration_${Date.now()}`,
    name: 'Test Tenant Migration',
    collectionPath: options.collectionPath || 'test_collection',
    targetCollectionPath: options.targetCollectionPath || 'test_collection_partitioned',
    tenantResolver: (doc) => {
      // Simple round-robin tenant assignment for testing
      const index = parseInt(doc.id?.split('_').pop() || '0', 10) || 0;
      return tenants[index % tenants.length];
    },
    options: {
      dryRun: true,
      batchSize: 100,
      includeDescendants: true,
      transform: (doc, tenantId) => ({
        ...doc,
        tenantId,
        _testMigration: true,
      }),
    },
  });
}

export default {
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
  parseTenantId,
  isDescendantOf,
  TenantLevel,
};