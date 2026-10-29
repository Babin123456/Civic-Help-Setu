import React, { useState } from 'react';
import {
  FileText,
  ExternalLink,
  Calendar,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  X,
  Layers,
  AlertCircle,
} from 'lucide-react';
import {
  LEGAL_DISCLAIMER,
  NOTICE_CATEGORIES,
  getNoticesForService,
  queryNotices,
} from '../../services/noticeDigestService';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * Formats ISO date string to human-readable locale format
 */
const formatDate = (isoString) => {
  if (!isoString) return 'Not recorded';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
};

const PublicNoticeDigestModal = ({ isOpen, onClose, serviceId = null, serviceName = '' }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  if (!isOpen) return null;

  const notices = serviceId
    ? getNoticesForService(serviceId, null, true).filter((n) => {
        if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || (n.summary && n.summary.toLowerCase().includes(q));
      })
    : queryNotices(null, {
        status: 'approved',
        category: selectedCategory,
        searchQuery: search,
      });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-digest-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main, #38bdf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2
                id="notice-digest-title"
                style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}
              >
                Official Notices & Gazette Digest
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {serviceName
                  ? `Curated gazette orders and official notices affecting ${serviceName}`
                  : 'Reviewed updates, rule amendments, and official notices across all civic services'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Legal Disclaimer Callout */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(234, 179, 8, 0.08)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.25)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
          }}
        >
          <ShieldAlert size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong style={{ color: '#eab308' }}>Not Legal Advice: </strong>
            {LEGAL_DISCLAIMER}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.05))',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search notices by keyword or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-tertiary)" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              <option value="all">All Categories</option>
              {NOTICE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notices Scrollable List */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flex: 1,
          }}
        >
          {notices.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-secondary)',
              }}
            >
              <AlertCircle size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontWeight: '600', margin: '0 0 0.25rem' }}>No official notices found</p>
              <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-tertiary)' }}>
                No active gazette circulars or procedural amendments match your current filters.
              </p>
            </div>
          ) : (
            notices.map((notice) => (
              <article
                key={notice.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.85rem',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '99px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: 'var(--accent-main, #38bdf8)',
                        marginRight: '0.5rem',
                      }}
                    >
                      {NOTICE_CATEGORIES.find((c) => c.id === notice.category)?.label || 'Notice'}
                    </span>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: '700',
                        margin: '0.4rem 0 0',
                        color: 'var(--text-primary)',
                        lineHeight: 1.35,
                      }}
                    >
                      {notice.title}
                    </h3>
                  </div>

                  {notice.sourceUrl && (
                    <a
                      href={safeHttpUrl(notice.sourceUrl) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexShrink: 0,
                      }}
                    >
                      <ExternalLink size={14} /> View Gazette Source
                    </a>
                  )}
                </div>

                {notice.summary && (
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {notice.summary}
                  </p>
                )}

                {/* Key Distinctions: Publication Date vs Setu Review Date */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
                    <Calendar size={15} />
                    <span>
                      <strong>Gazette Published:</strong> {formatDate(notice.gazettePublicationDate)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981' }}>
                    <Clock size={15} />
                    <span>
                      <strong>Civic Help Setu Reviewed:</strong> {formatDate(notice.reviewedAtDate)}
                    </span>
                  </div>

                  {notice.reviewedBy && (
                    <div style={{ color: 'var(--text-tertiary)' }}>
                      <span>By: {notice.reviewedBy}</span>
                    </div>
                  )}
                </div>

                {/* Affected Service Badges */}
                {Array.isArray(notice.affectedServiceIds) && notice.affectedServiceIds.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <Layers size={13} color="var(--text-tertiary)" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Connected Services:</span>
                    {notice.affectedServiceIds.map((srvId) => (
                      <span
                        key={srvId}
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-secondary)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.3rem',
                        }}
                      >
                        {srvId}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            Close Digest
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicNoticeDigestModal;
