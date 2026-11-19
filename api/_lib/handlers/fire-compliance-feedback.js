import { createRateLimiter } from '../abuseGuard.js';

const feedbackRateLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

const MOCK_FIRE_FEEDBACK_STORE = [];

const PII_PATTERNS = [
  /\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g, // Aadhaar 12-digit
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, // PAN
  /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, // Indian mobile
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g // Email
];

export const sanitizeAndRedactText = (text, maxLength = 1000) => {
  if (typeof text !== 'string') return '';
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  let cleaned = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').trim();

  // Strip HTML tags
  cleaned = cleaned.replace(/<\/?[A-Za-z][^<>]*(?:>|$)/g, '');

  // Redact PII
  for (const pattern of PII_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }

  return cleaned.slice(0, maxLength);
};

export default async function route(req, res) {
  if (res?.setHeader) {
    res.setHeader('Cache-Control', 'no-store');
  }

  if (req.method === 'GET') {
    return json(200, {
      totalSubmissions: MOCK_FIRE_FEEDBACK_STORE.length,
      recentSubmissions: MOCK_FIRE_FEEDBACK_STORE.slice(-20)
    });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, { Allow: 'POST, GET' });
  }

  const clientIp = req.headers?.['x-vercel-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const rateVerdict = feedbackRateLimiter.take(clientIp);
  if (!rateVerdict.allowed) {
    return tooMany(rateVerdict.retryAfterSeconds);
  }

  const { jurisdictionKey, officialGazetteOrSourceUrl, submissionNotes, proposedAuthorityName } = req.body || {};

  if (!jurisdictionKey || typeof jurisdictionKey !== 'string' || jurisdictionKey.trim().length === 0) {
    return json(400, { error: 'missing_jurisdiction', message: 'Valid jurisdiction key is mandatory.' });
  }

  if (!officialGazetteOrSourceUrl || typeof officialGazetteOrSourceUrl !== 'string') {
    return json(400, { error: 'missing_source_url', message: 'Verifiable official source or gazette URL is mandatory.' });
  }

  try {
    const url = new URL(officialGazetteOrSourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return json(400, { error: 'invalid_source_protocol', message: 'Official source URL must be HTTP or HTTPS.' });
    }
  } catch {
    return json(400, { error: 'malformed_source_url', message: 'Official source URL format is invalid.' });
  }

  const sanitizedNotes = sanitizeAndRedactText(submissionNotes || '', 1000);
  const sanitizedAuthority = sanitizeAndRedactText(proposedAuthorityName || '', 150);

  const entry = {
    id: `fire_fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    jurisdictionKey: jurisdictionKey.trim().toUpperCase(),
    officialGazetteOrSourceUrl: officialGazetteOrSourceUrl.trim(),
    proposedAuthorityName: sanitizedAuthority || null,
    submissionNotes: sanitizedNotes,
    status: 'PENDING_ADMIN_REVIEW',
    createdAt: new Date().toISOString()
  };

  MOCK_FIRE_FEEDBACK_STORE.push(entry);
  if (MOCK_FIRE_FEEDBACK_STORE.length > 500) {
    MOCK_FIRE_FEEDBACK_STORE.shift();
  }

  return json(201, {
    success: true,
    submissionId: entry.id,
    message: 'Community fire compliance correction received and queued for administrative review.'
  });
}
