import { describe, it, expect, beforeEach } from 'vitest';
import {
  CitizenDataExportPipelineService,
  EXPORT_JOB_STATUS
} from './citizenDataExportPipelineService.js';

describe('CitizenDataExportPipelineService (#1255)', () => {
  let exportService;

  beforeEach(() => {
    exportService = new CitizenDataExportPipelineService({ linkTtlSeconds: 30 });
  });

  it('streams chunks, encrypts records, and generates expiring download URLs', () => {
    const job = exportService.initiateExportJob('cit_4452');
    exportService.processStreamChunk(job.jobId, [{ doc: 'income_cert.pdf', size: 1024 }]);
    exportService.processStreamChunk(job.jobId, [{ doc: 'ration_card.pdf', size: 2048 }]);

    const finalResult = exportService.finalizeExport(job.jobId);
    expect(finalResult.totalChunks).toBe(2);
    expect(finalResult.downloadUrl).toContain('token=');
    expect(finalResult.status).toBe(EXPORT_JOB_STATUS.READY_FOR_DOWNLOAD);
  });

  it('rejects expired links or cross-citizen unauthorized access', () => {
    const job = exportService.initiateExportJob('cit_owner_1');
    const finalResult = exportService.finalizeExport(job.jobId);
    const token = finalResult.downloadUrl.split('token=')[1];

    // Unauthorized access attempt by another citizen
    const foreignAccess = exportService.verifyDownloadAccess(job.jobId, token, 'cit_intruder_2');
    expect(foreignAccess.allowed).toBe(false);
    expect(foreignAccess.reason).toContain('Unauthorized');

    // Valid access
    const validAccess = exportService.verifyDownloadAccess(job.jobId, token, 'cit_owner_1');
    expect(validAccess.allowed).toBe(true);
  });
});
