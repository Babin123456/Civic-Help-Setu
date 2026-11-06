/**
 * Live GitHub Contributors Service
 * Fetches real contributor records from GitHub's public API with caching,
 * rate limit detection, and graceful fallbacks.
 */

export const REPO_OWNER = 'GoldRay19';
export const REPO_NAME = 'Civic-Help-Setu';
export const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=30`;

const CACHE_KEY = 'civic_help_setu_contributors_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * @typedef {Object} ContributorRecord
 * @property {string} login
 * @property {number} id
 * @property {string} avatar_url
 * @property {string} html_url
 * @property {number} contributions
 */

/**
 * Fetches repository contributors using the public endpoint.
 *
 * @param {Object} [options]
 * @param {typeof fetch} [options.fetchImpl] Custom fetch for testing
 * @param {Storage} [options.storage] Custom storage for caching
 * @param {boolean} [options.forceRefresh] Ignore existing cache
 * @returns {Promise<{
 *   status: 'success' | 'empty' | 'rate_limited' | 'error',
 *   contributors: ContributorRecord[],
 *   rateLimitRemaining?: number,
 *   errorMessage?: string,
 *   isCached?: boolean
 * }>}
 */
export async function fetchLiveContributors(options = {}) {
  const fetchFn = options.fetchImpl || (typeof window !== 'undefined' ? window.fetch : null);
  const storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
  const forceRefresh = Boolean(options.forceRefresh);

  if (!fetchFn) {
    return {
      status: 'error',
      contributors: [],
      errorMessage: 'Fetch client is unavailable'
    };
  }

  // Check cache first
  if (!forceRefresh && storage) {
    try {
      const cachedRaw = storage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          return {
            status: parsed.contributors?.length > 0 ? 'success' : 'empty',
            contributors: parsed.contributors || [],
            isCached: true
          };
        }
      }
    } catch {
      // Ignore cache parse failures
    }
  }

  try {
    const response = await fetchFn(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json'
      }
    });

    const rateRemainingHeader = response.headers?.get?.('x-ratelimit-remaining');
    const rateLimitRemaining = rateRemainingHeader !== undefined && rateRemainingHeader !== null
      ? parseInt(rateRemainingHeader, 10)
      : undefined;

    if (response.status === 403 && rateLimitRemaining === 0) {
      return {
        status: 'rate_limited',
        contributors: [],
        rateLimitRemaining: 0,
        errorMessage: 'GitHub API rate limit exceeded for unauthenticated requests.'
      };
    }

    if (!response.ok) {
      return {
        status: 'error',
        contributors: [],
        errorMessage: `GitHub API error: HTTP ${response.status}`
      };
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return {
        status: 'error',
        contributors: [],
        errorMessage: 'Unexpected response format from GitHub API'
      };
    }

    // Filter valid user contributors (exclude bots or invalid structures)
    const validContributors = data
      .filter((item) => item && typeof item.login === 'string' && typeof item.html_url === 'string')
      .map((item) => ({
        id: item.id,
        login: item.login,
        avatar_url: item.avatar_url,
        html_url: item.html_url,
        contributions: typeof item.contributions === 'number' ? item.contributions : 0
      }));

    if (validContributors.length === 0) {
      return {
        status: 'empty',
        contributors: []
      };
    }

    // Cache valid records
    if (storage) {
      try {
        storage.setItem(
          CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            contributors: validContributors
          })
        );
      } catch {
        // Storage full or restricted; non-fatal
      }
    }

    return {
      status: 'success',
      contributors: validContributors,
      rateLimitRemaining
    };
  } catch (err) {
    return {
      status: 'error',
      contributors: [],
      errorMessage: err?.message || 'Network connection failed while querying GitHub'
    };
  }
}
