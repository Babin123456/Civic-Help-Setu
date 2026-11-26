import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  getAggregateFrictionMetrics,
  reviewBottleneckFeedback,
  queryFeedbackForModeration,
  resetFeedbackDefaults,
} from '../../services/bottleneckFeedbackService';
import { MOCK_SERVICES } from '../../data/services';

import { useAuth } from '../../context/AuthContext';
import { useModalKeyboard } from '../../hooks/useModalKeyboard.js';
import { feedbackRequest } from '../../services/bottleneckFeedbackApi.js';

const BottleneckFeedbackDashboard = () => {
  const { isDemoMode, getSessionToken } = useAuth();
  const localDemo = isDemoMode && import.meta.env.DEV && import.meta.env.VITE_SHARED_FEEDBACK !== 'true';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState('standard');
  const [nextCursor, setNextCursor] = useState(null);
  const [audit, setAudit] = useState([]);
  const [selectedService, setSelectedService] = useState('all');
  const [metrics, setMetrics] = useState(null);
  const [showIndividualReports, setShowIndividualReports] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Moderation modal / action state
  const [activeReviewItem, setActiveReviewItem] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [reviewStatus, setReviewStatus] = useState(FEEDBACK_STATUSES.REVIEWED);
  const reviewRequest = useRef(0);
  const closeReview = useCallback(() => { reviewRequest.current += 1; setActiveReviewItem(null); }, []);
  const modalRef = useModalKeyboard(Boolean(activeReviewItem), closeReview);

  const loadData = useCallback(async (cursor, signal) => {
    if (localDemo) return { metrics: getAggregateFrictionMetrics(null, selectedService),
      items: queryFeedbackForModeration(null, { serviceId: selectedService, status: statusFilter,
        category: categoryFilter, searchQuery: search }), nextCursor: null };
    const params = new URLSearchParams({ view: 'moderation', queue, status: statusFilter });
    if (cursor) params.set('cursor', cursor);
    const [aggregate, page] = await Promise.all([
      feedbackRequest({ signal }),
      feedbackRequest({ query: `?${params}`, getToken: getSessionToken, signal }),
    ]);
    return { metrics: { ...aggregate, pendingCount: page.items.filter(item => item.status === 'pending').length,
      reviewedCount: page.items.filter(item => item.status !== 'pending').length }, ...page };
  }, [localDemo, getSessionToken, selectedService, statusFilter, categoryFilter, search, queue]);

  const applyData = useCallback((data, append = false) => {
    setMetrics(data.metrics);
    setFeedbackList(previous => append ? [...new Map([...previous, ...data.items].map(item => [item.id, item])).values()] : data.items);
    setNextCursor(data.nextCursor);
    setError(''); setBusy(false);
  }, []);

  const refreshData = async (cursor = null) => {
    setBusy(true); setError('');
    try { applyData(await loadData(cursor), Boolean(cursor)); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(null, controller.signal).then(data => {
      if (!controller.signal.aborted) applyData(data);
    }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setBusy(false); } });
    return () => controller.abort();
  }, [loadData, applyData]);

  const handleOpenReview = async (item) => {
    const request = ++reviewRequest.current;
    setActiveReviewItem(item); setAudit([]);
    setAdminNote(item.adminNotes || '');
    setReviewStatus(item.status === FEEDBACK_STATUSES.PENDING ? FEEDBACK_STATUSES.REVIEWED : item.status);
    if (!localDemo) {
      try { const result = await feedbackRequest({ query: `?view=audit&id=${item.id}`, getToken: getSessionToken });
        if (reviewRequest.current === request) setAudit(result.items); }
      catch (err) { setError(err.message); }
    }
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!activeReviewItem || busy) return;
    setBusy(true); setError('');
    try {
      if (localDemo) reviewBottleneckFeedback(activeReviewItem.id, reviewStatus, 'Demo Moderator', adminNote);
      else await feedbackRequest({ method: 'PATCH', getToken: getSessionToken,
        body: { id: activeReviewItem.id, status: reviewStatus, revision: activeReviewItem.revision, notes: adminNote } });
      setActiveReviewItem(null);
      await refreshData();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleReset = () => {
    if (window.confirm('Reset bottleneck feedback records to default seed demonstration data?')) {
      resetFeedbackDefaults();
      refreshData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <p role="status">{localDemo ? 'Local demonstration records; these have not been sent to maintainers.' :
        'Shared queue, oldest first. Queue counters cover the loaded page; public analytics cover addressed reports in the last 7 days with small groups suppressed.'}</p>
      {error && <p role="alert">{error}</p>}
      {!localDemo && <label>Moderation queue <select value={queue} onChange={event => setQueue(event.target.value)}>
        <option value="standard">Standard reports</option><option value="suspected_spam">Suspected spam</option>
      </select></label>}
      <label>Search loaded reports <input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {nextCursor && <button type="button" disabled={busy} onClick={() => refreshData(nextCursor)}>Load next oldest reports</button>}
      {/* Header and Controls */}
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
            Service Process Bottleneck Feedback Loop
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Aggregated friction analysis identifying confusing steps, broken links, and accessibility roadblocks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'rgba(0, 0, 0, 0.25)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Catalog Services</option>
            {MOCK_SERVICES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={localDemo ? handleReset : () => refreshData()}
            disabled={busy}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', display: 'flex', gap: '0.35rem' }}
            title={localDemo ? "Reset local demonstration" : "Refresh shared queue"}
          >
            <RefreshCw size={14} /> {localDemo ? "Reset Seed" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Aggregate Overview KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-main)' }}>
            {metrics ? metrics.totalReports : 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Total Friction Reports
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: '800',
              color: (metrics?.averageFrictionScore || 0) >= 3.5 ? '#ef4444' : '#f59e0b',
            }}
          >
            {metrics ? metrics.averageFrictionScore : 0} / 5
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Avg Friction Roadblock Score
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>
            {localDemo ? metrics?.pendingCount || 0 : feedbackList.filter(item => item.status === 'pending').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Awaiting Review
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981' }}>
            {localDemo ? metrics?.reviewedCount || 0 : feedbackList.filter(item => item.status !== 'pending').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Reviewed & Addressed
          </div>
        </div>
      </div>

      {/* Default Aggregate View: Category Breakdown & Friction Roadblocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Category Distribution Card */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Friction Categories Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FEEDBACK_CATEGORIES.map((cat) => {
              const count = metrics?.categoryCounts?.[cat.id] || 0;
              const total = metrics?.totalReports || 1;
              const pct = Math.round((count / total) * 100);

              return (
                <div key={cat.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '99px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--accent-main)',
                        borderRadius: '99px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Journey Bottlenecks Card */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Top Problematic Steps in Journey
          </h3>
          {metrics?.stepBreakdown && metrics.stepBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {metrics.stepBreakdown.slice(0, 5).map((stepItem, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{stepItem.step}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                      {stepItem.count} citizen report{stepItem.count > 1 ? 's' : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '99px',
                      background: stepItem.averageFriction >= 4 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: stepItem.averageFriction >= 4 ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {stepItem.averageFriction} / 5
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
              No step-specific friction recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Privacy Guarantee Banner: Free Text Suppressed By Default */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '0.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={20} color="var(--accent-main)" />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Data Minimization & Aggregation Guarantee
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              Individual free-text reports are hidden by default to prevent incidental exposure of unredacted personal details.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowIndividualReports(!showIndividualReports)}
          className="btn btn-secondary"
          style={{
            padding: '0.45rem 0.95rem',
            fontSize: '0.825rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          {showIndividualReports ? (
            <>
              <EyeOff size={15} /> Hide Individual Moderation Queue
            </>
          ) : (
            <>
              <Eye size={15} /> Show Individual Moderation Queue ({feedbackList.length})
            </>
          )}
        </button>
      </div>

      {/* Opt-in Individual Moderation Queue */}
      {showIndividualReports && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
              Individual Feedback Moderation Queue
            </h3>

            {/* Moderation Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              >
                {localDemo && <option value="all">All Review Statuses</option>}
                <option value={FEEDBACK_STATUSES.PENDING}>Pending</option>
                <option value={FEEDBACK_STATUSES.REVIEWED}>Reviewed</option>
                <option value={FEEDBACK_STATUSES.ADDRESSED}>Addressed</option>
                <option value={FEEDBACK_STATUSES.DISMISSED}>Dismissed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              >
                <option value="all">All Categories</option>
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List of items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {feedbackList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                No feedback reports match your current filter criteria.
              </div>
            ) : (
              feedbackList.filter(item => (selectedService === 'all' || item.serviceId === selectedService)
                && (categoryFilter === 'all' || item.category === categoryFilter)
                && (!search || `${item.serviceName} ${item.notes}`.toLowerCase().includes(search.toLowerCase()))).map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.65rem',
                    border: '1px solid var(--border-light)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '99px',
                          textTransform: 'uppercase',
                          background: item.status === FEEDBACK_STATUSES.PENDING ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: item.status === FEEDBACK_STATUSES.PENDING ? '#f59e0b' : '#10b981',
                          marginRight: '0.5rem',
                        }}
                      >
                        {item.status}
                      </span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.serviceName}</strong>
                      {item.stepTitle && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-main)', marginLeft: '0.5rem' }}>
                          — {item.stepTitle}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(item)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        Moderation Action
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    <strong>Category:</strong> {FEEDBACK_CATEGORIES.find((c) => c.id === item.category)?.label || item.category} |{' '}
                    <strong>Friction Rating:</strong> {item.rating} / 5
                  </div>

                  {item.notes && (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.45rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        fontStyle: 'italic',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      "{item.notes}"
                    </div>
                  )}

                  {item.adminNotes && (
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.4rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        borderLeft: '3px solid #10b981',
                        fontSize: '0.775rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <strong style={{ color: '#10b981' }}>Moderator Response ({item.reviewedBy}):</strong> {item.adminNotes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Moderation Review Modal */}
      {activeReviewItem && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-review-title"
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
              background: 'var(--bg-secondary, #0a0a0a)',
              color: 'var(--text-primary, #fff)',
              maxWidth: '520px',
              maxHeight: 'calc(100dvh - 2rem)',
              overflowY: 'auto',
              width: '100%',
              borderRadius: '1rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 id="feedback-review-title" style={{ margin: 0, fontSize: '1.1rem' }}>
              Moderate Process Feedback: {activeReviewItem.serviceName}
            </h3>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {activeReviewItem.overdue && <strong>Moderation SLA overdue. </strong>}
              Reported issue: <strong>{activeReviewItem.category}</strong> (Friction: {activeReviewItem.rating}/5)
            </div>

            {!localDemo && <div>
              <p>Attachment: {activeReviewItem.attachment?.state || 'none'}</p>
              {activeReviewItem.attachment?.state === 'clean' && <button type="button" onClick={async () => {
                try { const result = await feedbackRequest({ query: `?view=attachment&id=${activeReviewItem.id}`, getToken: getSessionToken });
                  window.location.assign(result.url); } catch (err) { setError(err.message); }
              }}>Download scanner-approved attachment</button>}
              <p>Audit history (up to 50 newest events):</p>
              <ul>{audit.map(entry => <li key={entry.id}>{entry.status || entry.verdict} — {entry.reviewedBy || entry.scanner} — revision {entry.revision ?? 'scan'}</li>)}</ul>
            </div>}
            {activeReviewItem.notes && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                }}
              >
                "{activeReviewItem.notes}"
              </div>
            )}

            {error && <p role="alert">{error}</p>}
            <form onSubmit={handleSaveReview} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Update Review Status
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value={FEEDBACK_STATUSES.REVIEWED}>Reviewed (Acknowledged)</option>
                  <option value={FEEDBACK_STATUSES.ADDRESSED}>Addressed (Guide updated / Fix deployed)</option>
                  <option value={FEEDBACK_STATUSES.DISMISSED}>Dismissed (Out of scope / non-actionable)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Action / Resolution Notes
                </label>
                <textarea
                  maxLength={1500}
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Describe changes made to the guide or reasons for resolution..."
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={closeReview}
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 1rem' }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn btn-primary" style={{ padding: '0.45rem 1.25rem' }}>
                  Save Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottleneckFeedbackDashboard;
