/**
 * Document Upload Quarantine and File-Type Verification Service
 *
 * Implements a strict, defense-in-depth upload pipeline for civic grievance attachments:
 * - Content-based magic-number (signature) verification for PDF, JPEG, PNG, and WebP
 * - Strict prohibition of executable, script, or archive formats (.exe, .sh, .bat, .zip, .tar, .js, .html)
 * - File name sanitization against path traversal (../, ..\, hidden characters)
 * - Quarantine storage state management: untrusted files remain quarantined until signature checks pass
 * - Safe rendering policy: disallows direct inline browser execution; enforces download headers
 */

export const QUARANTINE_STATUS = Object.freeze({
  PENDING_SCAN: 'PENDING_SCAN',
  VERIFIED_CLEAN: 'VERIFIED_CLEAN',
  REJECTED_SIGNATURE_MISMATCH: 'REJECTED_SIGNATURE_MISMATCH',
  REJECTED_DISALLOWED_TYPE: 'REJECTED_DISALLOWED_TYPE',
  REJECTED_OVERSIZED: 'REJECTED_OVERSIZED',
  REJECTED_TRAVERSAL_PATH: 'REJECTED_TRAVERSAL_PATH'
});

export const ALLOWED_MIME_TYPES = Object.freeze({
  'application/pdf': {
    ext: '.pdf',
    signatures: [[0x25, 0x50, 0x44, 0x46]] // %PDF
  },
  'image/jpeg': {
    ext: '.jpg',
    signatures: [[0xFF, 0xD8, 0xFF]]
  },
  'image/png': {
    ext: '.png',
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]
  },
  'image/webp': {
    ext: '.webp',
    signatures: [[0x52, 0x49, 0x46, 0x46]] // RIFF
  }
});

export const DANGEROUS_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.ps1',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.js', '.mjs', '.html', '.htm', '.php', '.py', '.svg'
];

export const MAX_ALLOWED_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Sanitizes a client-provided file name to prevent directory traversal
 * @param {string} rawFileName
 * @returns {string} Sanitized base file name
 */
export function sanitizeFileName(rawFileName = '') {
  if (typeof rawFileName !== 'string' || !rawFileName.trim()) {
    return 'unnamed_attachment';
  }
  // Strip paths, directory components, and traversal markers
  const baseName = rawFileName.split(/[/\\]/).filter(Boolean).pop() || 'unnamed_attachment';
  let clean = baseName.replace(/\.\.+/g, '.');
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Strip leading dots or underscores
  clean = clean.replace(/^[._]+/, '');
  return clean.substring(0, 100) || 'unnamed_attachment';
}


/**
 * Verifies magic bytes signature against claimed MIME type
 * @param {Uint8Array} buffer First N bytes of the file
 * @param {string} claimedMimeType Claimed MIME type
 * @returns {boolean} True if magic bytes match expected signature
 */
export function verifyMagicBytes(buffer, claimedMimeType) {
  if (!buffer || !(buffer instanceof Uint8Array) || buffer.length < 4) {
    return false;
  }

  const spec = ALLOWED_MIME_TYPES[claimedMimeType];
  if (!spec) return false;

  return spec.signatures.some(sig => {
    if (buffer.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) return false;
    }
    return true;
  });
}

export class UploadQuarantinePipeline {
  constructor(options = {}) {
    this.maxSize = options.maxSize || MAX_ALLOWED_FILE_SIZE;
    this.quarantineStore = new Map();
  }

  /**
   * Submits an attachment into initial quarantine
   * @param {Object} uploadPayload
   * @returns {Object} Quarantined metadata record
   */
  stageInQuarantine({ fileId, fileName, claimedMimeType, buffer, sizeBytes }) {
    const sanitizedName = sanitizeFileName(fileName);
    const lowerName = sanitizedName.toLowerCase();

    // Check dangerous extension blacklist
    const isDangerous = DANGEROUS_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    if (isDangerous) {
      const record = {
        fileId,
        fileName: sanitizedName,
        status: QUARANTINE_STATUS.REJECTED_DISALLOWED_TYPE,
        reason: 'File extension violates executable/archive restriction policy',
        verified: false,
        stagedAt: Date.now()
      };
      this.quarantineStore.set(fileId, record);
      return record;
    }

    // Check size limit
    if (sizeBytes > this.maxSize) {
      const record = {
        fileId,
        fileName: sanitizedName,
        status: QUARANTINE_STATUS.REJECTED_OVERSIZED,
        reason: `File size ${sizeBytes} exceeds maximum permitted ${this.maxSize} bytes`,
        verified: false,
        stagedAt: Date.now()
      };
      this.quarantineStore.set(fileId, record);
      return record;
    }

    // Verify claimed MIME type is in supported set
    if (!ALLOWED_MIME_TYPES[claimedMimeType]) {
      const record = {
        fileId,
        fileName: sanitizedName,
        status: QUARANTINE_STATUS.REJECTED_DISALLOWED_TYPE,
        reason: `Unsupported or disallowed MIME type: ${claimedMimeType}`,
        verified: false,
        stagedAt: Date.now()
      };
      this.quarantineStore.set(fileId, record);
      return record;
    }

    // Verify magic bytes signature
    const headerBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
    const isValidSignature = verifyMagicBytes(headerBytes, claimedMimeType);

    if (!isValidSignature) {
      const record = {
        fileId,
        fileName: sanitizedName,
        status: QUARANTINE_STATUS.REJECTED_SIGNATURE_MISMATCH,
        reason: 'File header magic bytes do not match declared MIME type format',
        verified: false,
        stagedAt: Date.now()
      };
      this.quarantineStore.set(fileId, record);
      return record;
    }

    // Verified clean file
    const record = {
      fileId,
      fileName: sanitizedName,
      status: QUARANTINE_STATUS.VERIFIED_CLEAN,
      mimeType: claimedMimeType,
      sizeBytes,
      verified: true,
      safeContentDisposition: `attachment; filename="${sanitizedName}"`,
      stagedAt: Date.now()
    };
    this.quarantineStore.set(fileId, record);
    return record;
  }

  getRecord(fileId) {
    return this.quarantineStore.get(fileId) || null;
  }

  isDownloadable(fileId) {
    const record = this.getRecord(fileId);
    return Boolean(record && record.verified && record.status === QUARANTINE_STATUS.VERIFIED_CLEAN);
  }
}
