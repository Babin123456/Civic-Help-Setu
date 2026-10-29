import { requirePermission, actorLabel } from './accessControl';
import { safeHttpUrl } from '../utils/safeContent';

/**
 * Official application-link health check (admin only).
 *
 * What it can and cannot do: this app is a browser-only Vite frontend with no server-side
 * capability for fetching other sites. A browser can read the status and final address of another
 * site only when that site allows it (CORS). Most government portals do not, so for them the honest
 * result is "unable to verify", never "down". The check sends one plain GET, with no cookies, no
 * credentials and no form data, and never signs in.
 *
 * Statuses:
 *   reachable   the portal answered with a success status at the same address
 *   redirected  the portal answered but the final address differs; needs an admin decision
 *   unavailable the portal answered with a clear error status (404, 410, 5xx ...)
 *   unverified  the browser could not tell (CORS, network error, timeout). The admin can open the
 *               link and record what they saw by hand.
 *   invalid     not an http(s) address; never checked
 *
 * A redirect is never written back to the service record. It stays "needs review" until an admin
 * records a decision.
 */

const STORAGE_KEY = 'civicbridge_link_health_v1';
export const DEFAULT_TIMEOUT_MS = 8000;

export const LINK_STATUS = {
  reachable: { label: 'Reachable', tone: 'ok', note: 'The portal responded normally.' },
  redirected: { label: 'Moved - needs review', tone: 'warn', note: 'The link now leads to a different address. Check it before changing the guide.' },
  unavailable: { label: 'Not working', tone: 'bad', note: 'The portal answered with an error. Open it yourself to confirm.' },
  unverified: { label: 'Unable to verify', tone: 'neutral', note: 'This browser cannot check this portal. That does not mean it is down. Open the link and record what you see.' },
  invalid: { label: 'Not a web link', tone: 'bad', note: 'Only http and https addresses can be checked.' },
};

/** Statuses worth trying again later (a temporary problem, not an answer about the portal). */
export const isRetryable = (status) => status === 'unverified';

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    return null;
  }
  return null;
};

const stripFragment = (value) => value.split('#')[0];

/** Compares two addresses ignoring a trailing slash, the #fragment and upper/lower case of the host. */
export const sameDestination = (a, b) => {
  try {
    const x = new URL(stripFragment(a));
    const y = new URL(stripFragment(b));
    const path = (u) => (u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '');
    return x.protocol === y.protocol && x.host === y.host && path(x) === path(y) && x.search === y.search;
  } catch {
    return false;
  }
};

const record = (url, status, extra = {}, now = new Date()) => ({
  url,
  status,
  checkedAt: now.toISOString(),
  redirectedTo: null,
  httpStatus: null,
  reviewed: false,
  method: 'automatic',
  ...extra,
});

/**
 * Runs one check. Never throws and never claims "unavailable" without a readable error status.
 * @param {string} rawUrl
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, now?: Date }} [options]
 */
export const checkLink = async (rawUrl, { fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS, now = new Date() } = {}) => {
  const url = safeHttpUrl(rawUrl);
  if (!url) return record(typeof rawUrl === 'string' ? rawUrl.slice(0, 200) : '', 'invalid', {}, now);

  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return record(url, 'unverified', { reason: 'no-fetch' }, now);

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      resolve('timeout');
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      doFetch(url, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller ? controller.signal : undefined,
      }),
      timeout,
    ]);
    if (response === 'timeout') return record(url, 'unverified', { reason: 'timeout' }, now);
    if (!response || typeof response.status !== 'number' || response.type === 'opaque' || response.status === 0) {
      return record(url, 'unverified', { reason: 'opaque' }, now);
    }
    const httpStatus = response.status;
    const finalUrl = safeHttpUrl(response.url || '');
    if (httpStatus >= 400) {
      // 401/403/407/429 mean the portal wants a login or is limiting requests: not evidence it is gone.
      if ([401, 403, 407, 429].includes(httpStatus)) return record(url, 'unverified', { httpStatus, reason: 'restricted' }, now);
      return record(url, 'unavailable', { httpStatus }, now);
    }
    if (httpStatus >= 300) return record(url, 'unverified', { httpStatus, reason: 'unexpected' }, now);
    if (finalUrl && !sameDestination(url, finalUrl)) {
      return record(url, 'redirected', { httpStatus, redirectedTo: finalUrl }, now);
    }
    return record(url, 'reachable', { httpStatus }, now);
  } catch {
    // CORS refusals, DNS and offline errors all look the same to a browser, so none proves the portal is down.
    return record(url, 'unverified', { reason: 'blocked-or-network' }, now);
  } finally {
    clearTimeout(timer);
  }
};

