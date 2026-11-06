/**
 * Document Pre-flight Validator Service
 * Validates civic documents (Aadhaar, PAN, Passport, Voter ID, Driving License)
 * using checksums (Verhoeff), regex, size/format constraints, and masking advisors.
 */

// Verhoeff algorithm tables for Aadhaar checksum calculation
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

export const DOCUMENT_TYPES = {
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  PASSPORT: 'PASSPORT',
  VOTER_ID: 'VOTER_ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  RATION_CARD: 'RATION_CARD'
};

export const STANDARD_PORTAL_LIMITS = {
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  RECOMMENDED_MIN_BYTES: 50 * 1024,     // 50KB
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png'],
  ALLOWED_MIME_TYPES: {
    'application/pdf': ['pdf'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png']
  },
  ALLOWED_TYPES_HINT: 'PDF, JPG, or PNG, up to 2 MB'
};

/**
 * Pre-validation for document files before pre-flight audit or upload.
 * Returns { valid: boolean, error: string }
 */
export function validatePreflightFile(file) {
  if (!file) return { valid: false, error: 'Please choose a file.' };
  if (!file.size) return { valid: false, error: 'This file is empty. Choose a file with content.' };
  if (file.size > STANDARD_PORTAL_LIMITS.MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File is too large. Maximum limit is 2 MB.' };
  }
  const fileName = file.name || '';
  const idx = fileName.lastIndexOf('.');
  const ext = idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
  if (!ext || !STANDARD_PORTAL_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Unsupported file format. Only PDF, JPG, and PNG files are allowed.' };
  }
  const mime = (file.type || '').split(';')[0].trim().toLowerCase();
  if (mime) {
    const allowedExts = STANDARD_PORTAL_LIMITS.ALLOWED_MIME_TYPES[mime];
    if (!allowedExts) {
      return { valid: false, error: 'Unsupported file type. Only PDF, JPG, and PNG files are allowed.' };
    }
    if (!allowedExts.includes(ext)) {
      return { valid: false, error: 'The file extension does not match its content type.' };
    }
  }
  return { valid: true, error: '' };
}

/**
 * Validate number using Verhoeff algorithm
 */
export function validateVerhoeff(str) {
  if (!str || typeof str !== 'string') return false;
  const digits = str.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return false;

  let c = 0;
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(digits.charAt(len - 1 - i), 10);
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digit]];
  }
  return c === 0;
}

/**
 * Validates Aadhaar format, length, masking, and Verhoeff checksum
 */
export function validateAadhaar(number) {
  if (!number) return { valid: false, message: 'Aadhaar number is required.' };
  const clean = number.toString().replace(/[\s-]/g, '');

  if (clean.length !== 12) {
    return {
      valid: false,
      code: 'INVALID_LENGTH',
      message: 'Aadhaar must be exactly 12 numeric digits.'
    };
  }

  if (/^[01]/.test(clean)) {
    return {
      valid: false,
      code: 'INVALID_START_DIGIT',
      message: 'Aadhaar number cannot start with 0 or 1.'
    };
  }

  if (!validateVerhoeff(clean)) {
    return {
      valid: false,
      code: 'CHECKSUM_FAILED',
      message: 'Aadhaar failed Verhoeff checksum validation. Please verify numbers.'
    };
  }

  return {
    valid: true,
    maskedPreview: `XXXX-XXXX-${clean.slice(8)}`,
    isMasked: false,
    message: 'Valid 12-digit Aadhaar number.'
  };
}

/**
 * Validates Indian Income Tax Permanent Account Number (PAN)
 * Format: 5 uppercase letters, 4 numbers, 1 letter (e.g. ABCDE1234F)
 * 4th character denotes entity type (P for Individual, C for Company, etc.)
 */
