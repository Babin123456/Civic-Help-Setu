import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataDeletionOrchestratorService,
  STORE_DEPENDENCY,
  DELETION_STATUS
} from './dataDeletionOrchestratorService.js';

describe('DataDeletionOrchestratorService (#1256)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new DataDeletionOrchestratorService();
  });

  it('coordinates multi-store deletion and generates zero-knowledge erasure proof', () => {
    const job = orchestrator.createDeletionJob('citizen_987654');
    expect(job.status).toBe(DELETION_STATUS.PENDING);
    expect(job.steps.length).toBe(5);

    // Execute deletion across all dependencies
    orchestrator.executeStoreDeletion(job.jobId, STORE_DEPENDENCY.PRIMARY_POSTGRES, 3);
    orchestrator.executeStoreDeletion(job.jobId, STORE_DEPENDENCY.SEARCH_INDEX_MEILISEARCH, 1);
    orchestrator.executeStoreDeletion(job.jobId, STORE_DEPENDENCY.REDIS_CACHE, 2);
    orchestrator.executeStoreDeletion(job.jobId, STORE_DEPENDENCY.OBJECT_STORAGE_S3, 5);
    orchestrator.executeStoreDeletion(job.jobId, STORE_DEPENDENCY.ANALYTICS_WAREHOUSE, 1);

    const updatedJob = orchestrator.getJob(job.jobId);
    expect(updatedJob.status).toBe(DELETION_STATUS.COMPLETED);
    expect(updatedJob.erasureProof).toBeDefined();
    expect(updatedJob.erasureProof.storesPurgedCount).toBe(5);
    expect(updatedJob.erasureProof.citizenPseudonym).toMatch(/^CIT-[a-f0-9]{10}$/);
    expect(updatedJob.erasureProof.proofSignature).toBeDefined();
  });
});
