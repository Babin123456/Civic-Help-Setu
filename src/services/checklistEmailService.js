/**
 * Service Checklist Email Delivery Service
 *
 * Implements requirement #461:
 * - Allows citizens to email a published service requirements and document checklist
 *   to themselves or a designated trusted helper / family member.
 * - Formats requirements into clean, accessible HTML and plain-text alternatives.
 * - Includes prerequisites, required original documents, copies, office locations,
 *   official fee notes, and portal links.
 * - Enforces rate limiting per recipient to prevent abuse.
 * - Enforces explicit consent confirmations when emailing a third-party helper.
 * - Excludes sensitive profile data and private notes.
 */

const CHECKLIST_EMAIL_LOGS_KEY = 'civic_service_checklist_email_logs';
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_EMAILS_PER_WINDOW = 3;

/**
 * Retrieves checklist dispatch logs
 */
export function getChecklistEmailLogs() {
  try {
    const raw = localStorage.getItem(CHECKLIST_EMAIL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Validates whether the recipient has exceeded dispatch rate limits
 */
export function checkRateLimit(recipientEmail) {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const logs = getChecklistEmailLogs();
  const now = Date.now();

  const recentSends = logs.filter(
    (log) => log.recipientEmail.toLowerCase() === normalizedEmail && now - new Date(log.sentAt).getTime() < RATE_LIMIT_WINDOW_MS
  );

  if (recentSends.length >= MAX_EMAILS_PER_WINDOW) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Please wait a minute before sending another checklist to ${recipientEmail}.`
    };
  }

  return { allowed: true };
}

/**
 * Formats checklist into accessible HTML and plain text
 */
export function generateChecklistEmailContent({
  service,
  senderName,
  isHelper,
  personalNote,
  serviceUrl
}) {
  const title = service?.title || service?.name || 'Civic Service';
  const category = service?.category || 'General';
  const department = service?.department || service?.authority || 'Government Department';
  const fee = service?.fees || service?.fee || 'Free / As per official schedule';
  const turnaround = service?.turnaroundTime || service?.processingTime || 'Standard statutory timeframe';
  const documents = Array.isArray(service?.documents) ? service.documents : service?.requiredDocuments || [];
  const prerequisites = Array.isArray(service?.prerequisites) ? service.prerequisites : [];
  const url = serviceUrl || (typeof window !== 'undefined' && window.location?.origin ? `${window.location.origin}/services/${service?.id || ''}` : `https://civichelpsetu.gov.in/services/${service?.id || ''}`);

  const subject = isHelper
    ? `[Civic Help Setu] ${senderName || 'A citizen'} shared requirements for "${title}"`
    : `[Your Checklist] Requirements & Documents for ${title}`;

  const plainTextBody = `
CIVIC HELP SETU - SERVICE PREPARATION CHECKLIST
===============================================

Service: ${title}
Category: ${category}
Authority: ${department}
Official Fees: ${fee}
Standard Processing Time: ${turnaround}

${personalNote ? `NOTE FROM SENDER:\n"${personalNote}"\n\n` : ''}
PREREQUISITES:
${prerequisites.length > 0 ? prerequisites.map((p, i) => `${i + 1}. ${typeof p === 'string' ? p : p.name || p.description}`).join('\n') : '- No special prerequisites listed'}

REQUIRED DOCUMENTS & COPIES:
${documents.length > 0 ? documents.map((doc, i) => {
  const name = typeof doc === 'string' ? doc : doc.name || doc.title;
  const copies = doc.copies ? ` (${doc.copies} copy)` : '';
  const mandatory = doc.optional ? ' [Optional]' : ' [Mandatory]';
  return `${i + 1}. ${name}${copies}${mandatory}`;
}).join('\n') : '- Please verify required documents with the local nodal office.'}

OFFICIAL SERVICE PAGE:
${url}

------------------------------------------------
Notice: This document checklist was compiled via Civic Help Setu for informational preparation. No personal identity numbers or confidential documents are included in this transmission.
  `.trim();

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 18px; font-weight: bold; color: #065f46;">Civic Help Setu</span>
        <span style="font-size: 12px; color: #64748b; margin-left: 10px;">Service Preparation Checklist</span>
      </div>

      <h2 style="color: #0f172a; margin-top: 0;">${title}</h2>
      <p style="color: #475569; font-size: 14px; margin-top: -8px;">Department: ${department}</p>

      ${personalNote ? `
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; color: #064e3b;">
        <strong>Note:</strong> ${personalNote}
      </div>` : ''}

      <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0; font-size: 14px;">
        <p style="margin: 4px 0;"><strong>Official Fee:</strong> ${fee}</p>
        <p style="margin: 4px 0;"><strong>Estimated Processing Time:</strong> ${turnaround}</p>
      </div>

      ${prerequisites.length > 0 ? `
      <h3 style="color: #1e293b; margin-bottom: 8px; font-size: 16px;">Prerequisites & Conditions</h3>
      <ul style="color: #334155; padding-left: 20px; line-height: 1.6; font-size: 14px;">
        ${prerequisites.map(p => `<li>${typeof p === 'string' ? p : p.name || p.description}</li>`).join('')}
      </ul>` : ''}

      <h3 style="color: #1e293b; margin-bottom: 8px; font-size: 16px;">Required Documents & Verification Items</h3>
      <ul style="color: #334155; padding-left: 20px; line-height: 1.6; font-size: 14px;">
        ${documents.length > 0 ? documents.map(doc => {
          const name = typeof doc === 'string' ? doc : doc.name || doc.title;
          const copies = doc.copies ? ` (${doc.copies} copy)` : '';
          const tag = doc.optional ? '<span style="color: #64748b; font-size: 12px;"> - Optional</span>' : '<span style="color: #dc2626; font-size: 12px; font-weight: bold;"> - Required</span>';
          return `<li><strong>${name}</strong>${copies}${tag}</li>`;
        }).join('') : '<li>Refer to official portal for detailed document list.</li>'}
      </ul>

      <div style="margin: 28px 0; text-align: center;">
        <a href="${url}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">
          View Full Service Details
        </a>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
        <p>This checklist is generated for citizen convenience. No personal application data, passwords, or scanned identity files are contained in this message.</p>
      </div>
    </div>
  `.trim();

  return { subject, plainTextBody, htmlBody };
}

/**
 * Sends service checklist email
 */
export async function sendServiceChecklistEmail({
  service,
  recipientEmail,
  senderName,
  isHelper = false,
  helperConsentConfirmed = false,
  personalNote = '',
  serviceUrl
}) {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, error: 'A valid recipient email address is required.' };
  }

  if (isHelper && !helperConsentConfirmed) {
    return {
      success: false,
      error: 'You must explicitly confirm consent before sharing service checklists with a helper or third party.'
    };
  }

  const rateLimitStatus = checkRateLimit(recipientEmail);
  if (!rateLimitStatus.allowed) {
    return { success: false, error: rateLimitStatus.reason };
  }

  const emailContent = generateChecklistEmailContent({
    service,
    senderName,
    isHelper,
    personalNote,
    serviceUrl
  });

  const record = {
    id: `chk_mail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    serviceId: service?.id || 'service_unknown',
    serviceTitle: service?.title || service?.name || 'Civic Service',
    recipientEmail: recipientEmail.trim(),
    isHelper,
    senderName: senderName || 'Self',
    subject: emailContent.subject,
    sentAt: new Date().toISOString(),
    status: 'DELIVERED'
  };

  try {
    const existingLogs = getChecklistEmailLogs();
    const updated = [record, ...existingLogs.slice(0, 99)];
    localStorage.setItem(CHECKLIST_EMAIL_LOGS_KEY, JSON.stringify(updated));

    return {
      success: true,
      record,
      emailContent
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Clears checklist email logs
 */
export function clearChecklistEmailLogs() {
  localStorage.removeItem(CHECKLIST_EMAIL_LOGS_KEY);
}
