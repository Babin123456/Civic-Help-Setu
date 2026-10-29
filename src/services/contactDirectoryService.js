/**
 * Contact Escalation Directory (#266): validates and classifies the official
 * contact channels stored on a service record. Nothing is invented here; a
 * channel only counts as verified when it carries a valid value, a valid
 * official source reference and a recent last-verified date.
 *
 * Contact shape (service.contacts is an optional array of these):
 *   { type, method, value, hours?, sourceUrl, lastVerified }
 */

export const CONTACT_TYPES = [
  { id: 'department', label: 'Responsible department' },
  { id: 'helpdesk', label: 'Helpdesk' },
  { id: 'grievance', label: 'Formal grievance channel' },
];

export const CONTACT_METHODS = [
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'web', label: 'Website' },
];

/** Contacts not re-verified within this many days are flagged for admin review. */
export const CONTACT_EXPIRY_DAYS = 365;

const TYPE_IDS = CONTACT_TYPES.map((t) => t.id);
const METHOD_IDS = CONTACT_METHODS.map((m) => m.id);
const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isPhone = (value) => {
  const text = String(value || '').trim();
  if (!/^\+?[\d\s\-().]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 15;
};

const parseIsoDate = (value) => {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value.trim())) return null;
  const text = value.trim();
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject rolled-over dates such as 2026-02-31.
  return date.toISOString().slice(0, 10) === text ? date : null;
};

/**
 * Validates one contact entry.
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export const validateContact = (contact) => {
  const errors = {};
  const c = contact && typeof contact === 'object' ? contact : {};

  if (!TYPE_IDS.includes(c.type)) errors.type = 'Choose a contact type.';
  if (!METHOD_IDS.includes(c.method)) errors.method = 'Choose phone, email or website.';

  const value = String(c.value || '').trim();
  if (!value) {
    errors.value = 'Contact detail is required.';
  } else if (c.method === 'phone' && !isPhone(value)) {
    errors.value = 'Enter a valid phone number (digits, spaces, +, -, brackets).';
  } else if (c.method === 'email' && !EMAIL_RE.test(value)) {
    errors.value = 'Enter a valid email address.';
  } else if (c.method === 'web' && !isHttpUrl(value)) {
    errors.value = 'Enter a valid http(s) web address.';
  }

  if (!String(c.sourceUrl || '').trim()) {
    errors.sourceUrl = 'An official source reference is required.';
  } else if (!isHttpUrl(c.sourceUrl)) {
    errors.sourceUrl = 'Source reference must be a valid http(s) address.';
  }

  if (!String(c.lastVerified || '').trim()) {
    errors.lastVerified = 'Last-verified date is required.';
  } else if (!parseIsoDate(c.lastVerified)) {
    errors.lastVerified = 'Use a real date in YYYY-MM-DD format.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Builds the tel:/mailto:/https: action for a contact, or null when the value
 * is malformed (so a bad value is never turned into a link).
 */
export const getContactHref = (contact) => {
  if (!contact) return null;
  const value = String(contact.value || '').trim();
  if (contact.method === 'phone' && isPhone(value)) {
    return `tel:${value.replace(/[^\d+]/g, '')}`;
  }
  if (contact.method === 'email' && EMAIL_RE.test(value)) return `mailto:${value}`;
  if (contact.method === 'web' && isHttpUrl(value)) return value;
  return null;
};

/**
 * Classifies one contact.
 * status: 'verified' | 'expired' | 'invalid'
 *  - invalid: fails validation; never shown as verified, flagged for review
 *  - expired: valid but last verified more than CONTACT_EXPIRY_DAYS ago
 *    (or in the future, which cannot be trusted)
 */
export const classifyContact = (contact, now = new Date()) => {
  const { valid, errors } = validateContact(contact);
  if (!valid) return { status: 'invalid', errors, needsReview: true };

  const verifiedOn = parseIsoDate(contact.lastVerified);
  const ageDays = Math.floor((now.getTime() - verifiedOn.getTime()) / 86400000);
  if (ageDays < 0 || ageDays > CONTACT_EXPIRY_DAYS) {
    return { status: 'expired', errors: {}, needsReview: true };
  }
  return { status: 'verified', errors: {}, needsReview: false };
};

/**
 * Normalizes a service's contacts for display. A service can have zero or
 * many channels; non-array or non-object data is ignored.
 * @returns {{ items: Array, hasContacts: boolean, hasVerified: boolean, needsReviewCount: number }}
 */
export const getServiceContacts = (service, now = new Date()) => {
  const raw = Array.isArray(service?.contacts) ? service.contacts : [];
  const items = raw
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const classification = classifyContact(c, now);
      const typeInfo = CONTACT_TYPES.find((t) => t.id === c.type);
      const methodInfo = CONTACT_METHODS.find((m) => m.id === c.method);
      return {
        contact: c,
        typeLabel: typeInfo ? typeInfo.label : 'Contact',
        methodLabel: methodInfo ? methodInfo.label : 'Contact',
        href: classification.status === 'invalid' ? null : getContactHref(c),
        ...classification,
      };
    });

  return {
    items,
    hasContacts: items.length > 0,
    hasVerified: items.some((i) => i.status === 'verified'),
    needsReviewCount: items.filter((i) => i.needsReview).length,
  };
};

/**
 * Validates a list of contacts for the admin form.
 * @returns {{ valid: boolean, errorsByIndex: Array<Record<string,string>> }}
 */
export const validateContacts = (contacts) => {
  const list = Array.isArray(contacts) ? contacts : [];
  const errorsByIndex = list.map((c) => validateContact(c).errors);
  return { valid: errorsByIndex.every((e) => Object.keys(e).length === 0), errorsByIndex };
};
