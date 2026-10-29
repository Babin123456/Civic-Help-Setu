import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  History,
  Archive,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import {
  NOTICE_CATEGORIES,
  NOTICE_STATUSES,
  getNotices,
  addNotice,
  changeNoticeStatus,
  detectDuplicateNotice,
  getNoticeDigestStats,
  resetNoticesToDefault,
} from '../../services/noticeDigestService';
import { MOCK_SERVICES } from '../../data/services';
import { safeHttpUrl } from '../../utils/safeContent';

const NoticeManagementPanel = () => {
  const [notices, setNotices] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, drafts: 0, archived: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [historyModalNotice, setHistoryModalNotice] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [gazettePublicationDate, setGazettePublicationDate] = useState('');
  const [reviewedAtDate, setReviewedAtDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [category, setCategory] = useState('rule_amendment');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState(NOTICE_STATUSES.APPROVED);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Duplicate warning detection
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const refresh = () => {
    const list = getNotices();
    setNotices(list);
    setStats(getNoticeDigestStats());
  };

  useEffect(() => {
    refresh();
  }, []);

  // Check duplicate candidate in real-time
  useEffect(() => {
    if (title.length > 5 || sourceUrl.length > 8) {
      const dup = detectDuplicateNotice({ title, sourceUrl });
      if (dup.isDuplicate) {
        setDuplicateWarning(dup.reason);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [title, sourceUrl]);

  const handleToggleService = (serviceId) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleAddNotice = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    try {
      addNotice({
        title,
        sourceUrl,
        gazettePublicationDate: new Date(gazettePublicationDate).toISOString(),
        reviewedAtDate: reviewedAtDate ? new Date(reviewedAtDate).toISOString() : new Date().toISOString(),
        affectedServiceIds: selectedServices,
        category,
        summary,
        status,
      }, 'Admin Moderator');

      setFormSuccess('Notice successfully verified and added to the digest.');
      setTitle('');
      setSourceUrl('');
      setGazettePublicationDate('');
      setSelectedServices([]);
      setSummary('');
      setShowAddForm(false);
      refresh();
    } catch (err) {
      setFormError(err.message || 'Failed to save notice.');
    }
  };

  const handleStatusChange = (id, newStatus) => {
    try {
      changeNoticeStatus(id, newStatus, 'Admin Moderator', `Status updated to ${newStatus}`);
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all notice digest entries back to official seed defaults?')) {
      resetNoticesToDefault();
      refresh();
    }
  };

  const filteredNotices = notices.filter((n) => {
    if (statusFilter !== 'all' && n.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.summary && n.summary.toLowerCase().includes(q)) ||
      (n.sourceUrl && n.sourceUrl.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Header & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Official Gazette & Notice Digest Management
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Curate, verify, and link official gazette notices and statutory rule amendments to catalog services.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Plus size={16} />
            {showAddForm ? 'Close Notice Form' : 'Register New Notice'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 0.85rem',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Reset to default seed notices"
          >
            <RefreshCw size={15} /> Reset Defaults
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Total Ingested
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981' }}>{stats.approved}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Approved / Live
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f59e0b' }}>{stats.pending}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Pending Review
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#64748b' }}>{stats.archived}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Archived
          </div>
        </div>
      </div>

      {/* Register Notice Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddNotice}
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '1rem',
            border: '1px solid var(--accent-main, #38bdf8)',
            background: 'var(--glass-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Add Curated Notice / Gazette Record</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Provide authentic official publication records. Automatic duplicate checks will alert you before submission.
            </p>
          </div>

          {formError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '0.85rem',
              }}
            >
              {formError}
            </div>
          )}

          {formSuccess && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '0.85rem',
              }}
            >
              {formSuccess}
            </div>
          )}

          {duplicateWarning && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={18} />
              <span>
                <strong>Duplicate Warning:</strong> {duplicateWarning}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Notice Title / Gazette Reference Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Gazette Notification No. 104/2026: Modification in Caste Certificate Rules"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Official Gazette / Circular Source URL *
              </label>
              <input
                type="url"
                required
                placeholder="https://egazette.gov.in/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Official Gazette Publication Date *
              </label>
              <input
                type="date"
                required
                value={gazettePublicationDate}
                onChange={(e) => setGazettePublicationDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Platform Review Date *
              </label>
              <input
                type="date"
                required
                value={reviewedAtDate}
                onChange={(e) => setReviewedAtDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              >
                {NOTICE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Review Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              >
                <option value={NOTICE_STATUSES.APPROVED}>Approved (Published to Citizens)</option>
                <option value={NOTICE_STATUSES.PENDING_REVIEW}>Pending Review</option>
                <option value={NOTICE_STATUSES.DRAFT}>Draft</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Summary / Citizen Impact Explanation
              </label>
              <textarea
                rows={3}
                placeholder="Plain-language description of procedural impact, extended deadlines, or document changes..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                Affected Services * (Select all applicable)
              </label>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.45rem',
                  maxHeight: '130px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--border-main)',
                }}
              >
                {MOCK_SERVICES.map((srv) => {
                  const isChecked = selectedServices.includes(srv.id);
                  return (
                    <button
                      type="button"
                      key={srv.id}
                      onClick={() => handleToggleService(srv.id)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.775rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isChecked ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.1)',
                        background: isChecked ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: isChecked ? 'var(--accent-main)' : 'var(--text-secondary)',
                      }}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {srv.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
              Save & Link Notice
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
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
            placeholder="Filter notices by title, URL, or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'rgba(0, 0, 0, 0.2)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="var(--text-tertiary)" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'rgba(0, 0, 0, 0.2)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Statuses</option>
            <option value={NOTICE_STATUSES.APPROVED}>Approved</option>
            <option value={NOTICE_STATUSES.PENDING_REVIEW}>Pending Review</option>
            <option value={NOTICE_STATUSES.DRAFT}>Draft</option>
            <option value={NOTICE_STATUSES.ARCHIVED}>Archived</option>
          </select>
        </div>
      </div>

      {/* Notices Table / Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredNotices.length === 0 ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No gazette notices found matching your criteria.
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className="card"
              style={{
                padding: '1.25rem',
                borderRadius: '0.85rem',
                borderLeft: `4px solid ${
                  notice.status === NOTICE_STATUSES.APPROVED
                    ? '#10b981'
                    : notice.status === NOTICE_STATUSES.PENDING_REVIEW
                    ? '#f59e0b'
                    : '#64748b'
                }`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '99px',
                        background:
                          notice.status === NOTICE_STATUSES.APPROVED
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color: notice.status === NOTICE_STATUSES.APPROVED ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {notice.status}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-main)', fontWeight: '600' }}>
                      {NOTICE_CATEGORIES.find((c) => c.id === notice.category)?.label || notice.category}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                    {notice.title}
                  </h4>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {notice.sourceUrl && (
                    <a
                      href={safeHttpUrl(notice.sourceUrl) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', display: 'flex', gap: '0.3rem' }}
                    >
                      <ExternalLink size={13} /> Source
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setHistoryModalNotice(notice)}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', display: 'flex', gap: '0.3rem' }}
                    title="View review history and audit trail"
                  >
                    <History size={13} /> History ({notice.history?.length || 1})
                  </button>

                  {notice.status !== NOTICE_STATUSES.APPROVED && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(notice.id, NOTICE_STATUSES.APPROVED)}
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem' }}
                    >
                      Approve
                    </button>
                  )}

                  {notice.status !== NOTICE_STATUSES.ARCHIVED && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(notice.id, NOTICE_STATUSES.ARCHIVED)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem' }}
                      title="Archive notice"
                    >
                      <Archive size={13} />
                    </button>
                  )}
                </div>
              </div>

              {notice.summary && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {notice.summary}
                </p>
              )}

              {/* Distinct Dates Display */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-tertiary)',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>Gazette Published:</strong>{' '}
                  {new Date(notice.gazettePublicationDate).toLocaleDateString()}
                </span>
                <span>
                  <strong>Reviewed by Setu:</strong>{' '}
                  {new Date(notice.reviewedAtDate).toLocaleDateString()}
                </span>
                <span>
                  <strong>Reviewer:</strong> {notice.reviewedBy}
                </span>
              </div>

              {/* Linked Service Tags */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Linked services:</span>
                {notice.affectedServiceIds?.map((srvId) => (
                  <span
                    key={srvId}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.25rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {srvId}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* History Modal */}
      {historyModalNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '550px',
              width: '100%',
              borderRadius: '1rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="history-dialog-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                Audit History: {historyModalNotice.title}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalNotice(null)}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {historyModalNotice.history?.map((hist, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.45rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-main)', fontWeight: '600' }}>
                    <span>{hist.action}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                      {new Date(hist.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>{hist.details}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                    Actor: {hist.actor}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setHistoryModalNotice(null)}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeManagementPanel;
