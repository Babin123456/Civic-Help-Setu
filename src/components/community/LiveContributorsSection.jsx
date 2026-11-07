import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  GitCommit,
  ShieldAlert,
  Code2,
  ArrowUpRight,
} from 'lucide-react';

import {
  fetchLiveContributors,
  REPO_OWNER,
  REPO_NAME,
} from '../../services/githubContributorsService';

import './LiveContributorsSection.css';

export default function LiveContributorsSection({ customFetcher = null }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState({
    status: 'idle',
    contributors: [],
  });

  const loadData = useCallback(async (forceRefresh = false, isActive = () => true) => {
    if (isActive()) setLoading(true);

    try {
      const response = customFetcher
        ? await customFetcher({ forceRefresh })
        : await fetchLiveContributors({ forceRefresh });

      if (!isActive()) return;

      setResult({
        ...response,
        contributors: Array.isArray(response?.contributors)
          ? response.contributors
          : [],
      });
    } catch (error) {
      if (!isActive()) return;

      setResult({
        status: 'error',
        contributors: [],
        errorMessage: error?.message || 'Failed to fetch contributors.',
      });
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [customFetcher]);

  useEffect(() => {
    let active = true;

    loadData(false, () => active);

    return () => {
      active = false;
    };
  }, [loadData]);

  const contributors = result.contributors || [];
  const repoUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
  const contributorsUrl = `${repoUrl}/graphs/contributors`;

  const isRateLimited = result.status === 'rate_limited';
  const isError = result.status === 'error';
  const isEmpty =
    result.status === 'empty' ||
    (result.status === 'success' && contributors.length === 0);

  return (
    <section className="lcs-section" aria-label="GitHub repository contributors">
      {/* Header */}
      <div className="lcs-header">
        <div className="lcs-heading">
          <div className="lcs-eyebrow">
            <Users size={15} />
            <span>REAL GITHUB CONTRIBUTORS</span>
            <span className="lcs-live-dot" />
          </div>

          <h2>Meet Our Contributors</h2>

          <p>
            Real people building <strong>{REPO_OWNER}/{REPO_NAME}</strong>.
            Every contribution makes a difference.
          </p>
        </div>

        <div className="lcs-actions">
          <button
            type="button"
            className="lcs-button lcs-button-secondary"
            onClick={() => loadData(true)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? 'lcs-spin' : ''}
            />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>

          <a
            className="lcs-button lcs-button-primary"
            href={contributorsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={17} />
            View on GitHub
            <ArrowUpRight size={15} />
          </a>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="lcs-state" role="status">
          <div className="lcs-loader">
            <Loader2 size={27} className="lcs-spin" />
          </div>
          <h3>Finding our contributors</h3>
          <p>Loading live contribution data from GitHub...</p>
        </div>
      )}

      {/* Rate limit */}
      {!loading && isRateLimited && (
        <div className="lcs-message lcs-warning" role="alert">
          <ShieldAlert size={23} />
          <div>
            <h3>GitHub rate limit reached</h3>
            <p>
              GitHub has temporarily limited API requests. Please try again
              later or view the contributor graph directly.
            </p>
            <a href={contributorsUrl} target="_blank" rel="noopener noreferrer">
              View GitHub contributor graph <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && isError && (
        <div className="lcs-message lcs-error" role="alert">
          <AlertCircle size={23} />
          <div>
            <h3>Couldn't load contributors</h3>
            <p>
              {result.errorMessage || 'GitHub API is temporarily unavailable.'}
            </p>
            <button type="button" onClick={() => loadData(true)}>
              Try again <RefreshCw size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && isEmpty && (
        <div className="lcs-state">
          <div className="lcs-empty-icon">
            <Users size={28} />
          </div>
          <h3>No contributors found yet</h3>
          <p>Be the first to contribute to this repository!</p>
          <a href={`${repoUrl}/contribute`} target="_blank" rel="noopener noreferrer">
            Start contributing <ArrowUpRight size={15} />
          </a>
        </div>
      )}

      {/* Contributors */}
      {!loading && result.status === 'success' && contributors.length > 0 && (
        <>
          <div className="lcs-grid">
            {contributors.map((contributor, index) => (
              <a
                key={contributor.id || contributor.login}
                href={contributor.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="lcs-card"
                aria-label={`${contributor.login}, ${contributor.contributions} contributions`}
              >
                <div className="lcs-card-top">
                  <span className="lcs-rank">
                    #{index + 1}
                  </span>
                  <ExternalLink size={15} className="lcs-card-link" />
                </div>

                <img
                  className="lcs-avatar"
                  src={contributor.avatar_url}
                  alt={`${contributor.login}'s GitHub avatar`}
                  loading="lazy"
                  width="76"
                  height="76"
                />

                <h3 className="lcs-username">{contributor.login}</h3>

                <span className="lcs-contributions">
                  <GitCommit size={15} />
                  <strong>
                    {Number(contributor.contributions || 0).toLocaleString()}
                  </strong>
                  {Number(contributor.contributions) === 1
                    ? 'contribution'
                    : 'contributions'}
                </span>

                <span className="lcs-profile-label">
                  GitHub profile <ArrowUpRight size={13} />
                </span>
              </a>
            ))}
          </div>

          <div className="lcs-footer">
            <span>
              <span className="lcs-footer-dot" />
              Showing {contributors.length} public contributor
              {contributors.length === 1 ? '' : 's'}
            </span>

            <a href={contributorsUrl} target="_blank" rel="noopener noreferrer">
              Explore all contributions <ArrowUpRight size={15} />
            </a>
          </div>
        </>
      )}
    </section>
  );
}
