import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearUserData,
  getStoredDataSummary,
  expandCategories,
  isOwnedLocalKey,
  removeOwnedKey,
} from './clearMyDataService.js';
import {
  DATA_CATEGORIES,
  USER_DATA_STORES,
  USER_DATA_SESSION_STORES,
  RETAINED_STORAGE_KEYS,
  getPrivacyAuditLogs,
} from './privacyConsentService.js';

// Storage double with key()/length like the real thing. `failOn` makes removeItem throw for a key,
// `ignore` makes removeItem silently do nothing (the browser "forgot" to delete it).
const makeStorage = (initial = {}, { failOn = [], ignore = [] } = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    clear: vi.fn(() => data.clear()),
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => {
      if (failOn.includes(k)) throw new Error('QuotaExceededError: storage is locked');
      if (ignore.includes(k)) return;
      data.delete(k);
    },
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
};

const seed = () => ({
  civicbridge_checklists: JSON.stringify({ 'APP-1': { checked: ['Photo'], rev: 1 } }),
  civic_journey_progress_new_business: JSON.stringify({ completedTaskIds: ['t1'] }),
  civicbridge_eligibility_assessments: JSON.stringify([{ id: 'e1' }]),
  civicbridge_applications: JSON.stringify([{ id: 'APP-1' }, { id: 'APP-2' }]),
  civicbridge_office_tokens: JSON.stringify([{ id: 'apt_1' }]),
  civicbridge_reminders: JSON.stringify([{ id: 'r1' }]),
  civicbridge_saved_rich: JSON.stringify([{ serviceId: 'pan-card' }]),
  civicbridge_saved: JSON.stringify([{ id: 'pan-card' }]),
  civicbridge_offline_cache: JSON.stringify({ services: {}, applications: [{ id: 'APP-1' }] }),
  civicbridge_offline_last_sync: '2026-10-01T00:00:00.000Z',
  civicbridge_vault_docs: JSON.stringify([{ id: 'd1', number: '1234' }]),
  civicbridge_chat_history: JSON.stringify([{ id: 'c1' }]),
  civic_service_reviews: JSON.stringify([{ id: 'rev1' }]),
  // things this app must never delete here
  civicbridge_theme: 'light',
  civicbridge_lang: 'hi',
  civicbridge_demo_user: JSON.stringify({ id: 'demo-1' }),
  civicbridge_custom_services: JSON.stringify([{ id: 'admin-svc' }]),
  civicbridge_error_reports: JSON.stringify([{ id: 'rep1' }]),
  some_other_site_key: 'not ours',
});

const KEPT = [
  'civicbridge_theme',
  'civicbridge_lang',
  'civicbridge_demo_user',
  'civicbridge_custom_services',
  'civicbridge_error_reports',
  'some_other_site_key',
];

const row = (result, id) => result.results.find((r) => r.id === id);

