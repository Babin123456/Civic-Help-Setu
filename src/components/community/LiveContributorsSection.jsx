import React, { useState, useEffect } from 'react';
import { Users, Loader2, AlertCircle, RefreshCw, ExternalLink, GitCommit, ShieldAlert } from 'lucide-react';
import { fetchLiveContributors, REPO_OWNER, REPO_NAME } from '../../services/githubContributorsService';

/**
 * LiveContributorsSection Component
 * Renders real GitHub repository contributors in a responsive grid
 * with loading, empty, API-failure, and rate-limited states.
 */
export default function LiveContributorsSection({ customFetcher = null }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState({
    status: 'idle',
    contributors: []
  });

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = customFetcher
        ? await customFetcher({ forceRefresh })
        : await fetchLiveContributors({ forceRefresh });
      setResult(res);
    } catch (err) {
      setResult({
        status: 'error',
        contributors: [],
        errorMessage: err?.message || 'Failed to fetch contributors'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadData().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, []);

  const repoContributorsUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/graphs/contributors`;

  return (
    <section
      className="live-contributors-section mb-16 p-6 sm:p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm"
      aria-label="GitHub Repository Contributors"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 mb-1">
            <Users size={13} />
            <span>Real GitHub Contributors</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Repository Contributors
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Verified public contributors from <code>{REPO_OWNER}/{REPO_NAME}</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={loading}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
            aria-label="Refresh contributors list from GitHub"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <a
            href={repoContributorsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
            aria-label="View all contributors graph on GitHub (opens in new tab)"
          >
            <span>View All on GitHub</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400" role="status">
          <Loader2 size={32} className="animate-spin mb-3 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium">Fetching real contributor data from GitHub...</p>
        </div>
      )}

      {/* Rate Limited State */}
      {!loading && result.status === 'rate_limited' && (
        <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200" role="alert">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">GitHub Rate Limit Reached</h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                GitHub limits unauthenticated API requests to 60 per hour. Contributor avatars cannot be loaded right now,
                but you can view the complete contributor graph directly on GitHub.
              </p>
              <div className="mt-3">
                <a
                  href={repoContributorsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-100 underline hover:no-underline"
                >
                  <span>Open Contributors Graph on GitHub</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Error State */}
      {!loading && result.status === 'error' && (
        <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Unable to Load Live Contributors</h3>
              <p className="text-xs text-rose-800 dark:text-rose-300 mt-1">
                {result.errorMessage || 'GitHub API is temporarily unreachable.'} The rest of this community hub remains fully functional.
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-100 underline hover:no-underline"
                >
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && result.status === 'empty' && (
        <div className="text-center py-10 px-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
          <Users size={32} className="mx-auto text-gray-400 mb-2" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">No Contributors Reported</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            The GitHub API returned zero contributors for this repository endpoint.
          </p>
        </div>
      )}

      {/* Successful Contributors Grid */}
      {!loading && result.status === 'success' && result.contributors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {result.contributors.map((c) => (
            <a
              key={c.id || c.login}
              href={c.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`${c.login} - ${c.contributions} contributions on GitHub`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={c.avatar_url}
                  alt=""
                  width="44"
                  height="44"
                  loading="lazy"
                  className="rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {c.login}
                    </span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <GitCommit size={12} />
                    <span>{c.contributions} {c.contributions === 1 ? 'commit' : 'commits'}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
