import React, { useState, useMemo } from 'react';
import {
  Users,
  Code2,
  Accessibility,
  Database,
  Bot,
  TestTube2,
  FileText,
  ExternalLink,
  Award,
  Filter
} from 'lucide-react';
import './ContributorRecognitionDirectory.css';

export const CONTRIBUTION_CATEGORIES = [
  { id: 'all', label: 'All Contributors', icon: Users },
  { id: 'frontend', label: 'Frontend / UI', icon: Code2 },
  { id: 'a11y', label: 'Accessibility', icon: Accessibility },
  { id: 'data', label: 'Civic Data', icon: Database },
  { id: 'ai', label: 'AI & Policy', icon: Bot },
  { id: 'testing', label: 'Testing & QA', icon: TestTube2 },
  { id: 'docs', label: 'Documentation', icon: FileText }
];

export default function ContributorRecognitionDirectory({
  contributors = [],
  repoUrl = 'https://github.com/GoldRay19/Civic-Help-Setu'
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredContributors = useMemo(() => {
    if (selectedCategory === 'all') return contributors;
    return contributors.filter(
      (c) => Array.isArray(c.areas) && c.areas.includes(selectedCategory)
    );
  }, [contributors, selectedCategory]);

  return (
    <section className="crd-section" aria-label="Contributor recognition directory">
      <div className="crd-header">
        <div className="crd-badge">
          <Award size={16} aria-hidden="true" />
          <span>CONTRIBUTOR DIRECTORY &amp; RECOGNITION</span>
        </div>
        <h2 className="crd-title">Recognizing Community Contributors</h2>
        <p className="crd-description">
          Honoring contributors who build, review, verify, and maintain Civic Help Setu.
          Filter by verified contribution area or explore the complete repository network on GitHub.
        </p>

        {/* Accessible Filter Controls */}
        <div className="crd-filter-bar" role="toolbar" aria-label="Filter contributors by domain">
          <span className="crd-filter-label" id="crd-filter-heading">
            <Filter size={15} aria-hidden="true" />
            <span>Filter By:</span>
          </span>
          <div className="crd-filter-options" role="radiogroup" aria-labelledby="crd-filter-heading">
            {CONTRIBUTION_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`crd-filter-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Filter Announcement for Screen Readers */}
        <div className="sr-only" aria-live="polite" role="status">
          Showing {filteredContributors.length} contributors for {selectedCategory} area.
        </div>
      </div>

      {filteredContributors.length === 0 ? (
        <div className="crd-empty-state" role="status">
          <div className="crd-empty-icon" aria-hidden="true">
            <Users size={32} />
          </div>
          <h3>No contributors found in this category</h3>
          <p>
            No verified contributor records have been tagged under &ldquo;{selectedCategory}&rdquo; yet.
            Be the first to claim a good-first-issue in this area!
          </p>
          <button
            type="button"
            className="crd-reset-btn"
            onClick={() => setSelectedCategory('all')}
          >
            Clear Filter
          </button>
        </div>
      ) : (
        <div className="crd-grid" role="list">
          {filteredContributors.map((c) => (
            <article key={c.id || c.login} className="crd-card" role="listitem">
              <div className="crd-card-top">
                <img
                  src={c.avatar_url || 'https://github.com/identicons/user.png'}
                  alt=""
                  className="crd-avatar"
                  loading="lazy"
                />
                <div className="crd-profile-info">
                  <h4 className="crd-name">{c.name || c.login}</h4>
                  <a
                    href={c.html_url || `${repoUrl}/commits?author=${c.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="crd-handle"
                    aria-label={`View GitHub profile of ${c.login}`}
                  >
                    @{c.login}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </div>

              {c.contributions && (
                <div className="crd-contributions-count">
                  <span className="crd-count-number">{c.contributions}</span>
                  <span className="crd-count-label">commits</span>
                </div>
              )}

              {Array.isArray(c.areas) && c.areas.length > 0 && (
                <div className="crd-areas-pills" aria-label="Contribution areas">
                  {c.areas.map((area) => (
                    <span key={area} className="crd-area-tag">
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="crd-footer">
        <a
          href={`${repoUrl}/graphs/contributors`}
          target="_blank"
          rel="noopener noreferrer"
          className="crd-all-link"
        >
          View Complete Contributor Graph on GitHub
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
