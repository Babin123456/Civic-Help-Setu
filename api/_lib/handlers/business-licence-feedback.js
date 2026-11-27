import { createRateLimiter } from '../abuseGuard.js';

const feedbackRateLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

const MOCK_BUSINESS_FEEDBACK_STORE = [];

export const _resetFeedbackStore = () => {
  MOCK_BUSINESS_FEEDBACK_STORE.length = 0;
};

const PII_PATTERNS = [
  /\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g, // Aadhaar 12-digit
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, // PAN
  /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g, // GSTIN
  /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, // Indian mobile
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g // Email
];

export const sanitizeAndRedactText = (text, maxLength = 1000) => {
  if (typeof text !== 'string') return '';
  // Strip control characters
  // eslint-disable-next-line no-control-regex
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
      totalSubmissions: MOCK_BUSINESS_FEEDBACK_STORE.length,
      recentSubmissions: MOCK_BUSINESS_FEEDBACK_STORE.slice(-20)
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

  const { jurisdictionKey, licenceKey, stage, officialGazetteOrSourceUrl, submissionNotes } = req.body || {};

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

  const validStages = ['RENEWAL', 'AMENDMENT', 'SUSPENSION', 'CLOSURE', 'GENERAL'];
  const sanitizedStage = validStages.includes(stage) ? stage : 'GENERAL';
  const sanitizedNotes = sanitizeAndRedactText(submissionNotes || '', 1000);

  const entry = {
    id: `biz_fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    jurisdictionKey: jurisdictionKey.trim(),
    licenceKey: typeof licenceKey === 'string' ? licenceKey.trim() : 'ALL',
    stage: sanitizedStage,
    officialGazetteOrSourceUrl: officialGazetteOrSourceUrl.trim(),
    submissionNotes: sanitizedNotes,
    status: 'PENDING_ADMIN_REVIEW',
    clientIpMasked: clientIp.replace(/\.\d+$/, '.xxx'),
    submittedAt: new Date().toISOString()
  };

  MOCK_BUSINESS_FEEDBACK_STORE.push(entry);

  return json(200, {
    success: true,
    submissionId: entry.id,
    status: entry.status,
    message: 'Proposal submitted successfully for administrator verification.'
  });
}

