import { createRateLimiter } from '../_lib/abuseGuard.js';
import { createSingleFlight } from '../_lib/abuseGuard.js';

const shareEmailRateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const shareEmailSingleFlight = createSingleFlight();

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

const MOCK_SHARE_LOG = [];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE_MAX_LENGTH = 500;
const MAX_SERVICES_PER_SHARE = 10;

const validateRecipient = (email) => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

const validateNote = (note = '') => {
  if (typeof note !== 'string') return '';
  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX_LENGTH) return null;
  return trimmed;
};

const sanitizePlainText = (value, max = 1000) => {
  if (typeof value !== 'string') return value === null || value === undefined ? '' : String(value);
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  let text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/g, '');
  const TAGS = /<\/?[A-Za-z][^<>]*(?:>|$)/g;
  for (let i = 0; i < 5; i += 1) {
    const next = text.replace(TAGS, '');
    if (next === text) break;
    text = next;
  }
  return text.trim().slice(0, max);
};

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return json(200, { log: MOCK_SHARE_LOG.slice(-50) });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, { Allow: 'POST, GET' });
  }

  const address = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const ipVerdict = shareEmailRateLimiter.take(address);
  if (!ipVerdict.allowed) return tooMany(ipVerdict.retryAfterSeconds);

  const { to, serviceIds, note, senderEmail } = req.body || {};

  const recipient = validateRecipient(to);
  if (!recipient) {
    return json(400, { error: 'invalid_recipient' });
  }

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return json(400, { error: 'no_services' });
  }

  if (serviceIds.length > MAX_SERVICES_PER_SHARE) {
    return json(400, { error: 'too_many_services' });
  }

  for (const id of serviceIds) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return json(400, { error: 'invalid_service_id' });
    }
  }

  const validatedNote = validateNote(note);
  if (validatedNote === null) {
    return json(400, { error: 'note_too_long' });
  }

  const safeSenderEmail = typeof senderEmail === 'string' ? sanitizePlainText(senderEmail.trim()) : '';

  const key = `share:${recipient}:${JSON.stringify(serviceIds.sort())}`;
  const result = await shareEmailSingleFlight.run(key, async () => {
    const logEntry = {
      id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: recipient,
      serviceIds,
      note: sanitizePlainText(validatedNote),
      senderEmail: safeSenderEmail,
      serviceCount: serviceIds.length,
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    MOCK_SHARE_LOG.push(logEntry);
    if (MOCK_SHARE_LOG.length > 500) MOCK_SHARE_LOG.shift();

    console.log(`[MOCK SHARE EMAIL] To: ${recipient}, Services: ${serviceIds.length}`, {
      note: validatedNote,
      senderEmail: safeSenderEmail,
    });

    return json(200, {
      messageId: logEntry.id,
      message: 'Service share email queued for delivery (mock)',
      serviceCount: serviceIds.length,
    });
  });

  return result;
}
