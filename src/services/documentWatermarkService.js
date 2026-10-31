/**
 * Statutory and Security Purpose Watermark Generator for Civic Vault Documents.
 *
 * Implements UIDAI and MeitY recommended purpose-limiting attestation stamps
 * for uploaded identity proofs (Aadhaar, PAN, Voter ID, Certificates, etc.)
 * to prevent unauthorized secondary use, identity theft, and duplicate submissions.
 */

import { sanitizePlainText } from '../utils/safeContent';

export const ATTESTATION_PURPOSE_PRESETS = [
  {
    id: 'PASSPORT',
    label: 'Passport Seva Application',
    text: 'ONLY FOR PASSPORT SEVA APPLICATION — NOT VALID FOR OTHER PURPOSES',
  },
  {
    id: 'BANK_KYC',
    label: 'Bank Account / KYC Verification',
    text: 'SUBMITTED EXCLUSIVELY FOR BANK KYC VERIFICATION — DO NOT MISUSE',
  },
  {
    id: 'SIM_REGISTRATION',
    label: 'Telecom SIM Issuance',
    text: 'STRICTLY FOR TELECOM SIM CARD REGISTRATION ONLY',
  },
  {
    id: 'EXAM_ADMISSION',
    label: 'Academic / Competitive Exam Admission',
    text: 'SUBMITTED FOR ACADEMIC ADMISSION & CANDIDATE VERIFICATION ONLY',
  },
  {
    id: 'WELFARE_SCHEME',
    label: 'Civic Welfare Scheme Application',
    text: 'FOR GOVERNMENT WELFARE SCHEME BENEFICIARY IDENTIFICATION ONLY',
  },
  {
    id: 'CUSTOM',
    label: 'Custom Citizen Purpose',
    text: '',
  },
];

export const DEFAULT_WATERMARK_OPTIONS = {
  purposeId: 'PASSPORT',
  customPurpose: '',
  recipientOrganization: '',
  selfAttested: true,
  attestationName: '',
  includeDate: true,
  referenceId: '',
};

/**
 * Resolves the primary watermark string based on preset or custom text.
 */
export function resolveWatermarkText(purposeId, customPurpose = '') {
  if (purposeId === 'CUSTOM') {
    const cleaned = sanitizePlainText(customPurpose, { max: 120, multiline: false });
    return cleaned ? `ONLY FOR: ${cleaned.toUpperCase()} — DO NOT DUPLICATE` : 'CONFIDENTIAL USE ONLY — RESTRICTED PURPOSE';
  }
  const preset = ATTESTATION_PURPOSE_PRESETS.find((p) => p.id === purposeId);
  return preset ? preset.text : 'OFFICIAL SUBMISSION COPY — PURPOSE RESTRICTED';
}

/**
 * Formats a clean date string for the watermark banner.
 */
export function formatWatermarkDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generates an attestation header and verification payload for printable/shareable exports.
 */
export function generateAttestationPayload(documentRecord, options = {}) {
  const doc = documentRecord || {};
  const opts = { ...DEFAULT_WATERMARK_OPTIONS, ...options };

  const resolvedWatermark = resolveWatermarkText(opts.purposeId, opts.customPurpose);
  const formattedDate = formatWatermarkDate();
  const recipient = sanitizePlainText(opts.recipientOrganization, { max: 100, multiline: false }) || 'VERIFYING CIVIC AUTHORITY';
  const citizenName = sanitizePlainText(opts.attestationName, { max: 80, multiline: false }) || 'Document Holder';
  const docType = doc.type || 'Identity / Civic Document';
  const docName = doc.name || 'Official Document';
  const refId = opts.referenceId || doc.id || `CB-DOC-${Date.now().toString().slice(-6)}`;

  const attestationLines = [
    `=== CIVIC-HELP-SETU PURPOSE-ATTESTED DOCUMENT SPECIFICATION ===`,
    `DOCUMENT TITLE : ${docName} (${docType})`,
    `DOCUMENT REF   : ${refId}`,
    `INTENDED FOR   : ${recipient}`,
    `STAMPED DATE   : ${formattedDate}`,
    `SECURITY STAMP : ${resolvedWatermark}`,
  ];

  if (opts.selfAttested) {
    attestationLines.push(
      `SELF-ATTESTATION: Certified that this is a true, authentic copy submitted solely to ${recipient} for lawful civic verification.`,
      `ATTESTED BY    : ${citizenName}`
    );
  }

  attestationLines.push(
    `WARNING: Any unauthorized storage, secondary sharing, or use beyond the stated recipient is punishable under law.`
  );

  return {
    referenceId: refId,
    watermarkText: resolvedWatermark,
    dateString: formattedDate,
    recipient,
    citizenName,
    isSelfAttested: opts.selfAttested,
    formattedSummary: attestationLines.join('\n'),
  };
}
