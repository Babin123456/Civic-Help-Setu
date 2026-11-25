/**
 * @file Tenant-Scoped Query Helpers
 * 
 * Provides reusable query builders for tenant-isolated data access.
 * All queries automatically include tenant scoping and fail closed
 * if tenant context cannot be resolved.
 */
/* global Buffer */

import { db } from '../_lib/firebaseAdmin.js';
import { getFirestoreAdmin } from '../../api/_lib/firebaseAdmin.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  writeBatch,
  doc as firestoreDoc,
} from 'firebase/firestore';

import {
  resolveTenantContext,
  assertTenantAccess,
  checkTenantAccess,
  parseTenantId,
  isDescendantOf,
  buildTenantQueryConstraints,
  partitionDocument,
  TenantLevel,
} from './tenantContext.js';

/**
 * Builds a tenant-scoped Firestore query
 * @param {object} options - Query options
 * @param {string} options.collectionPath - Firestore collection path
 * @param {object} [options.actor] - Actor context for tenant resolution
 * @param {string} [options.tenantId] - Explicit tenant ID (overrides actor resolution)
 * @param {boolean} [options.includeDescendants=true] - Include descendant tenant data
 * @param {QueryConstraint[]} [options.additionalConstraints=[]] - Additional where/orderBy/limit constraints
 * @returns {Promise<QuerySnapshot>} Firestore query snapshot
 */
export async function buildTenantQuery({
  collectionPath,
  actor,
  tenantId,
  includeDescendants = true,
  additionalConstraints = [],
}) {
  // Resolve tenant context
  const context = tenantId 
    ? { tenantId, isSystem: false }
    : resolveTenantContext(actor);
  
  if (!context.tenantId && !context.isSystem) {
    throw new Error('TENANT_CONTEXT_REQUIRED: Cannot resolve tenant for query');
  }
  
  // System-level access - no tenant filtering needed
  if (context.isSystem) {
    const colRef = collection(db, collectionPath);
    return query(colRef, ...additionalConstraints);
  }
  
  // Build tenant filter constraints
  const constraints = [...additionalConstraints];
  
  if (includeDescendants) {
    // For descendant inclusion, we need to query by tenantId prefix
    // Firestore doesn't support prefix queries directly, so we use
    // the tenantId field with array-contains for indexed paths
    // or we fetch by explicit tenant IDs
    
    const parsed = parseTenantId(context.tenantId);
    if (parsed) {
      // For compound indexes with tenantId as first field, we can use
      // range queries on the tenantId field
      const prefix = `${parsed.level}:${parsed.code}`;
      constraints.unshift(
        where('tenantId', '>=', prefix),
        where('tenantId', '<=', prefix + '\uf8ff')
      );
    }
  } else {
    // Exact tenant match only
    constraints.unshift(where('tenantId', '==', context.tenantId));
  }
  
  const colRef = collection(db, collectionPath);
  return query(colRef, ...constraints);
}

/**
 * Executes a tenant-scoped query and returns documents
 * @param {object} options - Same as buildTenantQuery
 * @returns {Promise<Array<DocumentData>>} Array of documents
 */
