/* global process, Buffer */
import { createHash } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getFirebaseAdminApp, getFirestoreAdmin } from './firebaseAdmin.js';
import { privacyIdentifier } from './abuseControlPlane.js';
import { FEEDBACK_CATEGORIES, scrubPII } from '../../src/services/bottleneckFeedbackContract.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const categories = FEEDBACK_CATEGORIES.map(category => category.id);
const statuses = ['reviewed', 'addressed', 'dismissed'];
const DAY = 86_400_000;
export const MAX_FEEDBACK_ATTACHMENT_BYTES = 256 * 1024;
export class FeedbackError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new FeedbackError(code); };

export function normalizeFeedback(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') fail('invalid_feedback');
  if (typeof body.serviceId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(body.serviceId)
    || !categories.includes(body.category) || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5
    || (body.stepIndex != null && (!Number.isInteger(body.stepIndex) || body.stepIndex < 0 || body.stepIndex > 999))) fail('invalid_feedback');
  for (const [field, limit] of [['serviceName', 200], ['stepTitle', 200], ['notes', 1500]]) {
    if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > limit)) fail('invalid_feedback');
  }
  const clean = Object.fromEntries(['serviceName', 'stepTitle', 'notes'].map(field => [field, scrubPII(body[field] || '')]));
  let attachment = null;
  if (body.attachment != null) {
    const { base64, contentType } = body.attachment;
    if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX_FEEDBACK_ATTACHMENT_BYTES / 3) * 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
      || !['image/png', 'image/jpeg', 'application/pdf'].includes(contentType)) fail('invalid_attachment');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > MAX_FEEDBACK_ATTACHMENT_BYTES) fail('invalid_attachment');
    // MIME labels are not a malware verdict. All bytes remain quarantined until a trusted scanner accepts this exact generation.
    attachment = { bytes, contentType, sha256: hash(bytes), size: bytes.length };
  }
  return {
    data: { serviceId: body.serviceId, serviceName: clean.serviceName.text || body.serviceId,
      stepIndex: body.stepIndex ?? null, stepTitle: clean.stepTitle.text || null, category: body.category,
      rating: body.rating, notes: clean.notes.text, piiDetected: Object.values(clean).some(field => field.piiDetected) },
    attachment,
  };
}

/** One durable queue in the existing bottleneckFeedback collection, not a second feedback domain. */
export class FirestoreFeedbackPipeline {
  constructor(db, { bucket = null, secret, now = Date.now, limit = 20, windowMs = 60_000, slaMs = DAY } = {}) {
    if (!secret || secret.length < 32) fail('feedback_configuration_unavailable');
    if (![limit, windowMs, slaMs].every(value => Number.isSafeInteger(value) && value > 0)) fail('feedback_configuration_unavailable');
    Object.assign(this, { db, bucket, secret, now, limit, windowMs, slaMs });
  }

