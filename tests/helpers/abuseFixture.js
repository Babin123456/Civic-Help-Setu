/**
 * tests/helpers/abuseFixture.js
 *
 * Transactional in-memory test double for the Abuse Control Plane store.
 * Mirrors the Firestore store contract (see api/_lib/abuseStore.js) so the
 * same control-plane logic is exercised in tests and in production.
 * Never a production fallback.
 */

export class AbuseStoreFixture {
  quotas = new Map();      // bucket -> { count, limit, windowMs, resetAt }
  signals = new Map();     // bucket -> signal[]
  allowlists = new Map();  // `${identifierHash}:${route}` -> { reason, expiresAt }
  blocklists = new Map();  // `${identifierHash}:${route}` -> { reason, expiresAt }
  appeals = new Map();     // appealId -> appeal
  tail = Promise.resolve();
  failNext = false;

  listKey(identifierHash, route) {
    return `${identifierHash}:${route}`;
  }

  async getQuota(bucket) {
    return this.quotas.get(bucket) || null;
  }

  async setQuota(bucket, value) {
    this.quotas.set(bucket, { ...value });
  }

  async recordSignal(signal) {
    const list = this.signals.get(signal.bucket) || [];
    this.signals.set(signal.bucket, list);
    list.push({ ...signal, recordedAt: Date.now() });
  }

  async getSignals(bucket, since = 0) {
    return (this.signals.get(bucket) || []).filter((s) => s.at >= since);
  }

  async setAllowlist(identifierHash, route, reason, expiresAt) {
    this.allowlists.set(this.listKey(identifierHash, route), { reason, expiresAt });
  }

  async setBlocklist(identifierHash, route, reason, expiresAt) {
    this.blocklists.set(this.listKey(identifierHash, route), { reason, expiresAt });
  }

  async isAllowlisted(identifierHash, route) {
    return this.allowlists.has(this.listKey(identifierHash, route));
  }

  async isBlocklisted(identifierHash, route) {
    return this.blocklists.has(this.listKey(identifierHash, route));
  }

  async createAppeal(appeal) {
    if (this.appeals.has(appeal.id)) throw new Error('appeal_conflict');
    const record = { ...appeal };
    this.appeals.set(appeal.id, record);
    return record;
  }

  async getAppeal(appealId) {
    return this.appeals.get(appealId) || null;
  }

  async updateAppeal(appealId, patch) {
    const existing = this.appeals.get(appealId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    this.appeals.set(appealId, updated);
    return updated;
  }

  async listAppeals({ status, limit = 20, cursor } = {}) {
    let items = [...this.appeals.values()];
    if (status) items = items.filter((a) => a.status === status);
    items.sort((a, b) => b.createdAt - a.createdAt);
    const start = cursor ? items.findIndex((a) => a.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return {
      appeals: page,
      nextCursor: page.length === limit && start + limit < items.length ? page[page.length - 1].id : null,
    };
  }

  /** Inject a storage failure on the next mutating operation (error-path tests). */
  failNextMutating() {
    this.failNext = true;
  }
}