export function validatePan(pan) {
  if (!pan) return { valid: false, message: 'PAN number is required.' };
  const clean = pan.toString().trim().toUpperCase();

  const regex = /^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      code: 'INVALID_PAN_FORMAT',
      message: 'Invalid PAN structure. Must match standard 10-char format (e.g. ABCDE1234F) with valid 4th entity code.'
    };
  }

  const entityTypeMap = {
    P: 'Individual / Citizen',
    C: 'Company',
    H: 'Hindu Undivided Family (HUF)',
    A: 'Association of Persons (AOP)',
    B: 'Body of Individuals (BOI)',
    G: 'Government Agency',
    J: 'Artificial Juridical Person',
    L: 'Local Authority',
    F: 'Firm / LLP',
    T: 'Trust'
  };

  const entityCode = clean.charAt(3);
  return {
    valid: true,
    entityType: entityTypeMap[entityCode] || 'Individual',
    formatted: clean,
    message: `Valid PAN registered for ${entityTypeMap[entityCode] || 'Citizen'}.`
  };
}

/**
 * Validates Indian Passport Number
 * Format: 1 letter (excluding Q, X, Z) followed by 7 digits
 */
export function validatePassport(passport) {
  if (!passport) return { valid: false, message: 'Passport number is required.' };
  const clean = passport.toString().trim().toUpperCase();

  const regex = /^[A-PR-WYa-pr-wy][1-9]\d{6}$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      code: 'INVALID_PASSPORT_FORMAT',
      message: 'Invalid Passport format. Must start with a valid letter followed by 7 digits (first digit 1-9).'
    };
  }

  return {
    valid: true,
    formatted: clean,
    message: 'Valid Indian Passport number.'
  };
}

/**
 * Validates Indian Voter ID (EPIC)
 * Standard format: 3 letters + 7 numbers (e.g. ABC1234567) or regional formats
 */
export function validateVoterId(voterId) {
  if (!voterId) return { valid: false, message: 'Voter ID is required.' };
  const clean = voterId.toString().trim().toUpperCase().replace(/[\s/]/g, '');

  const regex = /^[A-Z]{3}\d{7}$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      code: 'INVALID_EPIC_FORMAT',
      message: 'Invalid Voter ID (EPIC) format. Standard format requires 3 alphabets followed by 7 digits.'
    };
  }

  return {
    valid: true,
    formatted: clean,
    message: 'Valid Electoral Photo Identity Card (EPIC) format.'
  };
}

/**
 * Validates Indian Driving License format
 * Format: 2-char State Code + 2-digit RTO Code + Year (4 digits) + 7 digits (Total ~15-16 chars)
 */
export function validateDrivingLicense(dl) {
  if (!dl) return { valid: false, message: 'Driving License number is required.' };
  const clean = dl.toString().trim().toUpperCase().replace(/[\s-]/g, '');

  const regex = /^[A-Z]{2}\d{2}\d{4}\d{7}$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      code: 'INVALID_DL_FORMAT',
      message: 'Invalid Driving License format. Standard Sarathi format is SS-RR-YYYY-NNNNNNN (e.g. DL0120150012345).'
    };
  }

  return {
    valid: true,
    stateCode: clean.slice(0, 2),
    issueYear: clean.slice(4, 8),
    formatted: clean,
    message: 'Valid Driving License (Sarathi standard format).'
  };
}

/**
 * Performs a comprehensive pre-flight check on an uploaded document file
 */
export function inspectDocumentFile(file) {
  if (!file) {
    return { passed: false, score: 0, issues: ['No file provided for inspection.'] };
  }

  const issues = [];
  const warnings = [];
  const fileName = file.name || 'document';
  const fileSize = file.size || 0;
  const idx = fileName.lastIndexOf('.');
  const ext = idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();

  // Size & empty file Checks
  if (!fileSize) {
    issues.push('This file is empty. Choose a file with content.');
  } else if (fileSize > STANDARD_PORTAL_LIMITS.MAX_FILE_SIZE_BYTES) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(2);
    issues.push(`File size (${sizeMb} MB) exceeds government portal maximum limit of 2 MB.`);
  } else if (fileSize < STANDARD_PORTAL_LIMITS.RECOMMENDED_MIN_BYTES) {
    warnings.push('File is smaller than 50 KB. Verify text is sharp and legible to prevent rejection for blurriness.');
  }

  // Extension Check
  if (!ext || !STANDARD_PORTAL_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    issues.push(`Format .${ext || 'unknown'} is not supported by civic portals. Use PDF, JPG, or PNG.`);
  }

  // MIME type and mismatch check
  if (file.type) {
    const mime = file.type.split(';')[0].trim().toLowerCase();
    const allowedExts = STANDARD_PORTAL_LIMITS.ALLOWED_MIME_TYPES?.[mime];
    if (!allowedExts) {
      issues.push(`Unsupported file type (${file.type}). Only PDF, JPG, and PNG files are allowed.`);
    } else if (!allowedExts.includes(ext)) {
      issues.push(`The file extension (.${ext}) does not match its content type (${file.type}).`);
    }
  }

  // File naming security check
  if (/[#%&{}\\<>*?/$!'":@+`|=]/.test(fileName)) {
    warnings.push('File name contains special characters. Rename using only alphanumeric characters and hyphens.');
  }

  let readinessScore = 100;
  readinessScore -= issues.length * 35;
  readinessScore -= warnings.length * 15;
  if (readinessScore < 0) readinessScore = 0;

  return {
    passed: issues.length === 0,
    fileName,
    fileSizeKb: Math.round(fileSize / 1024),
    extension: ext,
    issues,
    warnings,
    readinessScore,
    status: issues.length === 0 ? (warnings.length === 0 ? 'READY' : 'REVIEW_WARNINGS') : 'NOT_READY'
  };
}

