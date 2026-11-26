import { X, Inbox, RefreshCw, Trash2 } from 'lucide-react';
import {
  getOfflineDraftQueue,
  removeOfflineDraft,
  syncOfflineDrafts,
} from '../../services/upFloodResponseService';

export default function OfflineDraftQueueModal({
  isOpen,
  onClose,
  isOnline,
  onSyncComplete,
}) {
  if (!isOpen) return null;

  const drafts = getOfflineDraftQueue();

  const handleSync = () => {
    const res = syncOfflineDrafts();
    if (onSyncComplete) onSyncComplete(res);
  };

  const handleRemove = (id) => {
    removeOfflineDraft(id);
    if (onSyncComplete) onSyncComplete();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #0f172a)',
          color: 'var(--text-primary)',
          borderRadius: '0.75rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border-light, #334155)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 id="draft-modal-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Inbox size={20} color="var(--accent, #38bdf8)" />
              Offline Incident Draft Queue
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Network Status: {isOnline ? <span style={{ color: '#10b981' }}>● Online</span> : <span style={{ color: '#eab308' }}>● Offline</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
            <Inbox size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.6 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Your offline draft queue is empty.</p>
            <span style={{ fontSize: '0.78rem' }}>
              When you submit reports without connectivity, they will safely queue here.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>{drafts.length}</strong> report(s) waiting to sync
              </span>
              <button
                type="button"
                onClick={handleSync}
                disabled={!isOnline}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  opacity: isOnline ? 1 : 0.6,
                }}
              >
                <RefreshCw size={13} /> Sync All to Live Board
              </button>
            </div>

            {drafts.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card-hover, #1e293b)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.88rem', display: 'block' }}>
                    {d.payload?.locality || 'Unknown Locality'}
                  </strong>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {d.payload?.district} • {d.payload?.incidentType} ({d.payload?.depthCategory})
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Queued: {new Date(d.queuedAt).toLocaleTimeString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(d.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    padding: '0.4rem',
                  }}
                  title="Discard Draft"
                  aria-label="Discard Draft"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
