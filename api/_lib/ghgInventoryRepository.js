import { createHash } from 'node:crypto';

/**
 * Deterministically hashes the validated submission payload to detect conflicting
 * reuse of the same idempotency key with different activity data.
 */
export function hashGhgSubmissionPayload(payload = {}) {
  const normalized = {
    periodId: payload?.periodId ? String(payload.periodId).trim() : '',
    jurisdictionId: payload?.jurisdictionId ? String(payload.jurisdictionId).trim().toUpperCase() : '',
    department: payload?.department ? String(payload.department).trim() : '',
    title: payload?.title ? String(payload.title).trim() : '',
    correctionNotes: payload?.correctionNotes ? String(payload.correctionNotes).trim() : '',
    records: Array.isArray(payload?.records)
      ? payload.records.map((record) => ({
          sourceId: record?.sourceId ? String(record.sourceId).trim() : '',
          quantity: Number(record?.quantity),
          unit: record?.unit || '',
          dataQuality: record?.dataQuality || '',
          correctionNotes: record?.correctionNotes ? String(record.correctionNotes).trim() : '',
          sourceDocument: record?.sourceDocument
            ? {
                name: record.sourceDocument.name ? String(record.sourceDocument.name).trim() : '',
                mimeType: record.sourceDocument.mimeType || '',
                sizeBytes:
                  record.sourceDocument.sizeBytes != null
                    ? Number(record.sourceDocument.sizeBytes)
                    : null,
                sha256: record.sourceDocument.sha256
                  ? String(record.sourceDocument.sha256).toLowerCase().trim()
                  : null,
              }
            : null,
        }))
      : [],
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Scopes the idempotency key to the verified municipal jurisdiction and generates
 * a Firestore-safe document ID.
 */
export function buildIdempotencyDocId(jurisdictionId, idempotencyKey) {
  const cleanJurisdiction = String(jurisdictionId || '').toUpperCase().replace(/[^A-Z0-9-]/g, '_');
  const keyHash = createHash('sha256').update(String(idempotencyKey || '')).digest('hex').slice(0, 32);
  return `${cleanJurisdiction}__${keyHash}`;
}

/**
 * Durable Firestore-backed GHG repository with atomic transaction-based idempotency.
 */
export function createGhgFirestoreRepository({ firestore }) {
  if (!firestore || typeof firestore.runTransaction !== 'function') {
    throw new TypeError('createGhgFirestoreRepository requires a Firestore instance.');
  }

  return {
    async recordSubmission({
      submission,
      receipt,
      idempotencyKey,
      jurisdictionId,
      payloadHash,
      actorId,
    }) {
      const docId = buildIdempotencyDocId(jurisdictionId, idempotencyKey);
      const idempotencyRef = firestore.collection('ghgIdempotency').doc(docId);
      const submissionRef = firestore.collection('ghgSubmissions').doc(receipt.submissionId);

      return firestore.runTransaction(async (transaction) => {
        const idempotencySnapshot = await transaction.get(idempotencyRef);

        if (idempotencySnapshot.exists) {
          const existing = idempotencySnapshot.data();
          if (existing.payloadHash !== payloadHash) {
            return { status: 'conflict', error: 'idempotency_conflict' };
          }
          return { status: 'replayed', receipt: existing.receipt };
        }

        const now = new Date();
        transaction.set(idempotencyRef, {
          idempotencyKey,
          jurisdictionId: jurisdictionId.toUpperCase(),
          payloadHash,
          submissionId: receipt.submissionId,
          receipt,
          actorId: actorId || null,
          createdAt: now.toISOString(),
        });

        transaction.set(submissionRef, {
          ...submission,
          createdAt: now.toISOString(),
        });

        return { status: 'created', receipt };
      });
    },

    async getSubmission(submissionId) {
      const doc = await firestore.collection('ghgSubmissions').doc(submissionId).get();
      if (!doc.exists) return null;
      return doc.data();
    },

    async listSubmissions({ jurisdictionId = null, limit = 100 } = {}) {
      let query = firestore.collection('ghgSubmissions');
      if (jurisdictionId) {
        query = query.where('jurisdictionId', '==', jurisdictionId.toUpperCase());
      }
      const snapshot = await query.limit(limit).get();
      return snapshot.docs.map((doc) => doc.data());
    },
  };
}

/**
 * In-memory repository with atomic transaction semantics, used for testing and
 * local development when Firestore credentials are not configured.
 */
export function createGhgMemoryRepository() {
  const idempotencyStore = new Map();
  const submissionsStore = new Map();

  return {
    async recordSubmission({
      submission,
      receipt,
      idempotencyKey,
      jurisdictionId,
      payloadHash,
      actorId,
    }) {
      const scopedKey = `${String(jurisdictionId).toUpperCase()}:${String(idempotencyKey)}`;
      const existing = idempotencyStore.get(scopedKey);

      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          return { status: 'conflict', error: 'idempotency_conflict' };
        }
        return { status: 'replayed', receipt: existing.receipt };
      }

      const now = new Date().toISOString();
      idempotencyStore.set(scopedKey, {
        idempotencyKey,
        jurisdictionId: jurisdictionId.toUpperCase(),
        payloadHash,
        submissionId: receipt.submissionId,
        receipt,
        actorId: actorId || null,
        createdAt: now,
      });

      submissionsStore.set(receipt.submissionId, {
        ...submission,
        createdAt: now,
      });

      return { status: 'created', receipt };
    },

    async getSubmission(submissionId) {
      return submissionsStore.get(submissionId) || null;
    },

    async listSubmissions({ jurisdictionId = null } = {}) {
      const all = Array.from(submissionsStore.values());
      if (!jurisdictionId) return all;
      return all.filter((sub) => sub.jurisdictionId === jurisdictionId.toUpperCase());
    },

    clear() {
      idempotencyStore.clear();
      submissionsStore.clear();
    },
  };
}
