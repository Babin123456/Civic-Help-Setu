/**
 * shareService.js
 *
 * Share-by-email flow for one service or a selected list of saved services.
 *
 * Privacy & Safety Guarantees:
 * - Only catalogue data (name, description, official link, verification date) is included.
 * - Sender's saved-service history, profile details, and private notes are NEVER included.
 * - Archived/unpublished services are excluded from the share.
 * - Recipient email is validated; note has a length limit.
 * - All dynamic text is sanitized before being placed in the email.
 */

import { sendServiceShareEmail } from './emailService';
import { getAllServices } from './serviceCatalog';
import { sanitizePlainText, safeHttpUrl } from '../utils/safeContent';
import { logDiagnostic } from '../utils/diagnostics';

export const SHARE_NOTE_MAX_LENGTH = 500;
export const MAX_SERVICES_PER_SHARE = 10;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a recipient email address.
 * @returns {string | null} The normalized email, or null if invalid.
 */
export const validateRecipient = (email) => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

/**
 * Validates and trims an optional sender note, enforcing the length limit.
 * @returns {string | null} The trimmed note, or null if it exceeds the limit.
 */
export const validateNote = (note = '') => {
  if (typeof note !== 'string') return '';
  const trimmed = note.trim();
  if (trimmed.length > SHARE_NOTE_MAX_LENGTH) return null;
  return trimmed;
};

/**
 * Resolves service IDs into shareable service records.
 * Skips archived/unpublished services and services that cannot be found.
 * @returns {Object[]} Array of { id, name, description, officialLink, verifiedAt }
 */
export const resolveShareableServices = (serviceIds = []) => {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) return [];
  if (serviceIds.length > MAX_SERVICES_PER_SHARE) {
    return [];
  }

  const all = getAllServices({ includeArchived: false });
  const byId = new Map(all.map((s) => [s.id, s]));

  const results = [];
  const seen = new Set();

  for (const id of serviceIds) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);

    const service = byId.get(id);
    if (!service) continue;
    if (service.archived === true) continue;

    const officialSource = Array.isArray(service.officialSources) && service.officialSources.length > 0
      ? service.officialSources[0]
      : null;
    const officialLink = officialSource ? safeHttpUrl(officialSource.url) : '';

    results.push({
      id: service.id,
      name: sanitizePlainText(service.name),
      description: sanitizePlainText(service.shortDescription || service.description || ''),
      officialLink,
      verifiedAt: typeof service.lastVerified === 'string' ? service.lastVerified : '',
    });
  }

  return results;
};

/**
 * Builds the email data payload for the service_share template.
 * Excludes all sender profile / saved-service history data.
 * @returns {{ to, subject, services, note, senderEmail }} or null on validation failure
 */
export const buildSharePayload = ({ to, serviceIds, note = '', senderEmail = '' }) => {
  const recipient = validateRecipient(to);
  if (!recipient) return { ok: false, error: 'invalid_recipient' };

  const validatedNote = validateNote(note);
  if (validatedNote === null) return { ok: false, error: 'note_too_long' };

  const services = resolveShareableServices(serviceIds);
  if (services.length === 0) return { ok: false, error: 'no_services' };

  return {
    ok: true,
    to: recipient,
    subject: 'Civic services shared with you',
    services,
    note: sanitizePlainText(validatedNote),
    senderEmail: typeof senderEmail === 'string' ? sanitizePlainText(senderEmail.trim()) : '',
  };
};

/**
 * Sends a service share email. Validates inputs, builds the payload,
 * and sends via the shared email service. Sender profile data is never included.
 *
 * @returns {Promise<{ ok, error?, sent?, reason? }>}
 */
export const sendServiceShare = async ({ to, serviceIds, note = '', senderEmail = '', userId }) => {
  const payload = buildSharePayload({ to, serviceIds, note, senderEmail });
  if (!payload.ok) return { ok: false, error: payload.error };

  try {
    const result = await sendServiceShareEmail(payload.to, {
      subject: payload.subject,
      services: payload.services,
      note: payload.note,
      senderEmail: payload.senderEmail,
    }, userId);

    if (!result.sent) {
      logDiagnostic('Service share email failed', { to: payload.to, reason: result.reason });
      return { ok: false, error: result.reason || 'send_failed' };
    }

    return { ok: true, sent: true, messageId: result.messageId };
  } catch (err) {
    logDiagnostic('Service share email error', err);
    return { ok: false, error: 'network_error' };
  }
};

export default {
  validateRecipient,
  validateNote,
  resolveShareableServices,
  buildSharePayload,
  sendServiceShare,
  SHARE_NOTE_MAX_LENGTH,
  MAX_SERVICES_PER_SHARE,
};
