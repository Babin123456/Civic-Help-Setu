/* global process */
import { getProductionFeedbackPipeline } from '../feedbackPipeline.js';
import { authorizeToiletModerator } from '../toiletModerator.js';
import { bearerToken } from '../firebaseToken.js';
import { getHeader } from '../requestSecurity.js';

async function intakeIdentity(req) {
  if (getHeader(req.headers, 'authorization')) {
    const token = bearerToken(req.headers);
    if (!token) return { status: 401 };
    if (!process.env.CLERK_SECRET_KEY) return { status: 503 };
    const { verifyToken } = await import('@clerk/backend');
    try {
      const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      return typeof claims.sub === 'string' && claims.sub ? { id: `user:${claims.sub}` } : { status: 401 };
    } catch { return { status: 401 }; }
  }
  // Vercel overwrites this header. Other deployments MUST strip incoming forwarded headers at their trusted ingress.
  const forwarded = getHeader(req.headers, 'x-forwarded-for');
  const address = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
  return address ? { id: `network:${address}` } : { status: 503 };
}

export function createFeedbackHandler({ getPipeline = getProductionFeedbackPipeline,
  authorizeModerator = authorizeToiletModerator, identify = intakeIdentity } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const view = req.query?.view || 'metrics';
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH'); return res.status(405).json({ error: 'method_not_allowed' });
    }
    try {
      if (req.method === 'PATCH' || (req.method === 'GET' && view !== 'metrics')) {
        const actor = await authorizeModerator(req);
        if (!actor?.userId || actor.status) return res.status(actor?.status || 403).json({ error: 'moderation_access_denied' });
        const pipeline = await getPipeline();
        if (req.method === 'PATCH') {
          const { id, ...decision } = req.body || {};
          return res.status(200).json(await pipeline.review(id, decision, actor.userId));
        }
        if (view === 'attachment') return res.status(200).json(await pipeline.attachmentUrl(req.query?.id));
        if (view === 'audit') return res.status(200).json(await pipeline.audit(req.query?.id));
        if (view !== 'moderation') return res.status(400).json({ error: 'invalid_query' });
        return res.status(200).json(await pipeline.list({ queue: req.query?.queue, status: req.query?.status,
          cursor: req.query?.cursor, limit: req.query?.limit === undefined ? 30 : Number(req.query.limit) }));
      }
      if (req.method === 'GET') return res.status(200).json(await (await getPipeline()).publicMetrics());
      if (req.body?.website_trap) return res.status(400).json({ error: 'invalid_feedback' });
      const identity = await identify(req);
      if (!identity?.id || identity.status) return res.status(identity?.status || 503).json({ error: 'intake_identity_unavailable' });
      const receipt = await (await getPipeline()).submit(req.body, getHeader(req.headers, 'idempotency-key'), identity.id);
      return res.status(201).json(receipt);
    } catch (error) {
      const status = { invalid_feedback: 400, invalid_attachment: 400, invalid_idempotency_key: 400,
        invalid_query: 400, invalid_cursor: 400, invalid_review: 400, not_found: 404,
        idempotency_conflict: 409, review_conflict: 409, attachment_quarantined: 423, rate_limited: 429 }[error.code] || 503;
      if (status === 429) res.setHeader('Retry-After', '60');
      return res.status(status).json({ error: status === 503 ? 'feedback_unavailable' : error.code });
    }
  };
}
export default createFeedbackHandler();
