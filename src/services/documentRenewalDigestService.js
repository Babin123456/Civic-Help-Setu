/**
 * Document Renewal Digest & Expiry Alerts Service (#432)
 *
 * Evaluates document metadata from the local vault against statutory renewal rules,
 * computes lead times and urgency tiers, and generates offline RFC 5545 iCalendar (.ics)
 * reminder files without transmitting document contents or metadata to any remote server.
 */

/**
 * Urgency classification levels
 */
export const RENEWAL_URGENCY = Object.freeze({
  EXPIRED: 'expired',
  URGENT: 'urgent',
  UPCOMING: 'upcoming',
  ADVANCE_NOTICE: 'advance_notice',
  HEALTHY: 'healthy',
  NO_EXPIRY: 'no_expiry',
});

/**
 * Known statutory renewal profiles by document type.
 */
export const STATUTORY_RENEWAL_PROFILES = Object.freeze({
  passport: {
    recommendedLeadDays: 365,
    urgentThresholdDays: 60,
    serviceId: 'passport',
    statutoryAdvice:
      'Passport re-issue opens up to 12 months prior to expiry. International travel commonly requires at least 6 months validity.',
  },
  'driving-license': {
    recommendedLeadDays: 60,
    urgentThresholdDays: 30,
    serviceId: 'driving-license',
    statutoryAdvice:
      'Driving licence renewal window opens 30-60 days before expiry. Grace period of 1 year applies before re-test, but driving with an expired licence is punishable.',
  },
  'income-certificate': {
    recommendedLeadDays: 30,
    urgentThresholdDays: 15,
    serviceId: 'income-certificate',
    statutoryAdvice:
      'Income and EWS certificates are typically issued for 1 financial year (valid till March 31). Re-apply in April with updated ITR or employer statement.',
  },
  'ration-card': {
    recommendedLeadDays: 60,
    urgentThresholdDays: 30,
    serviceId: 'ration-card',
    statutoryAdvice:
      'Ration cards require periodic biometric / e-KYC validation at the nearest fair price shop or civil supplies office.',
  },
});

/**
 * Infer matching statutory profile based on document type or title.
 * @param {Object} doc
 * @returns {Object|null}
 */
export function getStatutoryProfileForDocument(doc) {
  if (!doc) return null;
  const text = `${doc.type || ''} ${doc.name || ''} ${doc.category || ''}`.toLowerCase();

  if (text.includes('passport')) return STATUTORY_RENEWAL_PROFILES.passport;
  if (text.includes('driving') || text.includes('license') || text.includes('licence') || text.includes('dl')) {
    return STATUTORY_RENEWAL_PROFILES['driving-license'];
  }
  if (text.includes('income') || text.includes('ews')) return STATUTORY_RENEWAL_PROFILES['income-certificate'];
  if (text.includes('ration')) return STATUTORY_RENEWAL_PROFILES['ration-card'];

  return null;
}

/**
 * Calculates remaining days from reference date to expiry date.
 * @param {string|Date} expiryDate
 * @param {Date} [referenceDate=new Date()]
 * @returns {number|null} Whole days remaining, or null if no valid expiry date
 */
export function calculateDaysRemaining(expiryDate, referenceDate = new Date()) {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return null;

  const ref = new Date(referenceDate);
  const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const expMidnight = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());

  const diffMs = expMidnight.getTime() - refMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates urgency status for a single document.
 * @param {Object} doc
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} Urgency assessment
 */
export function assessDocumentUrgency(doc, referenceDate = new Date()) {
  const days = calculateDaysRemaining(doc?.expiryDate, referenceDate);
  const profile = getStatutoryProfileForDocument(doc);
  const leadDays = profile?.recommendedLeadDays ?? 90;
  const urgentThreshold = profile?.urgentThresholdDays ?? 30;

  if (days === null) {
    return {
      urgency: RENEWAL_URGENCY.NO_EXPIRY,
      urgencyLabel: 'No Expiry',
      daysRemaining: null,
      statutoryAdvice: 'Document does not have a recorded expiration date.',
      suggestedServiceId: profile?.serviceId || null,
      leadTimeDays: leadDays,
    };
  }

  if (days < 0) {
    return {
      urgency: RENEWAL_URGENCY.EXPIRED,
      urgencyLabel: 'Expired',
      daysRemaining: days,
      statutoryAdvice: profile?.statutoryAdvice || 'This document has expired. Immediate renewal or replacement is advised.',
      suggestedServiceId: profile?.serviceId || null,
      leadTimeDays: leadDays,
    };
  }

  if (days <= urgentThreshold) {
    return {
      urgency: RENEWAL_URGENCY.URGENT,
      urgencyLabel: `Urgent (${days}d left)`,
      daysRemaining: days,
      statutoryAdvice: profile?.statutoryAdvice || 'Document expires very soon. Prepare prerequisite verification documents now.',
      suggestedServiceId: profile?.serviceId || null,
      leadTimeDays: leadDays,
    };
  }

  if (days <= 90) {
    return {
      urgency: RENEWAL_URGENCY.UPCOMING,
      urgencyLabel: `Upcoming (${days}d left)`,
      daysRemaining: days,
      statutoryAdvice: profile?.statutoryAdvice || 'Renewal window is approaching. Check official requirements before visiting.',
      suggestedServiceId: profile?.serviceId || null,
      leadTimeDays: leadDays,
    };
  }

  if (days <= leadDays) {
    return {
      urgency: RENEWAL_URGENCY.ADVANCE_NOTICE,
      urgencyLabel: `Advance Notice (${days}d left)`,
      daysRemaining: days,
      statutoryAdvice: profile?.statutoryAdvice || 'Statutory advance renewal window is open.',
      suggestedServiceId: profile?.serviceId || null,
      leadTimeDays: leadDays,
    };
  }

  return {
    urgency: RENEWAL_URGENCY.HEALTHY,
    urgencyLabel: 'Valid',
    daysRemaining: days,
    statutoryAdvice: 'Document validity is healthy.',
    suggestedServiceId: profile?.serviceId || null,
    leadTimeDays: leadDays,
  };
}