export async function executeTenantQuery(options) {
  const q = await buildTenantQuery(options);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Counts documents in a tenant-scoped query
 * @param {object} options - Same as buildTenantQuery (without limit/orderBy)
 * @returns {Promise<number>} Document count
 */
export async function countTenantQuery(options) {
  const q = await buildTenantQuery({
    ...options,
    additionalConstraints: options.additionalConstraints?.filter(c => 
      !c._limit && !c._startAt && !c._endAt
    ) || [],
  });
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Creates a paginated tenant-scoped query
 * @param {object} options - Query options
 * @param {number} [options.pageSize=25] - Page size
 * @param {string} [options.cursor] - Pagination cursor (document ID)
 * @returns {Promise<{items: Array, nextCursor: string|null, total: number}>}
 */
export async function paginateTenantQuery({
  collectionPath,
  actor,
  tenantId,
  includeDescendants = true,
  additionalConstraints = [],
  pageSize = 25,
  cursor,
} = {}) {
  let constraints = [...additionalConstraints];
  
  if (cursor) {
    constraints.push(startAfter(cursor));
  }
  
  constraints.push(limit(pageSize + 1)); // Fetch one extra to detect next page
  
  const items = await executeTenantQuery({
    collectionPath,
    actor,
    tenantId,
    includeDescendants,
    additionalConstraints: constraints,
  });
  
  const hasNextPage = items.length > pageSize;
  const pageItems = hasNextPage ? items.slice(0, pageSize) : items;
  const nextCursor = hasNextPage ? pageItems[pageItems.length - 1].id : null;
  
  // Get total count (without pagination constraints)
  const total = await countTenantQuery({
    collectionPath,
    actor,
    tenantId,
    includeDescendants,
    additionalConstraints,
  });
  
  return {
    items: pageItems,
    nextCursor,
    total,
    hasNextPage,
  };
}

/**
 * Validates that a document belongs to the actor's tenant scope
 * @param {object} doc - Document data
 * @param {object} actor - Actor context
 * @returns {boolean}
 */
export function validateDocumentTenant(doc, actor) {
  if (!doc || !doc.tenantId) return false;
  
  const context = resolveTenantContext(actor);
  if (context.isSystem) return true;
  
  if (doc.tenantId === context.tenantId) return true;
  
  // Allow access to descendant tenant data
  if (context.tenantId && isDescendantOf(doc.tenantId, context.tenantId)) {
    return true;
  }
  
  return false;
}

/**
 * Filters an array of documents to only those within the actor's tenant scope
 * @param {Array<object>} docs - Documents to filter
 * @param {object} actor - Actor context
 * @returns {Array<object>} Filtered documents
 */
export function filterDocumentsByTenant(docs, actor) {
  return docs.filter(doc => validateDocumentTenant(doc, actor));
}

/**
 * Creates a tenant-aware document reference for writes
 * @param {string} collectionPath - Collection path
 * @param {object} data - Document data
 * @param {object} actor - Actor context
 * @returns {Promise<{id: string, data: object}>} Document with tenant fields added
 */
export async function createTenantDocument(collectionPath, data, actor) {
  const context = resolveTenantContext(actor);
  
  if (!context.tenantId && !context.isSystem) {
    throw new Error('TENANT_CONTEXT_REQUIRED: Cannot create document without tenant context');
  }
  
  const tenantId = context.tenantId || data.tenantId;
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: Document must have tenantId');
  }
  
  // Validate actor can write to this tenant
  assertTenantAccess(actor, tenantId);
  
  const tenantDoc = {
    ...data,
    tenantId,
    _tenantCreatedAt: new Date().toISOString(),
  };
  
  const docRef = await import('firebase/firestore').then(({ addDoc, collection }) => 
    addDoc(collection(db, collectionPath), tenantDoc)
  );
  
  return { id: docRef.id, data: tenantDoc };
}

/**
 * Updates a document with tenant validation.
 * Supports both:
 *   updateTenantDocument(collectionPath, docId, updates, actor)
 *   updateTenantDocument(context, collectionPath, docId, updates)
 * @returns {Promise<void>}
 */
export async function updateTenantDocument(arg1, arg2, arg3, arg4) {
  let actor;
  let collectionPath;
  let docId;
  let updates;
  let isContextCall = false;

  if (typeof arg1 === 'object' && arg1 !== null) {
    isContextCall = true;
    actor = arg1;
    collectionPath = arg2;
    docId = arg3;
    updates = arg4;
  } else {
    collectionPath = arg1;
    docId = arg2;
    updates = arg3;
    actor = arg4;
  }

  const { doc, getDoc, updateDoc } = await import('firebase/firestore');
  
  const docRef = doc(db, collectionPath, docId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    throw new Error(`Document not found: ${docId}`);
  }
  
  const existing = snapshot.data();
  
  // Validate tenant access (supports both context and actor objects)
  if (isContextCall) {
    const check = checkTenantAccess(actor, existing.tenantId);
    if (!check.allowed) {
      throw new Error(`TENANT_ACCESS_DENIED: ${check.reason}`);
    }
  } else {
    assertTenantAccess(actor, existing.tenantId);
  }
  
  // Prevent tenantId modification
  const { tenantId, ...safeUpdates } = updates;
  if (tenantId && tenantId !== existing.tenantId) {
    throw new Error('TENANT_ID_IMMUTABLE: Cannot change document tenant');
  }
  
  await updateDoc(docRef, {
    ...safeUpdates,
    _tenantUpdatedAt: new Date().toISOString(),
  });
}

/**
 * Encodes a Firestore document snapshot into a bounded base64url pagination cursor.
 * @param {object} docSnap - Document snapshot with id and data()
 * @param {string[]} [orderByFields=[]] - Ordered field names (prefixed with '-' for desc)
 * @returns {string}
 */
export function encodeCursor(docSnap, orderByFields = []) {
  const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
  const values = orderByFields.map((f) => {
    const key = f.startsWith('-') ? f.slice(1) : f;
    const val = data?.[key];
    return typeof val === 'string' && val.length > 256 ? val.slice(0, 256) : val ?? null;
  });
  const payload = JSON.stringify({ id: docSnap.id, v: values });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decodes a pagination cursor produced by encodeCursor.
 * @param {string} cursor
 * @returns {{ id: string, v: any[] } | null}
 */
export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed.id !== 'string' || !Array.isArray(parsed.v)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Fluent, bounded tenant-scoped query builder.
 */
export class TenantQueryBuilder {
  constructor(context, collectionPath) {
    if (!context || (!context.tenantId && !context.isSystem)) {
      throw new Error('TENANT_CONTEXT_REQUIRED: Tenant context is required');
    }
    this._context = context;
    this._collectionPath = collectionPath;
    this._constraints = [];
    this._orderBy = [];
    this._pageSize = 25;
    this._cursor = null;
  }

  where(field, op, value) {
    this._constraints.push(where(field, op, value));
    return this;
  }

  orderBy(fieldSpec, direction) {
    if (direction) {
      this._orderBy.push(orderBy(fieldSpec, direction));
    } else if (typeof fieldSpec === 'string' && fieldSpec.startsWith('-')) {
      this._orderBy.push(orderBy(fieldSpec.slice(1), 'desc'));
    } else {
      this._orderBy.push(orderBy(fieldSpec, 'asc'));
    }
    return this;
  }

  pageSize(size) {
    const numeric = Number(size);
    this._pageSize = Number.isFinite(numeric) ? Math.max(1, Math.min(100, Math.floor(numeric))) : 25;
    return this;
  }

  cursor(cursorToken) {
    this._cursor = cursorToken;
    return this;
  }

  async execute() {
    await getFirestoreAdmin();

    const tenantConstraints = buildTenantQueryConstraints(this._context).map((c) =>
      where(c.field, c.op, c.value)
    );
    const allConstraints = [
      ...tenantConstraints,
      ...this._constraints,
      ...this._orderBy,
      limit(this._pageSize),
    ];

    if (this._cursor) {
      const decoded = decodeCursor(this._cursor);
      if (decoded) {
        allConstraints.push(startAfter(...decoded.v, decoded.id));
      }
    }

    try {
      const colRef = collection(db, this._collectionPath);
      const q = query(colRef, ...allConstraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (err instanceof Error) throw err;
      const code = err?.code ? `${err.code}: ` : '';
      throw new Error(`${code}${err?.message || 'Firestore query failed'}`, { cause: err });
    }
  }
}

/**
 * Factory for TenantQueryBuilder.
 * @param {object} context - Tenant context
 * @param {string} collectionPath - Firestore collection path
 * @returns {TenantQueryBuilder}
 */
export function tenantQuery(context, collectionPath) {
  return new TenantQueryBuilder(context, collectionPath);
}

/**
 * Batch-creates tenant-partitioned documents (max 500 per Firestore batch).
 * @param {object} context - Tenant context
 * @param {string} collectionPath - Collection path
 * @param {Array<object>} docs - Documents to create
 * @returns {Promise<{ created: number }>}
 */
export async function batchCreateTenantDocuments(context, collectionPath, docs) {
  if (!context || (!context.tenantId && !context.isSystem)) {
    throw new Error('TENANT_CONTEXT_REQUIRED: Cannot batch create without tenant context');
  }
  const BATCH_LIMIT = 500;
  let created = 0;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const partitioned = partitionDocument(item, context);
      const ref = firestoreDoc(collection(db, collectionPath));
      batch.set(ref, { ...partitioned, _tenantCreatedAt: new Date().toISOString() });
      created += 1;
    }
    await batch.commit();
  }

  return { created };
}

/**
 * Deletes a document with tenant validation
 * @param {string} collectionPath - Collection path
 * @param {string} docId - Document ID
 * @param {object} actor - Actor context
 * @returns {Promise<void>}
 */
export async function deleteTenantDocument(collectionPath, docId, actor) {
  const { doc, getDoc, deleteDoc } = await import('firebase/firestore');
  
  const docRef = doc(db, collectionPath, docId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    throw new Error(`Document not found: ${docId}`);
  }
  
  const existing = snapshot.data();
  assertTenantAccess(actor, existing.tenantId);
  
  await deleteDoc(docRef);
}

export default {
  buildTenantQuery,
  executeTenantQuery,
  countTenantQuery,
  paginateTenantQuery,
  validateDocumentTenant,
  filterDocumentsByTenant,
  createTenantDocument,
  updateTenantDocument,
  deleteTenantDocument,
  TenantQueryBuilder,
  tenantQuery,
  encodeCursor,
  decodeCursor,
  batchCreateTenantDocuments,
  TenantLevel,
};