  async submit(body, key, identifier) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) fail('invalid_idempotency_key');
    if (typeof identifier !== 'string' || !identifier || identifier.length > 512) fail('invalid_identifier');
    const { data, attachment } = normalizeFeedback(body);
    const actor = privacyIdentifier(identifier, this.secret);
    const id = hash(`${actor}:${key}`);
    const payloadHash = hash(JSON.stringify({ ...data, attachment: attachment && { sha256: attachment.sha256, contentType: attachment.contentType } }));
    const ref = this.db.collection('bottleneckFeedback').doc(id);
    // Storage never receives bytes until quota/idempotency reservation commits. Crash recovery uses the same immutable object path.
    const at = this.now(), window = Math.floor(at / this.windowMs);
    const quota = this.db.collection('abuseControlQuotas').doc(`feedback_${actor}_${window}`);
    const result = await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data().payloadHash !== payloadHash) fail('idempotency_conflict');
        return existing.data();
      }
      const counter = await tx.get(quota), count = counter.exists ? counter.data().count : 0;
      if (count >= this.limit) fail('rate_limited');
      const abuseScore = Math.min(100, (data.piiDetected ? 20 : 0) + Math.min(60, count * 10) + ((data.notes.match(/https?:\/\//g) || []).length > 3 ? 40 : 0));
      const entry = { ...data, id, schemaVersion: 2, payloadHash, status: 'pending', revision: 0,
        queue: abuseScore >= 60 ? 'suspected_spam' : 'standard', abuseScore, createdAt: at, dueAt: at + this.slaMs,
        feedbackType: 'platform_improvement', adminNotes: '', reviewedBy: null, reviewedAt: null,
        attachment: attachment ? { state: 'upload_pending', object: `feedback-quarantine/${id}/${attachment.sha256}`,
          sha256: attachment.sha256, size: attachment.size, contentType: attachment.contentType } : null };
      tx.set(quota, { count: count + 1, expiresAt: new Date((window + 2) * this.windowMs) });
      tx.create(ref, entry);
      return entry;
    });
    if (attachment && result.attachment.state === 'upload_pending') {
      if (!this.bucket) fail('attachment_storage_unavailable');
      const file = this.bucket.file(result.attachment.object);
      try {
        await file.save(attachment.bytes, { resumable: false, contentType: attachment.contentType,
          preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: 'private, no-store' } });
      } catch (error) { if (Number(error.code) !== 412) throw error; }
      const [metadata] = await file.getMetadata();
      await this.db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current.attachment.state === 'upload_pending') tx.update(ref, {
          attachment: { ...current.attachment, state: 'quarantined', generation: String(metadata.generation) },
        });
      });
    }
    return { id, status: result.status, attachmentState: attachment ? (await ref.get()).data().attachment.state : null };
  }

  async list({ queue = 'standard', status = 'pending', cursor, limit = 30 } = {}) {
    if (!['standard', 'suspected_spam'].includes(queue) || !['pending', ...statuses].includes(status)
      || !Number.isInteger(limit) || limit < 1 || limit > 50) fail('invalid_query');
    let query = this.db.collection('bottleneckFeedback').where('queue', '==', queue)
      .where('status', '==', status)
      .orderBy('createdAt', 'asc').orderBy(FieldPath.documentId(), 'asc');
    if (cursor) {
      if (!/^\d{1,16}_[a-f0-9]{64}$/.test(cursor)) fail('invalid_cursor');
      const [at, id] = cursor.split('_'); query = query.startAfter(Number(at), id);
    }
    const snapshot = await query.limit(limit + 1).get();
    const rows = snapshot.docs.slice(0, limit).map(doc => doc.data());
    return { items: rows.map(row => { const safe = { ...row }; delete safe.payloadHash; return { ...safe, overdue: row.status === 'pending' && row.dueAt <= this.now() }; }),
      nextCursor: snapshot.size > limit && rows.length ? `${rows.at(-1).createdAt}_${rows.at(-1).id}` : null,
      scope: 'oldest-first bounded page; spam queue isolated', slaMs: this.slaMs };
  }

  async review(id, { status, revision, notes = '' }, actor) {
    if (!/^[a-f0-9]{64}$/.test(id) || !statuses.includes(status) || !Number.isSafeInteger(revision)
      || typeof notes !== 'string' || notes.length > 1500 || typeof actor !== 'string' || !actor) fail('invalid_review');
    const ref = this.db.collection('bottleneckFeedback').doc(id);
    return this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) fail('not_found');
      const old = snap.data();
      if (old.revision !== revision) fail('review_conflict');
      const patch = { status, revision: revision + 1, adminNotes: scrubPII(notes).text, reviewedBy: actor, reviewedAt: this.now() };
      // Only an explicit addressed decision releases categorical statistics. Replays/concurrent decisions cannot double-count.
      if (old.status === 'addressed' || status === 'addressed') {
        const day = new Date(old.createdAt).toISOString().slice(0, 10), shard = parseInt(id.slice(0, 2), 16) % 32;
        const aggregate = this.db.collection('bottleneckFeedbackAggregates').doc(`${day}_${shard}`);
        const previous = await tx.get(aggregate), counts = { ...(previous.data()?.counts || {}) };
        const delta = (status === 'addressed' ? 1 : 0) - (old.status === 'addressed' ? 1 : 0);
        const cell = `${old.category}_${old.rating}`; counts[cell] = (counts[cell] || 0) + delta;
        tx.set(aggregate, { day, counts });
      }
      tx.create(ref.collection('audit').doc(String(patch.revision)), { ...patch, previousStatus: old.status, previousRevision: revision, at: patch.reviewedAt });
      tx.update(ref, patch);
      return { id, ...patch };
    });
  }

  async publicMetrics() {
    const since = new Date(this.now() - 6 * DAY).toISOString().slice(0, 10);
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const snapshot = await this.db.collection('bottleneckFeedbackAggregates').where('day', '>=', since).where('day', '<=', today).limit(7 * 32).get();
    const counts = {};
    for (const doc of snapshot.docs) for (const [cell, count] of Object.entries(doc.data().counts)) counts[cell] = (counts[cell] || 0) + count;
    // Suppress every small cell AND its contribution to totals to prevent subtraction from revealing a suppressed cell.
    const categoryCounts = Object.fromEntries(categories.map(category => [category, 0]));
    let totalReports = 0, score = 0;
    for (const [cell, count] of Object.entries(counts)) {
      const category = cell.slice(0, -2), rating = Number(cell.at(-1));
      if (category in categoryCounts && count >= 5) {
        const rounded = Math.floor(count / 5) * 5;
        categoryCounts[category] += rounded; totalReports += rounded; score += rounded * rating;
      }
    }
    return { totalReports, categoryCounts, averageFrictionScore: totalReports ? Math.round(score / totalReports * 2) / 2 : 0,
      stepBreakdown: [], severityDistribution: {}, pendingCount: null, reviewedCount: null,
      privacy: '7-day addressed-only cells, minimum 5 and rounded down to 5; suppressed cells excluded from totals' };
  }

  /** Trusted worker only, never a citizen/moderator HTTP mutation. Verdict binds immutable bytes and object generation. */
  async recordScan(id, { sha256, generation, verdict, scanner }) {
    if (!/^[a-f0-9]{64}$/.test(id) || !['clean', 'rejected'].includes(verdict)
      || typeof scanner !== 'string' || !scanner || scanner.length > 100) fail('invalid_scan');
    const ref = this.db.collection('bottleneckFeedback').doc(id);
    await this.db.runTransaction(async tx => {
      const snap = await tx.get(ref), attachment = snap.data()?.attachment;
      if (!attachment || attachment.sha256 !== sha256 || attachment.generation !== String(generation)
        || !['quarantined', 'clean', 'rejected'].includes(attachment.state)
        || (attachment.state === 'rejected' && verdict === 'clean')) fail('scan_conflict');
      if (attachment.state === verdict) return;
      tx.update(ref, { attachment: { ...attachment, state: verdict, scanner, scannedAt: this.now() } });
      tx.create(ref.collection('audit').doc(`scan_${generation}_${verdict}`), { verdict, scanner, sha256, generation: String(generation), at: this.now() });
    });
  }

  async attachmentUrl(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) fail('invalid_query');
    const attachment = (await this.db.collection('bottleneckFeedback').doc(id).get()).data()?.attachment;
    if (!attachment || attachment.state !== 'clean') fail('attachment_quarantined');
    if (!this.bucket) fail('attachment_storage_unavailable');
    const [url] = await this.bucket.file(attachment.object, { generation: attachment.generation }).getSignedUrl({
      action: 'read', expires: this.now() + 60_000, responseDisposition: 'attachment; filename="feedback-attachment"',
    });
    return { url, expiresInSeconds: 60 };
  }

  async audit(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) fail('invalid_query');
    const snapshot = await this.db.collection('bottleneckFeedback').doc(id).collection('audit').orderBy('at', 'desc').limit(50).get();
    return { items: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  }
}

export async function getProductionFeedbackPipeline() {
  const db = await getFirestoreAdmin();
  if (!db) fail('feedback_configuration_unavailable');
  const bucket = process.env.FEEDBACK_QUARANTINE_BUCKET
    ? getStorage(await getFirebaseAdminApp()).bucket(process.env.FEEDBACK_QUARANTINE_BUCKET) : null;
  return new FirestoreFeedbackPipeline(db, { bucket, secret: process.env.ABUSE_CONTROL_SECRET,
    limit: Number(process.env.FEEDBACK_PER_MINUTE || 20), slaMs: Number(process.env.FEEDBACK_SLA_HOURS || 24) * 3_600_000 });
}
