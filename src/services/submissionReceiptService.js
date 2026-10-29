/**
 * Civic Submission Receipt Service
 *
 * Generates verified submission acknowledgment receipts, deterministic
 * digital verification seals, structured receipt summaries, and offline-compatible
 * text exports for tracked civic applications.
 */

import { formatDisplayDate } from './trackingService';

/**
 * Generates a deterministic alphanumeric verification seal for a tracked application.
 * Uses a robust polynomial rolling hash over key submission fields.
 *
 * @param {Object} application
 * @returns {string} Formatted verification seal (e.g., CB-SEAL-XXXX-XXXX)
 */
export const generateReceiptVerificationHash = (application) => {
  if (!application || !application.id) return 'CB-SEAL-0000-0000';

  const payload = [
    String(application.id || ''),
    String(application.serviceName || ''),
    String(application.applicantName || 'Citizen'),
    String(application.appliedDate || ''),
    'CIVIC_BRIDGE_STATUTORY_ACK'
  ].join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Generate deterministic 8-character hex parts
  const unsigned = hash >>> 0;
  const part1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const part2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');

  return `CB-SEAL-${part1}-${part2}`;
};

/**
 * Builds a standardized receipt data structure for an application.
 *
 * @param {Object} application
 * @returns {Object} Structured receipt data
 */
export const buildReceiptSummary = (application) => {
  if (!application) return null;

  const receiptNumber = `REC-${String(application.id || 'N/A').toUpperCase()}`;
  const verificationSeal = generateReceiptVerificationHash(application);
  const formattedAppliedDate = formatDisplayDate(application.appliedDate) || application.appliedDate || 'Not Available';
  const formattedCompletionDate = formatDisplayDate(application.estimatedCompletion) || application.estimatedCompletion || 'Under Department Scrutiny';

  const stagesSummary = Array.isArray(application.stages)
    ? application.stages.map((stage, idx) => ({
        step: idx + 1,
        title: stage.title || stage.name || `Stage ${idx + 1}`,
        status: stage.completed ? 'COMPLETED' : (stage.current ? 'IN PROGRESS' : 'PENDING'),
        date: stage.date || (stage.completed ? 'Completed' : 'Pending')
      }))
    : [];

  return {
    receiptNumber,
    applicationId: application.id,
    serviceName: application.serviceName || 'Civic Public Service',
    applicantName: application.applicantName || 'Citizen Applicant',
    submissionDate: formattedAppliedDate,
    targetCompletionDate: formattedCompletionDate,
    status: application.status || 'in-progress',
    verificationSeal,
    issuedAt: new Date().toISOString(),
    statutoryNotice: 'Official acknowledgment slip under State Right to Public Services Charter. Quote reference number for all statutory appellate escalations or RTIs.',
    stages: stagesSummary
  };
};

/**
 * Formats receipt summary into an ink-friendly, SMS/WhatsApp ready plain-text slip.
 *
 * @param {Object} receipt
 * @returns {string} Plain-text formatted slip
 */
export const formatReceiptAsPlainText = (receipt) => {
  if (!receipt) return '';

  const border = '==================================================';
  const subBorder = '--------------------------------------------------';

  const lines = [
    border,
    '           CIVIC-HELP-SETU PORTAL                 ',
    '       OFFICIAL SUBMISSION ACKNOWLEDGMENT         ',
    border,
    `Receipt No        : ${receipt.receiptNumber}`,
    `Reference ID      : ${receipt.applicationId}`,
    `Digital Seal      : ${receipt.verificationSeal}`,
    subBorder,
    `Service Requested : ${receipt.serviceName}`,
    `Applicant Name    : ${receipt.applicantName}`,
    `Filing Date       : ${receipt.submissionDate}`,
    `Target Completion : ${receipt.targetCompletionDate}`,
    `Current Status    : ${String(receipt.status).toUpperCase()}`,
    subBorder,
    'APPLICATION PROCESSING TIMELINE:'
  ];

  if (receipt.stages && receipt.stages.length > 0) {
    receipt.stages.forEach((st) => {
      lines.push(`  [${st.status}] Stage ${st.step}: ${st.title}`);
    });
  } else {
    lines.push('  [PENDING] Departmental Intake & Document Verification');
  }

  lines.push(
    subBorder,
    'STATUTORY NOTICE:',
    receipt.statutoryNotice,
    border,
    'Retain this acknowledgment slip for all official communications.',
    border
  );

  return lines.join('\n');
};

/**
 * Triggers browser download of the receipt as a .txt document.
 * Safe client-side utility using standard Blob creation.
 *
 * @param {Object} receipt
 */
export const downloadReceiptTextFile = (receipt) => {
  if (!receipt || typeof document === 'undefined') return;

  const content = formatReceiptAsPlainText(receipt);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `Submission-Receipt-${receipt.applicationId}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