describe('clearUserData (#223)', () => {
  beforeEach(() => {
    if (globalThis.__mockPrivacyStorage) globalThis.__mockPrivacyStorage.clear();
  });

  describe('success', () => {
    it('clears only the chosen categories and reports each one', () => {
      const local = makeStorage(seed());
      const session = makeStorage({ civicbridge_user_coords: '{"lat":1,"lng":2}' });

      const result = clearUserData({ categories: ['drafts'], actorId: 'user_1', local, session });

      expect(result.ok).toBe(true);
      expect(result.results.map((r) => r.id)).toEqual(['drafts']);
      expect(row(result, 'drafts')).toMatchObject({ status: 'cleared', removed: 3, failed: [] });
      expect(local.getItem('civicbridge_checklists')).toBeNull();
      expect(local.getItem('civic_journey_progress_new_business')).toBeNull();
      expect(local.getItem('civicbridge_eligibility_assessments')).toBeNull();
      // other categories untouched
      expect(local.getItem('civicbridge_applications')).not.toBeNull();
      expect(local.getItem('civicbridge_saved_rich')).not.toBeNull();
      expect(session.getItem('civicbridge_user_coords')).not.toBeNull();
    });

    it('clears the offline copies together with tracking records and saved items', () => {
      const local = makeStorage(seed());
      const result = clearUserData({ categories: ['tracking'], actorId: 'user_1', local, session: makeStorage() });

      expect(result.results.map((r) => r.id)).toEqual(['tracking', 'cache']);
      expect(row(result, 'cache').auto).toBe(true);
      expect(row(result, 'cache').status).toBe('cleared');
      expect(local.getItem('civicbridge_applications')).toBeNull();
      expect(local.getItem('civicbridge_offline_cache')).toBeNull();
      expect(local.getItem('civicbridge_saved_rich')).not.toBeNull();
    });

    it('everything removes every owned key and leaves preferences, sign-in and admin data alone', () => {
      const local = makeStorage(seed());
      const session = makeStorage({ civicbridge_user_coords: '{"lat":1,"lng":2}' });

      const result = clearUserData({
        categories: DATA_CATEGORIES.map((c) => c.id),
        actorId: 'user_1',
        local,
        session,
      });

      expect(result.ok).toBe(true);
      for (const store of USER_DATA_STORES) expect(local.getItem(store.key)).toBeNull();
      expect(local.getItem('civic_journey_progress_new_business')).toBeNull();
      expect(session.getItem('civicbridge_user_coords')).toBeNull();
      for (const key of KEPT) expect(local.getItem(key)).not.toBeNull();
      expect(local.clear).not.toHaveBeenCalled();
    });

    it('reports a category with nothing stored instead of pretending it deleted something', () => {
      const result = clearUserData({ categories: ['vault'], actorId: 'user_1', local: makeStorage(), session: makeStorage() });
      expect(row(result, 'vault')).toMatchObject({ status: 'nothing', removed: 0 });
      expect(result.ok).toBe(true);
    });

    it('writes an audit receipt without personal data', () => {
      clearUserData({ categories: ['vault'], actorId: 'user_1', local: makeStorage(seed()), session: makeStorage() });
      const entry = getPrivacyAuditLogs().find((l) => l.action === 'USER_DATA_CLEARED');
      expect(entry.actorId).toBe('user_1');
      expect(entry.metadata.categories).toEqual(['vault']);
      expect(JSON.stringify(entry)).not.toContain('1234');
    });

    it('counts what is stored per category for the screen', () => {
      const summary = getStoredDataSummary({ local: makeStorage(seed()), session: makeStorage() });
      const tracking = summary.find((c) => c.id === 'tracking');
      expect(tracking.keyCount).toBe(3);
      expect(tracking.recordCount).toBe(4); // 2 applications + 1 token + 1 reminder
      expect(summary.find((c) => c.id === 'assistant').recordCount).toBe(1);
      expect(summary.every((c) => typeof c.label === 'string' && typeof c.description === 'string')).toBe(true);
    });
  });

  describe('unauthorized deletion', () => {
    it("rejects deleting another user's records and removes nothing", () => {
      const local = makeStorage(seed());
      const before = [...local.data.entries()];

      expect(() =>
        clearUserData({ categories: ['tracking'], actorId: 'attacker_9', ownerId: 'citizen_victim', local, session: makeStorage() })
      ).toThrow(/Access Denied/);

      expect([...local.data.entries()]).toEqual(before);
      const entry = getPrivacyAuditLogs().find((l) => l.action === 'UNAUTHORIZED_DELETE_BLOCKED');
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe('attacker_9');
      expect(entry.metadata.attemptedAccessOn).toBe('citizen_victim');
    });

    it('has no admin override for deleting a citizen record', () => {
      const local = makeStorage(seed());
      expect(() =>
        clearUserData({ categories: ['vault'], actorId: 'admin_root', ownerId: 'citizen_1', local, session: makeStorage() })
      ).toThrow(/Access Denied/);
      expect(local.getItem('civicbridge_vault_docs')).not.toBeNull();
    });

    it('needs a user context and a real category', () => {
      const local = makeStorage(seed());
      expect(() => clearUserData({ categories: ['vault'], local })).toThrow(/Missing user context/);
      expect(() => clearUserData({ categories: [], actorId: 'u', local })).toThrow(/at least one/);
      expect(() => clearUserData({ categories: ['everything-else'], actorId: 'u', local })).toThrow(/Unknown data category/);
      expect(local.data.size).toBe(Object.keys(seed()).length);
    });

    it('refuses to remove a key the app does not own', () => {
      const local = makeStorage(seed());
      for (const key of ['civicbridge_theme', 'civicbridge_demo_user', 'civicbridge_custom_services', 'some_other_site_key', 'civic_journey_progress_', '']) {
        expect(isOwnedLocalKey(key)).toBe(false);
        expect(() => removeOwnedKey(local, key)).toThrow(/not a key this app owns/);
      }
      expect(local.data.size).toBe(Object.keys(seed()).length);
    });
  });

  describe('partial failure', () => {
    it('reports the store that threw, still clears the others, and does not claim success', () => {
      const local = makeStorage(seed(), { failOn: ['civicbridge_reminders'] });
      const result = clearUserData({ categories: ['tracking', 'saved'], actorId: 'user_1', local, session: makeStorage() });

      expect(result.ok).toBe(false);
      const tracking = row(result, 'tracking');
      expect(tracking.status).toBe('partial');
      expect(tracking.removed).toBe(2);
      expect(tracking.failed).toEqual([{ key: 'civicbridge_reminders', error: expect.stringContaining('locked') }]);
      expect(row(result, 'saved').status).toBe('cleared');
      expect(local.getItem('civicbridge_reminders')).not.toBeNull();
      expect(local.getItem('civicbridge_applications')).toBeNull();
    });

    it('treats a remove that silently did nothing as a failure', () => {
      const local = makeStorage(seed(), { ignore: ['civicbridge_vault_docs'] });
      const result = clearUserData({ categories: ['vault'], actorId: 'user_1', local, session: makeStorage() });
      expect(row(result, 'vault').status).toBe('failed');
      expect(row(result, 'vault').failed[0].key).toBe('civicbridge_vault_docs');
      expect(result.ok).toBe(false);
    });

    it('can be retried: a second run clears what failed the first time', () => {
      const local = makeStorage(seed(), { failOn: ['civicbridge_reminders'] });
      clearUserData({ categories: ['tracking'], actorId: 'user_1', local, session: makeStorage() });
      local.removeItem = (k) => local.data.delete(k); // storage works again
      const retry = clearUserData({ categories: ['tracking'], actorId: 'user_1', local, session: makeStorage() });
      expect(row(retry, 'tracking')).toMatchObject({ status: 'cleared', removed: 1 });
      expect(retry.ok).toBe(true);
    });

    it('survives storage that cannot even be read', () => {
      const broken = {
        getItem: () => {
          throw new Error('SecurityError');
        },
        removeItem: () => {},
        key: () => null,
        length: 0,
      };
      const result = clearUserData({ categories: ['vault'], actorId: 'user_1', local: broken, session: null });
      expect(row(result, 'vault').status).toBe('failed');
      expect(result.ok).toBe(false);
    });
  });

  describe('category expansion', () => {
    it('adds copy-only categories and nothing else', () => {
      expect(expandCategories(['saved'])).toEqual({ ids: ['saved', 'cache'], auto: ['cache'] });
      expect(expandCategories(['vault'])).toEqual({ ids: ['vault'], auto: [] });
      expect(expandCategories(['cache', 'tracking']).auto).toEqual([]);
    });
  });
});