/**
 * Generates an aggregated renewal digest report across all vault documents.
 * @param {Array} documents List of vault documents
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} Comprehensive digest
 */
export function generateDocumentRenewalDigest(documents = [], referenceDate = new Date()) {
  const items = [];
  const summary = {
    total: documents.length,
    expired: 0,
    urgent: 0,
    upcoming: 0,
    advanceNotice: 0,
    healthy: 0,
    noExpiry: 0,
    actionRequiredCount: 0,
  };

  documents.forEach((doc) => {
    const assessment = assessDocumentUrgency(doc, referenceDate);
    const item = {
      documentId: doc.id,
      documentName: doc.name || 'Unnamed Document',
      documentType: doc.type || 'General',
      category: doc.category || 'Identity',
      expiryDate: doc.expiryDate || null,
      daysRemaining: assessment.daysRemaining,
      urgency: assessment.urgency,
      urgencyLabel: assessment.urgencyLabel,
      statutoryAdvice: assessment.statutoryAdvice,
      suggestedServiceId: assessment.suggestedServiceId,
      leadTimeDays: assessment.leadTimeDays,
    };

    items.push(item);

    switch (assessment.urgency) {
      case RENEWAL_URGENCY.EXPIRED:
        summary.expired += 1;
        summary.actionRequiredCount += 1;
        break;
      case RENEWAL_URGENCY.URGENT:
        summary.urgent += 1;
        summary.actionRequiredCount += 1;
        break;
      case RENEWAL_URGENCY.UPCOMING:
        summary.upcoming += 1;
        summary.actionRequiredCount += 1;
        break;
      case RENEWAL_URGENCY.ADVANCE_NOTICE:
        summary.advanceNotice += 1;
        break;
      case RENEWAL_URGENCY.HEALTHY:
        summary.healthy += 1;
        break;
      default:
        summary.noExpiry += 1;
        break;
    }
  });

  // Sort items: expired first, then urgent, upcoming, advance notice, healthy, no expiry
  const urgencyWeight = {
    [RENEWAL_URGENCY.EXPIRED]: 0,
    [RENEWAL_URGENCY.URGENT]: 1,
    [RENEWAL_URGENCY.UPCOMING]: 2,
    [RENEWAL_URGENCY.ADVANCE_NOTICE]: 3,
    [RENEWAL_URGENCY.HEALTHY]: 4,
    [RENEWAL_URGENCY.NO_EXPIRY]: 5,
  };

  items.sort((a, b) => {
    const weightDiff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    if (weightDiff !== 0) return weightDiff;
    if (a.daysRemaining !== null && b.daysRemaining !== null) {
      return a.daysRemaining - b.daysRemaining;
    }
    return a.documentName.localeCompare(b.documentName);
  });

  return {
    summary,
    items,
    generatedAt: referenceDate.toISOString(),
  };
}

/**
 * Formats a Date or ISO string into an iCalendar YYYYMMDD string.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatIcsDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Escapes special characters for RFC 5545 iCalendar values.
 * @param {string} text
 * @returns {string}
 */
export function escapeIcsText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates an RFC 5545 compliant .ics calendar file containing reminder events.
 * Compatible with Google Calendar, Apple Calendar, and Outlook.
 * @param {Array} digestItems List of items from generateDocumentRenewalDigest
 * @returns {string} iCalendar file text
 */
export function generateRenewalICalendar(digestItems = []) {
  const now = new Date();
  const timestamp = `${formatIcsDate(now)}T000000Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civic Help Setu//Document Renewal Digest//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Civic Document Renewal Reminders',
    'X-WR-TIMEZONE:Asia/Kolkata',
  ];

  const expiringItems = digestItems.filter((item) => item.expiryDate);

  expiringItems.forEach((item, index) => {
    const expDateFormatted = formatIcsDate(item.expiryDate);
    if (!expDateFormatted) return;

    const summary = escapeIcsText(`[Civic Setu] Renew ${item.documentName}`);
    const description = escapeIcsText(
      `${item.documentName} (${item.documentType}) expires on ${item.expiryDate}.\\n\\nStatutory advice: ${item.statutoryAdvice}\\n\\nOrganized locally by Civic Help Setu Document Vault.`
    );
    const uid = `civic-doc-renewal-${item.documentId || index}-${expDateFormatted}@civichelpsetu.local`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART;VALUE=DATE:${expDateFormatted}`);
    lines.push(`DTEND;VALUE=DATE:${expDateFormatted}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:TRANSPARENT');

    // 30 days prior alarm
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Reminder: ${summary} in 30 days`);
    lines.push('TRIGGER:-P30D');
    lines.push('END:VALARM');

    // 7 days prior alarm
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Urgent: ${summary} in 7 days`);
    lines.push('TRIGGER:-P7D');
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export default {
  RENEWAL_URGENCY,
  STATUTORY_RENEWAL_PROFILES,
  getStatutoryProfileForDocument,
  calculateDaysRemaining,
  assessDocumentUrgency,
  generateDocumentRenewalDigest,
  formatIcsDate,
  escapeIcsText,
  generateRenewalICalendar,
};
