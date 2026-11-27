import { useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  WifiOff,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  listMonitoredPortals,
  listPortalReviewQueue,
  recordPortalCheck,
  reviewPortalChange,
} from '../services/portalChangeMonitorService';

const STATUS_BADGE = {
  HEALTHY: { bg: '#dcfce7', color: '#166534' },
  BROKEN_LINK: { bg: '#fee2e2', color: '#991b1b' },
  REDIRECTED: { bg: '#fef9c3', color: '#854d0e' },
  CONTENT_CHANGED: { bg: '#e0f2fe', color: '#0369a1' },
};

export default function PortalChangeMonitorWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const [portals, setPortals] = useState(() => {
    try {
      return listMonitoredPortals();
    } catch {
      return [];
    }
  });
  const [reviewQueue, setReviewQueue] = useState(() => {
    try {
      return listPortalReviewQueue();
    } catch {
      return [];
    }
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isLoading] = useState(false);

  const refresh = useCallback(() => {
    try {
      setPortals(listMonitoredPortals());
      setReviewQueue(listPortalReviewQueue());
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load portal monitor state.');
    }
  }, []);

  const handleSimulateCheck = (portal, overrides = {}) => {
    setErrorMsg('');
    try {
      recordPortalCheck({
        sourceId: portal.sourceId,
        url: portal.url,
        sourceOwner: portal.sourceOwner,
        jurisdiction: portal.jurisdiction,
        httpStatus: overrides.httpStatus ?? 200,
        redirectedTo: overrides.redirectedTo ?? null,
        contentSample: overrides.contentSample ?? '',
        actorId: user?.id || 'monitor_local',
      });
      refresh();
      setAnnouncement(`Checked ${portal.sourceOwner} (${portal.url}).`);
    } catch (err) {
      setErrorMsg(err.message || 'Portal check failed.');
    }
  };

  const handleReview = (changeId, decision) => {
    setErrorMsg('');
    try {
      reviewPortalChange({
        changeId,
        reviewerId: user?.id || 'reviewer_local',
        reviewerRole: 'reviewer',
        decision,
        rationale: decision === 'APPROVE' ? 'Verified against official gazette' : 'False alarm',
      });
      refresh();
      setAnnouncement(`Portal change ${changeId} ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Review failed.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1150px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Activity size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Government Portal Change Detection &amp; Broken-Link Monitor
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Monitors official service portals for HTTP health, redirects, and meaningful content fingerprint changes with source ownership and human review queues.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: live HTTP checks paused; cached portal health and review queue remain accessible.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Monitored Portals */}
      <section aria-label="Monitored Government Portals" style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
          Monitored Official Sources ({portals.length})
        </h2>

        {isLoading ? (
          <p role="status">Loading monitored portals...</p>
        ) : portals.length === 0 ? (
          <p>No monitored portals configured.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {portals.map((p) => {
              const badge = STATUS_BADGE[p.healthStatus] || STATUS_BADGE.HEALTHY;
              return (
                <div key={p.sourceId} style={{ padding: '0.9rem 1rem', borderRadius: '0.6rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong>{p.sourceOwner}</strong> ({p.jurisdiction})
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary, #2563eb)' }}>
                          {p.url} <ExternalLink size={11} style={{ display: 'inline' }} />
                        </a>{' '}
                        &bull; Last Checked: {new Date(p.lastCheckedAt).toLocaleString()} &bull; Fingerprint: <code>{p.contentFingerprint}</code>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: badge.bg, color: badge.color }}>
                      {p.healthStatus} (HTTP {p.httpStatus})
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => handleSimulateCheck(p, { httpStatus: 200 })}
                      disabled={!isOnline}
                      style={{ padding: '0.25rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)', background: 'transparent', fontSize: '0.75rem', cursor: isOnline ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <RefreshCw size={12} aria-hidden="true" /> Run Health Check
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Human Review Queue */}
      <section aria-label="Portal Change Human Review Queue">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
          Human Review Queue ({reviewQueue.length})
        </h2>
        {reviewQueue.length === 0 ? (
          <div style={{ padding: '1.5rem', borderRadius: '0.6rem', border: '1px dashed var(--border-main, #cbd5e1)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            No broken links, redirects, or meaningful content changes awaiting human review.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {reviewQueue.map((item) => (
              <div key={item.changeId} style={{ padding: '0.8rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong>{item.sourceOwner}</strong> — {item.changeReason}
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Status: <strong>{item.status}</strong> &bull; Detected: {new Date(item.detectedAt).toLocaleString()}
                  </div>
                </div>
                {item.status === 'PENDING_REVIEW' && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button type="button" onClick={() => handleReview(item.changeId, 'APPROVE')} style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <CheckCircle2 size={12} aria-hidden="true" /> Approve
                    </button>
                    <button type="button" onClick={() => handleReview(item.changeId, 'REJECT')} style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <XCircle size={12} aria-hidden="true" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
