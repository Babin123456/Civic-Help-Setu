/**
 * Statutory Application Deficiency Cure & Objection Resolution Service.
 *
 * Implements procedural compliance workflows under State Public Service Guarantee Acts:
 * when an application is put "On Hold" / "Action Required", citizens are given a mandatory
 * 15-day cure window to provide rectified documents or clarifications before rejection.
 */

import { sanitizePlainText } from '../utils/safeContent';

export const STATUTORY_CURE_WINDOW_DAYS = 15;

export const OBJECTION_CATEGORIES = [
  {
    id: 'DOCUMENT_ILLEGIBLE',
    label: 'Illegible / Blurry Document Upload',
    suggestedResolution: 'Upload high-resolution scanned copy (300 DPI, PDF or clean JPEG).',
  },
  {
    id: 'NAME_MISMATCH',
    label: 'Applicant Name / Surname Spelling Mismatch',
    suggestedResolution: 'Attach Gazette notification or notarized one-and-the-same person affidavit.',
  },
  {
    id: 'EXPIRED_PROOF',
    label: 'Expired Validity Period Proof',
    suggestedResolution: 'Submit current fiscal year validity certificate or renewal receipt.',
  },
  {
    id: 'JURISDICTION_DEFICIENCY',
    label: 'Jurisdiction / Ward Demarcation Query',
    suggestedResolution: 'Submit municipal property tax receipt or verified domicile certificate.',
  },
  {
    id: 'MISSING_SIGNATURE',
    label: 'Missing Self-Attestation / Form Incomplete',
    suggestedResolution: 'Submit freshly self-attested document with date and place.',
  },
  {
    id: 'OTHER',
    label: 'Other Scrutiny Officer Objection',
    suggestedResolution: 'Provide comprehensive clarification addressing the specific discrepancy notice.',
  },
];

/**
 * Calculates remaining cure timeline and urgency status.
 */
export function calculateCureTimeline(application = {}) {
  const app = application || {};
  // Determine date the objection was raised: fallback to lastUpdate or submissionDate
  const objectionDateStr = app.actionRequiredDate || app.lastUpdate || app.submissionDate || new Date().toISOString().slice(0, 10);
  const objectionDate = new Date(objectionDateStr);

  const now = new Date();
  const msElapsed = now.getTime() - objectionDate.getTime();
  const daysElapsed = Math.max(0, Math.floor(msElapsed / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, STATUTORY_CURE_WINDOW_DAYS - daysElapsed);
  const isExpired = daysRemaining === 0;

  let urgencyLevel = 'NORMAL';
  if (isExpired) {
    urgencyLevel = 'CRITICAL_EXPIRED';
  } else if (daysRemaining <= 3) {
    urgencyLevel = 'HIGH_URGENCY';
  } else if (daysRemaining <= 7) {
    urgencyLevel = 'MODERATE';
  }

  return {
    objectionDate: objectionDateStr,
    statutoryWindowDays: STATUTORY_CURE_WINDOW_DAYS,
    daysElapsed,
    daysRemaining,
    isExpired,
    urgencyLevel,
  };
}

/**
 * Generates formal statutory "Rectification & Compliance Response Letter"
 */
export function generateRectificationNoticeDraft(application = {}, cureDetails = {}) {
  const app = application || {};
  const timeline = calculateCureTimeline(app);

  const citizenName = sanitizePlainText(cureDetails.citizenName, { max: 80, multiline: false }) || 'Applicant Citizen';
  const appId = app.id || 'N/A';
  const serviceName = app.serviceName || 'Public Service';
  const objectionCategory = OBJECTION_CATEGORIES.find((c) => c.id === cureDetails.objectionId)?.label || 'General Scrutiny Objection';
  const explanation = sanitizePlainText(cureDetails.explanation, { max: 1000, multiline: true }) || 'Rectified supporting documents attached herewith for verification.';
  const attachedDocs = Array.isArray(cureDetails.rectifiedDocuments) && cureDetails.rectifiedDocuments.length > 0
    ? cureDetails.rectifiedDocuments.map((d, idx) => `  ${idx + 1}. ${sanitizePlainText(d, { max: 100, multiline: false })}`).join('\n')
    : '  1. Duly rectified supporting document copy';

  return `TO:
The Scrutiny Officer / Competent Authority,
Public Services Delivery Directorate

SUBJECT: STATUTORY COMPLIANCE & DEFICIENCY RECTIFICATION NOTICE
REFERENCE: Application Acknowledgement No: ${appId} for ${serviceName}
STATUTORY REMEDY: Under Citizens' Charter & Right to Public Services Act

Sir / Madam,

With reference to the objection / defect communicated regarding the above-referenced application:

1. OBJECTION CATEGORY:
   ${objectionCategory}

2. STATUTORY CURE TIMELINE STATUS:
   Objection Communicated: ${timeline.objectionDate}
   Prescribed Cure Window: ${timeline.statutoryWindowDays} Days (${timeline.daysRemaining} days remaining)

3. APPLICANT'S RECTIFICATION & EXPLANATION:
   ${explanation}

4. ENCLOSED RECTIFIED DOCUMENTS / ATTESTATIONS:
${attachedDocs}

I hereby confirm that all pointed defects have been fully cured in accordance with statutory guidelines. It is respectfully requested that my application be taken up for prompt verification and grant of statutory clearance without further delay.

Submitted with respect,
${citizenName}
Application ID: ${appId}
Date: ${new Date().toLocaleDateString('en-IN')}`;
}
