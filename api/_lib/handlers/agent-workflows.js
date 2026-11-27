/* global process */
import { createWorkflowApiHandler } from '../workflowApi.js';
import { createRateLimiter } from '../abuseGuard.js';
import { applyEvent } from '../../../src/workflows/durableWorkflowEngine.js';
import { createCivicWorkflowAdapter, createGroundedLocalProvider } from '../../../src/workflows/providerAdapter.js';
import { MOCK_SERVICES } from '../../../src/data/services.js';

let handler;

function createFirestoreWorkflowStore(firestore) {
  const workflowsCol = firestore.collection('agentWorkflows');
  const dlqCol = firestore.collection('agentWorkflowDeadLetters');

  return {
    async findByStartIdempotencyKey(ownerId, idempotencyKey) {
      const snap = await workflowsCol
        .where('ownerId', '==', ownerId)
        .where('startIdempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();
      return snap.empty ? null : snap.docs[0].data();
    },

    async createWorkflow(state, startEvent) {
      const ref = workflowsCol.doc(state.workflowId);
      await firestore.runTransaction(async (tx) => {
        tx.create(ref, { ...state, startIdempotencyKey: startEvent.idempotencyKey });
        tx.create(ref.collection('events').doc(String(startEvent.sequence)), startEvent);
        tx.create(ref.collection('idempotency').doc(startEvent.idempotencyKey), { sequence: startEvent.sequence });
      });
    },

    async getWorkflow(workflowId) {
      const ref = workflowsCol.doc(workflowId);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const eventsSnap = await ref.collection('events').orderBy('sequence', 'asc').get();
      return {
        state: doc.data(),
        events: eventsSnap.docs.map((d) => d.data()),
      };
    },

    async listWorkflowsByOwner(ownerId) {
      const snap = await workflowsCol
        .where('ownerId', '==', ownerId)
        .orderBy('updatedAt', 'desc')
        .limit(25)
        .get();
      return snap.docs.map((d) => d.data());
    },

    async appendEvent(workflowId, expectedSequence, event) {
      return this.appendEventsBatch(workflowId, expectedSequence, [event]);
    },

    async appendEventsBatch(workflowId, expectedSequence, events) {
      const ref = workflowsCol.doc(workflowId);
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: 'not_found' };
        let state = snap.data();

        const firstKeyRef = ref.collection('idempotency').doc(events[0].idempotencyKey);
        const keySnap = await tx.get(firstKeyRef);
        if (keySnap.exists) return { status: 'duplicate', state };

        if (state.lastSequence !== expectedSequence) {
          return {
            status: 'conflict',
            expectedSequence: state.lastSequence,
            actualSequence: expectedSequence,
            state,
          };
        }

        for (const ev of events) {
          state = applyEvent(state, ev);
          tx.create(ref.collection('events').doc(String(ev.sequence)), ev);
          tx.create(ref.collection('idempotency').doc(ev.idempotencyKey), { sequence: ev.sequence });
        }
        tx.set(ref, state, { merge: true });
        return { status: 'committed', state };
      });
    },

    async writeDeadLetter(record) {
      await dlqCol.doc(record.workflowId).set(record);
    },

    async listDeadLetters() {
      const snap = await dlqCol.where('status', '==', 'open').orderBy('createdAt', 'desc').limit(50).get();
      return snap.docs.map((d) => d.data());
    },

    async resolveDeadLetter(workflowId, resolvedBy, resolvedAt) {
      await dlqCol.doc(workflowId).set({ status: 'replayed', resolvedBy, updatedAt: resolvedAt }, { merge: true });
    },

    async deleteWorkflow(workflowId) {
      const ref = workflowsCol.doc(workflowId);
      const events = await ref.collection('events').get();
      const batch = firestore.batch();
      events.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(ref);
      await batch.commit();
    },
  };
}

async function build() {
  const { CLERK_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!CLERK_SECRET_KEY || !FIREBASE_SERVICE_ACCOUNT) return null;

  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const firebase = getApps()[0] ?? initializeApp({
    credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
  });
  const firestore = getFirestore(firebase);

  return createWorkflowApiHandler({
    verifySession: async (token) => {
      const claims = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
      return { userId: claims.sub };
    },
    getPublicMetadata: async (userId) => {
      const user = await clerk.users.getUser(userId);
      return user.publicMetadata ?? {};
    },
    store: createFirestoreWorkflowStore(firestore),
    adapter: createCivicWorkflowAdapter({
      invokeProvider: createGroundedLocalProvider(MOCK_SERVICES),
    }),
    ipLimiter: createRateLimiter({ limit: 30, windowMs: 60_000 }),
    userLimiter: createRateLimiter({ limit: 20, windowMs: 60_000 }),
    emitTelemetry: (event) => {
      console.info(JSON.stringify({ source: 'agent-workflows', timestamp: new Date().toISOString(), ...event }));
    },
  });
}

export default async function route(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    handler ??= await build();
  } catch {
    return res.status(503).json({ error: 'service_unavailable' });
  }
  if (!handler) return res.status(503).json({ error: 'not_configured' });

  const response = await handler({
    method: req.method,
    headers: req.headers,
    query: req.query ?? {},
    body: req.body ?? null,
  });

  for (const [key, value] of Object.entries(response.headers)) {
    res.setHeader(key, value);
  }
  return res.status(response.status).json(response.body);
}
