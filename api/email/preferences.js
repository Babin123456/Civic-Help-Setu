/* global process */
import { getNotificationPreferences, saveNotificationPreferences, validatePreferences, getCategoryChoices } from '../../src/services/notificationPreferenceService.js';
import { bearerToken } from '../_lib/firebaseToken.js';
import { createRateLimiter } from '../_lib/abuseGuard.js';
import { verifyToken as verifyClerkToken, createClerkClient } from '@clerk/backend';

const preferenceRateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

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

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sessionToken = bearerToken(req.headers);
  const userId = await getUserIdFromSession(sessionToken);

  if (!userId) {
    return json(401, { error: 'unauthorized' });
  }

  const address = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const ipVerdict = preferenceRateLimiter.take(address);
  if (!ipVerdict.allowed) return tooMany(ipVerdict.retryAfterSeconds);

  if (req.method === 'GET') {
    const preferences = getNotificationPreferences(userId);
    const categories = getCategoryChoices();

    return json(200, {
      preferences,
      categories,
      essentialCategories: categories.filter(c => c.essential).map(c => c.id),
      optionalCategories: categories.filter(c => !c.essential).map(c => c.id),
    });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const { preferences } = req.body || {};

    if (!preferences || typeof preferences !== 'object') {
      return json(400, { error: 'invalid_preferences' });
    }

    try {
      const validated = validatePreferences(preferences);
      const saved = saveNotificationPreferences(userId, validated);

      return json(200, {
        preferences: saved,
        message: 'Notification preferences updated.',
      });
    } catch (err) {
      return json(400, { error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'reset') {
      const defaults = saveNotificationPreferences(userId, {});
      return json(200, {
        preferences: defaults,
        message: 'Notification preferences reset to defaults.',
      });
    }

    return json(400, { error: 'invalid_action' });
  }

  return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, PATCH, PUT, POST' });
}