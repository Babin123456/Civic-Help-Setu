import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function PublicToiletReviewQueue() {
  const { user, getSessionToken } = useAuth();
  return <PublicToiletQueue key={`${user?.id || 'guest'}:${user?.role || 'none'}`} getSessionToken={getSessionToken} />;
}

function PublicToiletQueue({ getSessionToken }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const loadPage = useCallback(async (epoch, cursor = null) => {
    try {
      const token = await getSessionToken?.();
      if (generation.current !== epoch) return;
      setLoading(true);
      setError('');
      if (!token) throw new Error('Sign in as an administrator to load the moderation queue.');
      if (generation.current !== epoch) return;
      const query = new URLSearchParams({ view: 'moderation', limit: '20' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch('/api/public-toilets?' + query, { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw new Error('The moderation queue is unavailable. Please retry.');
      const data = await response.json();
      if (generation.current !== epoch) return;
      setItems(previous => cursor
        ? [...previous, ...data.items.filter(item => !previous.some(old => old.id === item.id))]
        : data.items);
      setNextCursor(data.nextCursor);
    } catch (failure) {
      if (generation.current === epoch) setError(failure.message);
    } finally {
      if (generation.current === epoch) setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    const reference = generation;
    const epoch = ++reference.current;
    loadPage(epoch);
    return () => { reference.current = epoch + 1; };
  }, [loadPage]);

  const review = async (id, decision) => {
    const epoch = generation.current;
    try {
      const token = await getSessionToken?.();
      if (!token) throw new Error('Administrator sign-in is required.');
      const response = await fetch('/api/public-toilets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id, decision }),
      });
      if (!response.ok) throw new Error('Review was not saved. Reload the queue and retry.');
      if (generation.current !== epoch) return;
      setItems(previous => previous.map(item => item.id === id ? { ...item, status: decision } : item));
      toast?.success?.('Review saved.');
    } catch (failure) {
      if (generation.current === epoch) setError(failure.message);
    }
  };
  const handleApprove = id => review(id, 'approved');

  const handleDismiss = (id) => {
    return review(id, 'dismissed');
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        marginTop: '2rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-light, #e2e8f0)',
        backgroundColor: 'var(--bg-surface, #ffffff)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Building2 size={20} style={{ color: 'var(--accent-main, #3b82f6)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Public Toilet Moderation &amp; Maintenance Review Queue
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Moderation of citizen sanitation tickets, hygiene feedback, and tracking receipts
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--primary-main, #2563eb)',
            fontWeight: 600,
          }}
        >
          {items.length} Reports Loaded
        </span>
      </div>

      {error && <p role="alert">{error} <button type="button" onClick={() => loadPage(generation.current)}>Retry</button></p>}
      {loading && <p role="status">Loading reports…</p>}
      {!error && !loading && items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem auto', color: 'var(--success-main, #22c55e)' }} />
          No public toilet reports on this page.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--bg-main, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {item.facilityName || item.facilityId}
                  </strong>
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.35rem',
                      backgroundColor: item.reportType === 'maintenance_issue' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(147, 51, 234, 0.1)',
                      color: item.reportType === 'maintenance_issue' ? 'var(--danger-main, #ef4444)' : '#7e22ce',
                      fontWeight: 600,
                    }}
                  >
                    {item.reportType === 'maintenance_issue' ? 'Maintenance Issue' : 'Citizen Feedback'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {item.description}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Receipt Seal: <code style={{ color: 'var(--primary-main)', fontWeight: 600 }}>{item.receiptSeal}</code>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {item.status === 'queued_for_moderation' ? (
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success-main)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={13} /> {item.status}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.id)}
                    disabled={item.status !== 'queued_for_moderation'}
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <XCircle size={13} /> Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {nextCursor && <button type="button" disabled={loading} onClick={() => loadPage(generation.current, nextCursor)}>Load more reports</button>}
    </div>
  );
}
