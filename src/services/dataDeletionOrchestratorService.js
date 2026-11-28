import crypto from 'node:crypto';

export const STORE_DEPENDENCY = Object.freeze({
  PRIMARY_POSTGRES: 'PRIMARY_POSTGRES',
  SEARCH_INDEX_MEILISEARCH: 'SEARCH_INDEX_MEILISEARCH',
  REDIS_CACHE: 'REDIS_CACHE',
  OBJECT_STORAGE_S3: 'OBJECT_STORAGE_S3',
  ANALYTICS_WAREHOUSE: 'ANALYTICS_WAREHOUSE'
});

export const DELETION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PARTIAL_FAILURE: 'PARTIAL_FAILURE'
});

export class DataDeletionOrchestratorService {
  constructor() {
    this.deletionJobs = new Map();
  }

  createDeletionJob(citizenId, retentionPolicy = 'RTBF_CITIZEN_REQUEST') {
    const jobId = `DEL-JOB-${crypto.randomBytes(8).toString('hex')}`;
    const dependencies = Object.values(STORE_DEPENDENCY);

    const job = {
      jobId,
      citizenId,
      retentionPolicy,
      status: DELETION_STATUS.PENDING,
      steps: dependencies.map((dep) => ({
        targetStore: dep,
        status: 'PENDING',
        erasureReceipt: null,
        purgedRecordsCount: 0
      })),
      erasureProof: null,
      createdAt: new Date().toISOString()
    };

    this.deletionJobs.set(jobId, job);
    return job;
  }

  executeStoreDeletion(jobId, targetStore, mockPurgedCount = 1) {
    const job = this.deletionJobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);

    job.status = DELETION_STATUS.IN_PROGRESS;
    const step = job.steps.find((s) => s.targetStore === targetStore);
    if (!step) throw new Error(`Target store ${targetStore} not part of deletion plan.`);

    // Generate cryptographic erasure receipt without storing citizen PII
    const receiptSeed = `${job.jobId}:${targetStore}:${mockPurgedCount}:${Date.now()}`;
    const receiptHash = crypto.createHash('sha256').update(receiptSeed).digest('hex');

    step.status = 'COMPLETED';
    step.purgedRecordsCount = mockPurgedCount;
    step.erasureReceipt = receiptHash;

    // Check if all steps complete
    const allDone = job.steps.every((s) => s.status === 'COMPLETED');
    if (allDone) {
      job.status = DELETION_STATUS.COMPLETED;
      job.erasureProof = this._generateConsolidatedProof(job);
    }

    return step;
  }

  _generateConsolidatedProof(job) {
    const receipts = job.steps.map((s) => `${s.targetStore}:${s.erasureReceipt}`).join('|');
    const proofSignature = crypto.createHash('sha256').update(receipts).digest('hex');

    return {
      proofId: `PROOF-${crypto.randomBytes(6).toString('hex')}`,
      jobId: job.jobId,
      citizenPseudonym: `CIT-${crypto.createHash('sha256').update(job.citizenId).digest('hex').substring(0, 10)}`,
      completedAt: new Date().toISOString(),
      storesPurgedCount: job.steps.length,
      proofSignature
    };
  }

  getJob(jobId) {
    return this.deletionJobs.get(jobId);
  }
}
