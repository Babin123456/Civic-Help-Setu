import { getFirestoreAdmin } from '../firebaseAdmin.js';
import { authorizeToiletModerator } from '../toiletModerator.js';
import { findTransitRecord } from '../../../src/data/transitConcessions.js';
import { createRateLimiter } from '../abuseGuard.js';

const limiter = createRateLimiter({ limit: 6, windowMs: 60 * 1000 });
const PII_PATTERNS = [
  /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i,
  /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/,
];

const cleanText = (value, limit) => {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, limit);
};

const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function isOfficialUrl(urlValue, record) {
  if (typeof urlValue !== 'string') return false;
  try {
    const url = new URL(urlValue);
    const officialHost = new URL(record.sourceUrl).hostname.toLowerCase();
    return url.protocol === 'https:' &&
      (url.hostname.toLowerCase() === officialHost || url.hostname.toLowerCase().endsWith(`.${officialHost}`));
  } catch {
    return false;
  }
}

export function validateTransitCorrection(body, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  if (body.website_trap) errors.push('Automated submission detected.');

  const record = findTransitRecord(body.recordId);
  if (!record || record.mode !== body.mode) errors.push('Select a listed operator and its transport type.');

  const proposedChange = cleanText(body.proposedChange, 1200);
  if (proposedChange.length < 10) errors.push('Correction must be between 10 and 1200 characters.');

  if (record && !isOfficialUrl(body.officialSourceUrl, record)) {
    errors.push('Source URL must use HTTPS and belong to the selected operator’s official website.');
  }
  if (!validDate(body.sourceDate) || body.sourceDate > today) {
    errors.push('A valid official source publication date is required.');
  }
  if (body.effectiveDate && !validDate(body.effectiveDate)) errors.push('Effective date must be a valid calendar date.');

  const submittedText = `${proposedChange}\n${typeof body.officialSourceUrl === 'string' ? body.officialSourceUrl : ''}`;
  if (PII_PATTERNS.some((pattern) => pattern.test(submittedText))) {
    errors.push('Personal identifiers and phone numbers are not accepted.');
  }

  const allowedFields = new Set([
    'recordId', 'mode', 'proposedChange', 'officialSourceUrl', 'sourceDate',
    'effectiveDate', 'website_trap',
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    errors.push('Unexpected submission fields are not accepted.');
  }
  return errors;
}

export function createTransitConcessionsHandler({
  getDatabase = getFirestoreAdmin,
  authorizeModerator = authorizeToiletModerator,
  now = () => new Date(),
  rateLimiter = limiter,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET' && req.query?.view === 'moderation') {
      let actor;
      try {
        actor = await authorizeModerator(req);
      } catch {
        return res.status(503).json({ error: 'moderation_access_unavailable' });
      }
      if (actor.status || !actor.userId) return res.status(actor.status || 403).json({ error: 'moderation_access_denied' });
      try {
        const db = await getDatabase();
        if (!db) return res.status(503).json({ error: 'storage_unavailable' });
        const snapshot = await db.collection('transitConcessionCorrections')
          .where('status', '==', 'pending_review')
          .get();
        const items = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
          .slice(0, 50);
        return res.status(200).json({ items });
      } catch {
        return res.status(503).json({ error: 'storage_unavailable' });
      }
    }

    if (req.method === 'PATCH') {
      let actor;
      try {
        actor = await authorizeModerator(req);
      } catch {
        return res.status(503).json({ error: 'moderation_access_unavailable' });
      }
      if (actor.status || !actor.userId) return res.status(actor.status || 403).json({ error: 'moderation_access_denied' });
      const { id, decision } = req.body || {};
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !['approved', 'dismissed'].includes(decision)) {
        return res.status(400).json({ error: 'invalid_review' });
      }
      try {
        const db = await getDatabase();
        if (!db) return res.status(503).json({ error: 'storage_unavailable' });
        const reference = db.collection('transitConcessionCorrections').doc(id);
        const result = await db.runTransaction(async (transaction) => {
          const item = await transaction.get(reference);
          if (!item.exists) return 'not_found';
          if (item.data().status !== 'pending_review') return 'review_conflict';
          transaction.update(reference, {
            status: decision,
            reviewedAt: now().toISOString(),
            reviewedBy: actor.userId,
          });
          return 'ok';
        });
        if (result === 'not_found') return res.status(404).json({ error: 'not_found' });
        if (result === 'review_conflict') return res.status(409).json({ error: 'review_conflict' });
        return res.status(200).json({ ok: true, status: decision });
      } catch {
        return res.status(503).json({ error: 'storage_unavailable' });
      }
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, GET, PATCH');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const rate = rateLimiter.take(ip);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({ error: 'rate_limited' });
    }

    const errors = validateTransitCorrection(req.body, now().toISOString().slice(0, 10));
    if (errors.length) return res.status(400).json({ error: 'validation_failed', details: errors });

    try {
      const db = await getDatabase();
      if (!db) return res.status(503).json({ error: 'storage_unavailable' });
      const record = findTransitRecord(req.body.recordId);
      const submittedAt = now().toISOString();
      const reference = db.collection('transitConcessionCorrections').doc();
      await reference.create({
        recordId: record.id,
        mode: record.mode,
        proposedChange: cleanText(req.body.proposedChange, 1200),
        officialSourceUrl: req.body.officialSourceUrl,
        sourceDate: req.body.sourceDate,
        effectiveDate: req.body.effectiveDate || null,
        authority: record.authority,
        jurisdiction: record.jurisdiction,
        submittedAt,
        status: 'pending_review',
      });
      return res.status(201).json({ ok: true, submittedAt });
    } catch {
      return res.status(503).json({ error: 'storage_unavailable' });
    }
  };
}

export default createTransitConcessionsHandler();
