import crypto from 'node:crypto';

export const EXPORT_JOB_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  STREAMING_ENCRYPTING: 'STREAMING_ENCRYPTING',
  READY_FOR_DOWNLOAD: 'READY_FOR_DOWNLOAD',
  EXPIRED: 'EXPIRED'
});

export class CitizenDataExportPipelineService {
  constructor(config = {}) {
    this.linkTtlSeconds = config.linkTtlSeconds || 3600; // 1 hour link expiry
    this.jobs = new Map();
  }

  initiateExportJob(citizenId, requestedCategories = ['PROFILE', 'APPLICATIONS', 'CONSENTS']) {
    const jobId = `EXP-${crypto.randomBytes(8).toString('hex')}`;
    const job = {
      jobId,
      citizenId,
      requestedCategories,
      status: EXPORT_JOB_STATUS.QUEUED,
      encryptionKeyId: `KMS-${crypto.randomBytes(4).toString('hex')}`,
      chunkCount: 0,
      totalBytesExported: 0,
      downloadToken: null,
      expiresAt: null,
      createdAt: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    return job;
  }

  processStreamChunk(jobId, rawRecords = []) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Export job ${jobId} not found.`);

    job.status = EXPORT_JOB_STATUS.STREAMING_ENCRYPTING;

    // Simulate encrypted stream chunk hashing
    const chunkData = JSON.stringify(rawRecords);
    const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');

    job.chunkCount += 1;
    job.totalBytesExported += Buffer.byteLength(chunkData);

    return {
      chunkIndex: job.chunkCount,
      encryptedChecksum: chunkHash,
      bytesProcessed: Buffer.byteLength(chunkData)
    };
  }

  finalizeExport(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Export job ${jobId} not found.`);

    const downloadToken = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + (this.linkTtlSeconds * 1000);

    job.status = EXPORT_JOB_STATUS.READY_FOR_DOWNLOAD;
    job.downloadToken = downloadToken;
    job.expiresAt = expiresAt;

    return {
      jobId,
      status: job.status,
      downloadUrl: `https://civichelp.gov.in/api/v1/export/download/${jobId}?token=${downloadToken}`,
      expiresAt: new Date(expiresAt).toISOString(),
      totalChunks: job.chunkCount,
      totalBytes: job.totalBytesExported
    };
  }

  verifyDownloadAccess(jobId, token, requestCitizenId) {
    const job = this.jobs.get(jobId);
    if (!job) return { allowed: false, reason: 'Job not found.' };

    if (job.citizenId !== requestCitizenId) {
      return { allowed: false, reason: 'Unauthorized: Export belongs to another citizen.' };
    }

    if (Date.now() > job.expiresAt) {
      job.status = EXPORT_JOB_STATUS.EXPIRED;
      return { allowed: false, reason: 'Download link has expired.' };
    }

    if (job.downloadToken !== token) {
      return { allowed: false, reason: 'Invalid or forged download token.' };
    }

    return { allowed: true, reason: 'Access granted.' };
  }
}
