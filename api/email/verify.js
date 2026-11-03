/* global process */
import { createVerificationToken, verifyToken, markEmailVerified, deleteVerificationTokensForUser, checkResendRateLimit, cleanupExpiredTokens, TOKEN_EXPIRY_HOURS } from '../../src/services/emailVerificationService.js';
import { sendVerificationEmail } from '../../src/services/emailService.js';
import { bearerToken } from '../_lib/firebaseToken.js';
import { createRateLimiter } from '../_lib/abuseGuard.js';
import { verifyToken as verifyClerkToken, createClerkClient } from '@clerk/backend';

const verifyRateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const resendRateLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

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

  if (req.method === 'POST') {
    const address = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const ipVerdict = verifyRateLimiter.take(address);
    if (!ipVerdict.allowed) return tooMany(ipVerdict.retryAfterSeconds);

    const { action, email, token } = req.body || {};

    if (action === 'send') {
      if (!userId) return json(401, { error: 'unauthorized' });
      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(400, { error: 'invalid_email' });
      }

      if (userId) {
        const userVerdict = resendRateLimiter.take(`user:${userId}`);
        if (!userVerdict.allowed) return tooMany(userVerdict.retryAfterSeconds);
      }

      const { token: newToken, expiresAt } = createVerificationToken(email, userId);
      const result = await sendVerificationEmail(email, newToken, userId);

      if (!result.sent) {
        return json(502, { error: 'email_send_failed', reason: result.reason });
      }

      return json(200, {
        sent: true,
        expiresAt,
        expiryHours: TOKEN_EXPIRY_HOURS,
        message: `Verification email sent to ${email}. Link expires in ${TOKEN_EXPIRY_HOURS} hours.`,
      });
    }

    if (action === 'verify') {
      if (!token || typeof token !== 'string') {
        return json(400, { error: 'missing_token' });
      }

      const verification = verifyToken(token);
      if (!verification.valid) {
        return json(400, { error: verification.reason, message: verification.message });
      }

      markEmailVerified(verification.email);
      deleteVerificationTokensForUser(verification.userId);

      return json(200, {
        verified: true,
        email: verification.email,
        message: 'Email verified successfully.',
      });
    }

    if (action === 'resend') {
      if (!userId) return json(401, { error: 'unauthorized' });
      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(400, { error: 'invalid_email' });
      }

      const verdict = checkResendRateLimit(email);
      if (!verdict.allowed) {
        return tooMany(verdict.retryAfterSeconds);
      }

      const { token: newToken, expiresAt } = createVerificationToken(email, userId);
      const result = await sendVerificationEmail(email, newToken, userId);

      if (!result.sent) {
        return json(502, { error: 'email_send_failed', reason: result.reason });
      }

      return json(200, {
        sent: true,
        expiresAt,
        expiryHours: TOKEN_EXPIRY_HOURS,
        message: `Verification email resent to ${email}. Link expires in ${TOKEN_EXPIRY_HOURS} hours.`,
      });
    }

    return json(400, { error: 'invalid_action' });
  }

  if (req.method === 'GET') {
    if (!userId) return json(401, { error: 'unauthorized' });

    cleanupExpiredTokens();
    const pending = await import('../../src/services/emailVerificationService.js').then(m => m.getPendingVerifications());
    const userTokens = pending.filter(t => t.userId === userId && !t.used);

    return json(200, {
      pendingVerifications: userTokens.map(t => ({
        email: t.email,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
      })),
    });
  }

  return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
}