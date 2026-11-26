import { describe, it, expect } from 'vitest';
import {
  hashGhgSubmissionPayload,
  buildIdempotencyDocId,
  createGhgMemoryRepository,
  createGhgFirestoreRepository,
} from './ghgInventoryRepository.js';

const samplePayload = (overrides = {}) => ({
  periodId: 'PER-2026-27',
  jurisdictionId: 'WARD-042',
  department: 'Solid Waste Management',
  title: 'FY 2026-27 landfill gate correction',
  correctionNotes: 'Gate total reconciled with weighbridge log.',
  records: [
    {
      sourceId: 'SRC-WST-01',
      quantity: 7900,
      unit: 't',
      dataQuality: 'measured',
      sourceDocument: {
        name: 'gate.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'a'.repeat(64),
      },
    },
  ],
  ...overrides,
});

const sampleReceipt = (overrides = {}) => ({
  submissionId: 'ghg_sub_123',
  idempotencyKey: 'idemp-key-001',
  jurisdictionId: 'WARD-042',
  periodId: 'PER-2026-27',
  status: 'queued_for_review',
  recordCount: 1,
  receivedAt: '2026-11-17T10:00:00.000Z',
  receiptCode: 'GHG-A1B2-C3D4',
  ...overrides,
});

describe('ghgInventoryRepository', () => {
  describe('hashGhgSubmissionPayload', () => {
    it('produces identical hashes for identical payloads', () => {
      const hash1 = hashGhgSubmissionPayload(samplePayload());
      const hash2 = hashGhgSubmissionPayload(samplePayload());
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes when activity records differ', () => {
      const baseHash = hashGhgSubmissionPayload(samplePayload());
      const changedQuantity = hashGhgSubmissionPayload(
        samplePayload({ records: [{ ...samplePayload().records[0], quantity: 8000 }] })
      );
      expect(changedQuantity).not.toBe(baseHash);

      const changedUnit = hashGhgSubmissionPayload(
        samplePayload({ records: [{ ...samplePayload().records[0], unit: 'kg' }] })
      );
      expect(changedUnit).not.toBe(baseHash);
    });

    it('produces different hashes when department or notes differ', () => {
      const baseHash = hashGhgSubmissionPayload(samplePayload());
      const changedDept = hashGhgSubmissionPayload(
        samplePayload({ department: 'Transport Department' })
      );
      expect(changedDept).not.toBe(baseHash);

      const changedNotes = hashGhgSubmissionPayload(
        samplePayload({ correctionNotes: 'Different notes.' })
      );
      expect(changedNotes).not.toBe(baseHash);
    });
  });

  describe('buildIdempotencyDocId', () => {
    it('scopes by jurisdiction and hashes the idempotency key', () => {
      const id1 = buildIdempotencyDocId('WARD-042', 'key-abc');
      const id2 = buildIdempotencyDocId('WARD-042', 'key-abc');
      const idOtherWard = buildIdempotencyDocId('WARD-084', 'key-abc');

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^WARD-042__[0-9a-f]{32}$/);
      expect(id1).not.toBe(idOtherWard);
    });
  });

  describe('createGhgMemoryRepository', () => {
    it('persists a submission and detects idempotent replays and conflicts', async () => {
      const repo = createGhgMemoryRepository();
      const payload = samplePayload();
      const receipt = sampleReceipt();
      const hash = hashGhgSubmissionPayload(payload);

      // First submission
      const first = await repo.recordSubmission({
        submission: { ...payload, ...receipt },
        receipt,
        idempotencyKey: 'idemp-key-001',
        jurisdictionId: 'WARD-042',
        payloadHash: hash,
        actorId: 'user_operator',
      });
      expect(first.status).toBe('created');
      expect(first.receipt).toEqual(receipt);

      // Replay with exact same payload
      const replay = await repo.recordSubmission({
        submission: { ...payload, ...receipt },
        receipt,
        idempotencyKey: 'idemp-key-001',
        jurisdictionId: 'WARD-042',
        payloadHash: hash,
        actorId: 'user_operator',
      });
      expect(replay.status).toBe('replayed');
      expect(replay.receipt.submissionId).toBe(receipt.submissionId);

      // Conflicting payload with same idempotency key
      const conflictingHash = hashGhgSubmissionPayload(samplePayload({ department: 'Other Dept' }));
      const conflict = await repo.recordSubmission({
        submission: { ...payload, department: 'Other Dept' },
        receipt: sampleReceipt({ submissionId: 'ghg_sub_456' }),
        idempotencyKey: 'idemp-key-001',
        jurisdictionId: 'WARD-042',
        payloadHash: conflictingHash,
        actorId: 'user_operator',
      });
      expect(conflict.status).toBe('conflict');
      expect(conflict.error).toBe('idempotency_conflict');

      // Verify list and get
      const retrieved = await repo.getSubmission('ghg_sub_123');
      expect(retrieved.department).toBe('Solid Waste Management');

      const list = await repo.listSubmissions({ jurisdictionId: 'WARD-042' });
      expect(list).toHaveLength(1);
    });
  });

  describe('createGhgFirestoreRepository', () => {
    it('executes atomic transactions for persistence, replay and conflict detection', async () => {
      const docs = new Map();
      const mockFirestore = {
        collection: (colName) => ({
          doc: (docId) => {
            const key = `${colName}/${docId}`;
            return {
              key,
              get: async () => ({
                exists: docs.has(key),
                data: () => docs.get(key),
              }),
            };
          },
        }),
        runTransaction: async (updateFunction) => {
          const transaction = {
            get: async (docRef) => {
              const data = docs.get(docRef.key);
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
            set: (docRef, data) => {
              docs.set(docRef.key, data);
            },
          };
          return updateFunction(transaction);
        },
      };

      const repo = createGhgFirestoreRepository({ firestore: mockFirestore });
      const payload = samplePayload();
      const receipt = sampleReceipt();
      const hash = hashGhgSubmissionPayload(payload);

      // First write
      const created = await repo.recordSubmission({
        submission: { ...payload, ...receipt },
        receipt,
        idempotencyKey: 'idemp-key-001',
        jurisdictionId: 'WARD-042',
        payloadHash: hash,
        actorId: 'user_operator',
      });
      expect(created.status).toBe('created');
      expect(created.receipt.receiptCode).toBe(receipt.receiptCode);

      // Replay
      const replayed = await repo.recordSubmission({
        submission: { ...payload, ...receipt },
        receipt,
        idempotencyKey: 'idemp-key-001',
        jurisdictionId: 'WARD-042',
        payloadHash: hash,
        actorId: 'user_operator',
      });
      expect(replayed.status).toBe('replayed');
      expect(replayed.receipt.submissionId).toBe(receipt.submissionId);

      // Conflict
      const changedHash = hashGhgSubmissionPayload(samplePayload({ title: 'Modified' }));
      const conflict = await repo.recordSubmission({
        submission: { ...payload, title: 'Modified' },
        receipt: sampleReceipt({ submissionId: 'ghg_sub_999' }),
        idempotencyKey: 'idemp-key-001',
        jurisdictionId: 'WARD-042',
        payloadHash: changedHash,
        actorId: 'user_operator',
      });
      expect(conflict.status).toBe('conflict');
      expect(conflict.error).toBe('idempotency_conflict');
    });

    it('rejects initialization without a firestore instance', () => {
      expect(() => createGhgFirestoreRepository({})).toThrow(TypeError);
    });
  });
});
