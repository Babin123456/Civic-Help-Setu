/** Shared guide-feedback vocabulary and PII minimization; no browser or SDK dependencies. */
export const PLATFORM_FEEDBACK_DISCLAIMER =
  'This is anonymous platform improvement feedback for Civic Help Setu guide authors. It is NOT an official government grievance, police complaint, or administrative RTI inquiry. Please do NOT include case numbers, bank details, Aadhaar, or phone numbers.';

export const FEEDBACK_CATEGORIES = [
  { id: 'unclear_instructions', label: 'Unclear Instructions / Terminology' },
  { id: 'missing_information', label: 'Missing Document / Fee Info' },
  { id: 'broken_link', label: 'Broken / Expired Official Link' },
  { id: 'accessibility', label: 'Accessibility / Readability Barrier' },
  { id: 'other', label: 'Other Guide Friction' },
];

export const FEEDBACK_STATUSES = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  ADDRESSED: 'addressed',
  DISMISSED: 'dismissed',
};

export const scrubPII = (input) => {
  if (!input || typeof input !== 'string') return { text: '', piiDetected: false };

  let text = input;
  let piiDetected = false;

  // 1. Email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(text)) {
    text = text.replace(emailRegex, '[EMAIL_REDACTED]');
    piiDetected = true;
  }

  // 2. 12-digit Aadhaar (continuous or spaced 4-4-4)
  const aadhaarRegex = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
  if (aadhaarRegex.test(text)) {
    text = text.replace(aadhaarRegex, '[AADHAAR_REDACTED]');
    piiDetected = true;
  }

  // 3. 10-character PAN card format (5 uppercase letters, 4 digits, 1 letter)
  const panRegex = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g;
  if (panRegex.test(text)) {
    text = text.replace(panRegex, '[PAN_REDACTED]');
    piiDetected = true;
  }

  // 4. 10-digit Indian phone number
  const phoneRegex = /\b[6-9]\d{9}\b/g;
  if (phoneRegex.test(text)) {
    text = text.replace(phoneRegex, '[PHONE_REDACTED]');
    piiDetected = true;
  }

  // 5. Case / Application / Token ID patterns (e.g. APP-123456, CASE#98765, GRV/2026/001)
  const caseRegex = /\b(APP|CASE|GRV|COMPLAINT|REF|TICKET)[-_/#:]?\d{4,}\b/gi;
  if (caseRegex.test(text)) {
    text = text.replace(caseRegex, '[CASE_ID_REDACTED]');
    piiDetected = true;
  }

  return { text, piiDetected };
};