// The registry is the single source of truth: every storage key the source code writes must be in
// it (deleted by "Clear my data"), or listed as retained on purpose. This fails when a new service
// starts storing something without being added.
describe('registry covers the keys the app writes', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return walk(p);
      return /\.(js|jsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
    });

  const used = new Set();
  for (const file of walk(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/['"`]((?:civicbridge|civic)_[a-z0-9_]+)['"`]/g)) used.add(m[1]);
  }

  const known = new Set([
    ...USER_DATA_STORES.map((s) => s.key),
    ...USER_DATA_SESSION_STORES.map((s) => s.key),
    ...RETAINED_STORAGE_KEYS,
    'civic_journey_progress_', // prefix, handled by USER_DATA_PREFIX_STORES
    'civicbridge_location_denied', // sessionStorage flag: only records that a permission was refused
    'civicbridge_email_verification_pending',
    'civicbridge_verified_emails',
    'civicbridge_email_resend_attempts',
    'civicbridge_notification_preferences',
    'civicbridge_app_status_qr_tokens',
    'civicbridge_app_status_qr_rate_limits',
    'civicbridge_catalogue_auditor_dismissals_v2',
    'civicbridge_dismissed_catalogue_conflicts',
    'civic_service_fee_preferences',
    'civicbridge_helper_invitations',
    'civicbridge_helper_delegations',
    'civicbridge_helper_audit_logs',
    'civicbridge_shareable_directory_views',
    'civicbridge_shareable_citizen_profiles',
    'civicbridge_voluntary_profile_opt_in',
    'civicbridge_voluntary_profile_attrs',
  ]);

  it('has no unlisted storage key in src', () => {
    const missing = [...used].filter((k) => !known.has(k));
    expect(missing).toEqual([]);
  });

  it('gives every store a category that exists', () => {
    const ids = DATA_CATEGORIES.map((c) => c.id);
    for (const s of [...USER_DATA_STORES, ...USER_DATA_SESSION_STORES]) expect(ids).toContain(s.category);
  });

  it('is described in docs/DATA_RETENTION.md', () => {
    const doc = readFileSync(join(root, 'docs', 'DATA_RETENTION.md'), 'utf8');
    const undocumented = [...known].filter((k) => !doc.includes(k));
    expect(undocumented).toEqual([]);
  });
});
