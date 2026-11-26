/**
 * src/data/civicEvidenceLockerContract.js
 * Versioned Data Contract, Schemas, and Constants for
 * Civic Service Digital Evidence Locker with Client-Side Encryption (#1186).
 *
 * Enforces:
 * - Versioned envelope schemas (EVIDENCE_LOCKER_SCHEMA_VERSION = "1.0.0")
 * - Strict separation of public metadata from client-side encrypted ciphertext
 * - Zero server-side key escrow: server never sees private keys, recovery phrases, or plaintext payloads
 * - Revocable access grants with cryptographic expiry, access-count caps, and emergency revoke
 * - Synthetic test fixtures for unit and integration testing without citizen PII
 */

export const EVIDENCE_LOCKER_SCHEMA_VERSION = '1.0.0';

/**
 * Storage keys used in browser local storage
 */
export const EVIDENCE_LOCKER_STORAGE_KEY = 'civic_evidence_locker_vault_v1';
export const EVIDENCE_LOCKER_RECOVERY_STORAGE_KEY = 'civic_evidence_locker_recovery_v1';
export const EVIDENCE_LOCKER_AUDIT_STORAGE_KEY = 'civic_evidence_locker_audit_v1';

/**
 * Cryptographic algorithm configurations
 */
export const EVIDENCE_LOCKER_CRYPTO = {
  KDF: {
    ALGORITHM: 'PBKDF2',
    HASH: 'SHA-256',
    ITERATIONS: 250000,
    MIN_ITERATIONS: 100000,
    SALT_BYTE_LENGTH: 16,
  },
  CIPHER: {
    ALGORITHM: 'AES-GCM',
    KEY_LENGTH: 256,
    IV_BYTE_LENGTH: 12,
    TAG_LENGTH_BITS: 128,
  },
  DIGEST: {
    ALGORITHM: 'SHA-256',
  },
  KEY_EXCHANGE: {
    ALGORITHM: 'ECDH',
    NAMED_CURVE: 'P-256',
  },
};

/**
 * Allowed MIME types and max constraints for evidence locker records
 */
export const EVIDENCE_LOCKER_LIMITS = {
  MAX_FILES_PER_RECORD: 10,
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MiB per file
  MAX_TOTAL_RECORD_BYTES: 50 * 1024 * 1024, // 50 MiB total per record
  MAX_TITLE_LENGTH: 120,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_TAGS_COUNT: 10,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/json',
  ],
};

/**
 * Statutory and civic record categories
 */
export const EVIDENCE_RECORD_CATEGORIES = [
  { id: 'IDENTITY_RECORD', label: 'Identity & Vital Records', description: 'Aadhaar ack, Voter ID slip, Birth/Death registration proof' },
  { id: 'UTILITY_BILLING_DISPUTE', label: 'Utility Billing & Meter Dispute', description: 'Electricity bills, meter audit photos, inspection memos' },
  { id: 'REVENUE_PROPERTY_TAX', label: 'Property Tax & Land Revenue', description: 'Tax receipts, mutation acknowledgements, demarcation reports' },
  { id: 'CIVIC_INFRASTRUCTURE', label: 'Civic Infrastructure Grievance', description: 'Pothole geotagged photos, water logging, streetlight failure' },
  { id: 'WELFARE_SCHEME_CLAIM', label: 'Welfare & Scholarship Proof', description: 'Income cert slips, domicile proof, caste affidavit' },
  { id: 'HEALTHCARE_CLINICAL', label: 'Healthcare & Clinical Records', description: 'Hospital OPD receipts, treatment estimate memos' },
  { id: 'CONSUMER_DISPUTE', label: 'Consumer & Commercial Evidence', description: 'Invoices, guarantee cards, complaint email logs' },
  { id: 'LEGAL_NOTICE_RTI', label: 'RTI Request & Legal Notices', description: 'RTI application copy, postal tracking receipts, response orders' },
];

/**
 * Evidence classification tags
 */
export const EVIDENCE_SENSITIVITY_LEVELS = {
  STANDARD: { id: 'STANDARD', label: 'Standard Civic Record', color: 'blue' },
  RESTRICTED: { id: 'RESTRICTED', label: 'Restricted / Sensitive', color: 'amber' },
  HIGHLY_CONFIDENTIAL: { id: 'HIGHLY_CONFIDENTIAL', label: 'Highly Confidential (Personal/Dispute)', color: 'red' },
};

/**
 * Canonical JSON serializer for deterministic hashing
 */
export function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const keyVals = sortedKeys.map((key) => {
    return `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`;
  });
  return `{${keyVals.join(',')}}`;
}

/**
 * Validates an encrypted record package envelope
 */
