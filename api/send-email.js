/* global process */
import { bearerToken } from '../_lib/firebaseToken.js';
import { createRateLimiter } from '../_lib/abuseGuard.js';
import { verifyToken as verifyClerkToken, createClerkClient } from '@clerk/backend';

const emailSendRateLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });

let clerkClient;

async function getClerkClient() {
  if (!clerkClient && process.env.CLERK_SECRET_KEY) {
    clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }
  return clerkClient;
}

async function getUserIdFromSession(sessionToken) {
  if (!sessionToken) return null;
  try {
    const clerk = await getClerkClient();
    if (!clerk) return null;
    const claims = await verifyClerkToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY });
    return claims.sub;
  } catch {
    return null;
  }
}

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

const MOCK_EMAIL_LOG = [];

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return json(200, { log: MOCK_EMAIL_LOG.slice(-50) });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, { Allow: 'POST, GET' });
  }

  const address = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const ipVerdict = emailSendRateLimiter.take(address);
  if (!ipVerdict.allowed) return tooMany(ipVerdict.retryAfterSeconds);

  const { to, template, data } = req.body || {};

  if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return json(400, { error: 'invalid_recipient' });
  }

  if (!template || typeof template !== 'string') {
    return json(400, { error: 'missing_template' });
  }

  const logEntry = {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to,
    template,
    data,
    timestamp: new Date().toISOString(),
    status: 'sent',
  };

  MOCK_EMAIL_LOG.push(logEntry);
  if (MOCK_EMAIL_LOG.length > 500) MOCK_EMAIL_LOG.shift();

  console.log(`[MOCK EMAIL] To: ${to}, Template: ${template}`, data);

  return json(200, { messageId: logEntry.id, message: 'Email queued for delivery (mock)' });
}