/**
 * Evaluates full readiness audit for a document record (metadata + file inspection)
 */
export function generatePreflightAudit(docData) {
  const auditReport = {
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    documentName: docData.title || docData.name || 'Civic Document',
    documentType: docData.type || 'GENERAL',
    checks: [],
    overallScore: 100,
    status: 'READY',
    recommendations: []
  };

  // 1. Identification Check
  if (docData.type === DOCUMENT_TYPES.AADHAAR && docData.identifier) {
    const val = validateAadhaar(docData.identifier);
    auditReport.checks.push({
      name: 'Aadhaar Checksum & Structure',
      passed: val.valid,
      message: val.message
    });
    if (!val.valid) auditReport.overallScore -= 35;
    auditReport.recommendations.push('Upload only Masked Aadhaar (e-Aadhaar) to comply with UIDAI privacy guidelines.');
  } else if (docData.type === DOCUMENT_TYPES.PAN && docData.identifier) {
    const val = validatePan(docData.identifier);
    auditReport.checks.push({
      name: 'PAN Format Verification',
      passed: val.valid,
      message: val.message
    });
    if (!val.valid) auditReport.overallScore -= 30;
  } else if (docData.type === DOCUMENT_TYPES.PASSPORT && docData.identifier) {
    const val = validatePassport(docData.identifier);
    auditReport.checks.push({
      name: 'Passport Structure Check',
      passed: val.valid,
      message: val.message
    });
    if (!val.valid) auditReport.overallScore -= 30;
  }

  // 2. Expiry Check
  if (docData.expiryDate) {
    const exp = new Date(docData.expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      auditReport.checks.push({
        name: 'Validity Status',
        passed: false,
        message: 'Document has already expired.'
      });
      auditReport.overallScore -= 60;
      auditReport.recommendations.push('Renew this document before submitting to avoid immediate application rejection.');
    } else if (diffDays < 60) {
      auditReport.checks.push({
        name: 'Validity Status',
        passed: true,
        message: `Expiring soon (in ${diffDays} days).`
      });
      auditReport.overallScore -= 10;
      auditReport.recommendations.push('Verify whether target department requires minimum 6-month remaining validity.');
    } else {
      auditReport.checks.push({
        name: 'Validity Status',
        passed: true,
        message: `Valid for next ${diffDays} days.`
      });
    }
  }

  // 3. File inspection if attached
  if (docData.file) {
    const fileAudit = inspectDocumentFile(docData.file);
    auditReport.checks.push({
      name: 'File Size & Format (Govt Portal Limit <= 2MB)',
      passed: fileAudit.passed,
      message: fileAudit.issues.length ? fileAudit.issues.join('; ') : `Size: ${fileAudit.fileSizeKb} KB, Format: .${fileAudit.extension}`
    });
    if (!fileAudit.passed) auditReport.overallScore -= 30;
    auditReport.recommendations.push(...fileAudit.warnings);
  }

  if (auditReport.overallScore < 0) auditReport.overallScore = 0;
  auditReport.status = auditReport.overallScore >= 80 ? 'READY' : auditReport.overallScore >= 50 ? 'NEEDS_ATTENTION' : 'REJECT_RISK';

  return auditReport;
}