/** Retries only temporary "unable to verify" outcomes, up to `attempts` times in total. */
export const checkLinkWithRetry = async (rawUrl, options = {}, attempts = 2) => {
  let result = await checkLink(rawUrl, options);
  for (let i = 1; i < attempts && isRetryable(result.status); i += 1) {
    result = await checkLink(rawUrl, options);
  }
  return result;
};

export const getLinkHealthRecords = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const persist = (storage, all) => {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the result is still returned to the caller */
  }
};

/** Saves a check result against a service. Admin only. A redirect starts out as not yet reviewed. */
export const saveLinkCheck = (serviceId, result, customStorage) => {
  requirePermission('links.check');
  if (!serviceId || !result) throw new Error('A service and a result are required.');
  const storage = getStorage(customStorage);
  const all = getLinkHealthRecords(storage);
  const entry = { ...result, checkedBy: actorLabel(), reviewed: result.status !== 'redirected' };
  all[String(serviceId)] = entry;
  persist(storage, all);
  return entry;
};

/**
 * Records what an admin saw after opening the link themselves. `outcome` is one of
 * reachable | redirected | unavailable. For "redirected", the address they ended up on is required.
 */
export const recordManualCheck = (serviceId, url, outcome, { destination = '', now = new Date() } = {}, customStorage) => {
  requirePermission('links.check');
  const safe = safeHttpUrl(url);
  if (!safe) throw new Error('Only http and https links can be checked.');
  if (!['reachable', 'redirected', 'unavailable'].includes(outcome)) throw new Error('Choose what you saw.');
  let redirectedTo = null;
  if (outcome === 'redirected') {
    redirectedTo = safeHttpUrl(destination);
    if (!redirectedTo) throw new Error('Enter the web address you ended up on.');
  }
  return saveLinkCheck(serviceId, record(safe, outcome, { redirectedTo, method: 'manual' }, now), customStorage);
};

/**
 * An admin's explicit decision about a redirect. It only marks the finding as reviewed; the
 * service record is not changed.
 */
export const reviewRedirect = (serviceId, customStorage) => {
  requirePermission('links.check');
  const storage = getStorage(customStorage);
  const all = getLinkHealthRecords(storage);
  const entry = all[String(serviceId)];
  if (!entry || entry.status !== 'redirected') throw new Error('There is no redirect to review.');
  all[String(serviceId)] = { ...entry, reviewed: true, reviewedBy: actorLabel(), reviewedAt: new Date().toISOString() };
  persist(storage, all);
  return all[String(serviceId)];
};

/** The official source links of a service. `url` is '' when the stored value is not an http(s) address. */
export const getApplicationLinks = (service) => {
  const sources = Array.isArray(service?.officialSources) ? service.officialSources : [];
  return sources
    .filter((s) => typeof s?.url === 'string' && s.url.trim())
    .map((s) => ({ name: typeof s.name === 'string' ? s.name : 'Official portal', raw: s.url, url: safeHttpUrl(s.url) }));
};

export const needsAttention = (rec) =>
  !!rec && (rec.status === 'unavailable' || rec.status === 'invalid' || (rec.status === 'redirected' && !rec.reviewed));