export function validateEvidenceRecordEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, error: 'Envelope must be a non-null object' };
  }
  if (envelope.schemaVersion !== EVIDENCE_LOCKER_SCHEMA_VERSION) {
    return { valid: false, error: `Unsupported schema version: ${envelope.schemaVersion}` };
  }
  if (!envelope.id || typeof envelope.id !== 'string') {
    return { valid: false, error: 'Missing or invalid record id' };
  }
  if (!envelope.publicMetadata || typeof envelope.publicMetadata !== 'object') {
    return { valid: false, error: 'Missing publicMetadata object' };
  }
  const { title, category, sensitivity } = envelope.publicMetadata;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: 'Missing title in publicMetadata' };
  }
  if (!category || typeof category !== 'string') {
    return { valid: false, error: 'Missing category in publicMetadata' };
  }
  if (!sensitivity || typeof sensitivity !== 'string') {
    return { valid: false, error: 'Missing sensitivity level in publicMetadata' };
  }
  if (!envelope.crypto || typeof envelope.crypto !== 'object') {
    return { valid: false, error: 'Missing crypto specification object' };
  }
  const { cipher, kdf, payloadDigest, ciphertext, iv, salt } = envelope.crypto;
  if (!cipher || cipher !== 'AES-256-GCM') {
    return { valid: false, error: 'Cipher must be AES-256-GCM' };
  }
  if (!kdf || kdf !== 'PBKDF2') {
    return { valid: false, error: 'KDF must be PBKDF2' };
  }
  if (!payloadDigest || typeof payloadDigest !== 'string' || payloadDigest.length !== 64) {
    return { valid: false, error: 'Invalid SHA-256 payloadDigest' };
  }
  if (!ciphertext || typeof ciphertext !== 'string') {
    return { valid: false, error: 'Missing ciphertext base64 payload' };
  }
  if (!iv || typeof iv !== 'string') {
    return { valid: false, error: 'Missing IV base64' };
  }
  if (!salt || typeof salt !== 'string') {
    return { valid: false, error: 'Missing salt base64' };
  }

  return { valid: true };
}

/**
 * Validates sharing grant parameters
 */
export function validateShareGrant(grant) {
  if (!grant || typeof grant !== 'object') {
    return { valid: false, error: 'Grant must be an object' };
  }
  if (!grant.grantId || typeof grant.grantId !== 'string') {
    return { valid: false, error: 'Missing grantId' };
  }
  if (!grant.recordId || typeof grant.recordId !== 'string') {
    return { valid: false, error: 'Missing recordId' };
  }
  if (!grant.recipientLabel || typeof grant.recipientLabel !== 'string') {
    return { valid: false, error: 'Missing recipientLabel' };
  }
  if (!grant.expiresAt || typeof grant.expiresAt !== 'string') {
    return { valid: false, error: 'Missing expiresAt timestamp' };
  }
  const expTime = new Date(grant.expiresAt).getTime();
  if (isNaN(expTime)) {
    return { valid: false, error: 'Invalid expiresAt format' };
  }
  if (typeof grant.maxAccessCount !== 'number' || grant.maxAccessCount < 1) {
    return { valid: false, error: 'maxAccessCount must be at least 1' };
  }
  return { valid: true };
}

/**
 * Non-PII Synthetic Fixtures for tests and demonstration
 */
export const SYNTHETIC_EVIDENCE_FIXTURES = [
  {
    id: 'rec-synth-001',
    schemaVersion: EVIDENCE_LOCKER_SCHEMA_VERSION,
    publicMetadata: {
      title: 'Disputed Electricity Commercial Tariff Challan - Ward 14',
      category: 'UTILITY_BILLING_DISPUTE',
      sensitivity: 'RESTRICTED',
      jurisdiction: 'Uttar Pradesh Power Corporation Limited (UPPCL) - Lucknow Central',
      createdAt: '2026-03-15T10:30:00.000Z',
      fileCount: 2,
      totalBytes: 245800,
      tags: ['electricity', 'meter-dispute', 'challan'],
      legalNoticeDisclaimerAccepted: true,
    },
    // The plaintext unencrypted payload (in client memory only, before encryption)
    plaintextSample: {
      narrative: 'Disputed commercial tariff levied on residential domestic connection meter #E-89212 without notice.',
      entries: [
        {
          fileName: 'domestic_residential_sanction_order_2024.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 142100,
          sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          notes: 'Official domestic sanction letter dated 12 Aug 2024.',
        },
        {
          fileName: 'smart_meter_reading_photo_nov_2026.png',
          mimeType: 'image/png',
          sizeBytes: 103700,
          sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
          notes: 'High-res photograph of physical meter displaying cumulative kWh tally.',
        },
      ],
    },
  },
  {
    id: 'rec-synth-002',
    schemaVersion: EVIDENCE_LOCKER_SCHEMA_VERSION,
    publicMetadata: {
      title: 'Municipal Property Mutation Fee Acknowledgement',
      category: 'REVENUE_PROPERTY_TAX',
      sensitivity: 'STANDARD',
      jurisdiction: 'Nagar Nigam Lucknow - Zone 3',
      createdAt: '2026-04-02T14:15:00.000Z',
      fileCount: 1,
      totalBytes: 89400,
      tags: ['property-tax', 'mutation', 'receipt'],
      legalNoticeDisclaimerAccepted: true,
    },
    plaintextSample: {
      narrative: 'Online mutation acknowledgment slip following death of primary leaseholder.',
      entries: [
        {
          fileName: 'mutation_fee_challan_ack_2026.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 89400,
          sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
          notes: 'Treasury challan copy #TR-9912.',
        },
      ],
    },
  },
];
