import { describe, it, expect, beforeEach } from 'vitest';
import {
  UploadQuarantinePipeline,
  QUARANTINE_STATUS,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  sanitizeFileName,
  verifyMagicBytes
} from './uploadQuarantineService.js';

describe('uploadQuarantineService', () => {
  describe('sanitizeFileName', () => {
    it('strips directory traversal paths and dangerous characters', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFileName('receipt #12 (final).pdf')).toBe('receipt__12__final_.pdf');
      expect(sanitizeFileName('')).toBe('unnamed_attachment');
      expect(sanitizeFileName(null)).toBe('unnamed_attachment');
    });
  });

  describe('verifyMagicBytes', () => {
    it('accurately verifies valid PDF magic bytes (%PDF)', () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      expect(verifyMagicBytes(pdfBytes, 'application/pdf')).toBe(true);
    });

    it('accurately verifies valid PNG magic bytes', () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(verifyMagicBytes(pngBytes, 'image/png')).toBe(true);
    });

    it('accurately verifies valid JPEG magic bytes', () => {
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(verifyMagicBytes(jpegBytes, 'image/jpeg')).toBe(true);
    });

    it('fails when buffer is truncated or does not match claimed type', () => {
      const spoofedPdf = new Uint8Array([0x4D, 0x5A, 0x90, 0x00]); // DOS / MZ header
      expect(verifyMagicBytes(spoofedPdf, 'application/pdf')).toBe(false);
      expect(verifyMagicBytes(new Uint8Array([0x25]), 'application/pdf')).toBe(false);
      expect(verifyMagicBytes(null, 'application/pdf')).toBe(false);
    });
  });

  describe('UploadQuarantinePipeline', () => {
    let pipeline;

    beforeEach(() => {
      pipeline = new UploadQuarantinePipeline({ maxSize: 1024 * 1024 }); // 1MB limit for tests
    });

    it('rejects files with blacklisted dangerous executable/script extensions', () => {
      const result = pipeline.stageInQuarantine({
        fileId: 'file_001',
        fileName: 'malicious_script.sh',
        claimedMimeType: 'application/pdf',
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        sizeBytes: 500
      });

      expect(result.status).toBe(QUARANTINE_STATUS.REJECTED_DISALLOWED_TYPE);
      expect(result.verified).toBe(false);
      expect(pipeline.isDownloadable('file_001')).toBe(false);
    });

    it('rejects files exceeding maximum allowed size threshold', () => {
      const result = pipeline.stageInQuarantine({
        fileId: 'file_002',
        fileName: 'large_document.pdf',
        claimedMimeType: 'application/pdf',
        buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        sizeBytes: 2 * 1024 * 1024 // 2MB > 1MB limit
      });

      expect(result.status).toBe(QUARANTINE_STATUS.REJECTED_OVERSIZED);
      expect(result.verified).toBe(false);
      expect(pipeline.isDownloadable('file_002')).toBe(false);
    });

    it('rejects files with mismatched magic byte headers (content spoofing)', () => {
      const fakePdfBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const result = pipeline.stageInQuarantine({
        fileId: 'file_003',
        fileName: 'spoofed_document.pdf',
        claimedMimeType: 'application/pdf',
        buffer: fakePdfBuffer,
        sizeBytes: 1000
      });

      expect(result.status).toBe(QUARANTINE_STATUS.REJECTED_SIGNATURE_MISMATCH);
      expect(result.verified).toBe(false);
      expect(pipeline.isDownloadable('file_003')).toBe(false);
    });

    it('verifies and marks genuine PDF uploads as verified and clean', () => {
      const realPdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37]);
      const result = pipeline.stageInQuarantine({
        fileId: 'file_004',
        fileName: 'grievance_proof.pdf',
        claimedMimeType: 'application/pdf',
        buffer: realPdfBuffer,
        sizeBytes: 5000
      });

      expect(result.status).toBe(QUARANTINE_STATUS.VERIFIED_CLEAN);
      expect(result.verified).toBe(true);
      expect(result.safeContentDisposition).toBe('attachment; filename="grievance_proof.pdf"');
      expect(pipeline.isDownloadable('file_004')).toBe(true);
    });

    it('rejects unsupported MIME types gracefully', () => {
      const result = pipeline.stageInQuarantine({
        fileId: 'file_005',
        fileName: 'data.xml',
        claimedMimeType: 'application/xml',
        buffer: new Uint8Array([0x3C, 0x3F, 0x78, 0x6D, 0x6C]),
        sizeBytes: 100
      });

      expect(result.status).toBe(QUARANTINE_STATUS.REJECTED_DISALLOWED_TYPE);
      expect(result.verified).toBe(false);
      expect(pipeline.isDownloadable('file_005')).toBe(false);
    });
  });
});
