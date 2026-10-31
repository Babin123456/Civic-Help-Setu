import { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2, DownloadCloud, Clock, ShieldCheck, Trash2 } from 'lucide-react';
import {
  isServiceCachedOffline,
  toggleServiceOffline,
  getCachedService,
  getOfflineSnapshotStats
} from '../../services/offlineCacheService';

export default function OfflineCacheActionCard({ service }) {
  if (!service || !service.id) return null;

  const [isCached, setIsCached] = useState(() => isServiceCachedOffline(service.id));
  const [cachedDetails, setCachedDetails] = useState(() => getCachedService(service.id));
  const [stats, setStats] = useState(() => getOfflineSnapshotStats());

  useEffect(() => {
    setIsCached(isServiceCachedOffline(service.id));
    setCachedDetails(getCachedService(service.id));
    setStats(getOfflineSnapshotStats());
  }, [service.id]);

  const handleToggle = () => {
    const result = toggleServiceOffline(service);
    setIsCached(result.cached);
    setCachedDetails(getCachedService(service.id));
    setStats(getOfflineSnapshotStats());
  };

  const formattedCachedTime = cachedDetails?.cachedAt
    ? new Date(cachedDetails.cachedAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <section
      role="region"
      aria-labelledby="offline-cache-title"
      className="card-glass"
      style={{
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        border: isCached ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-light, #334155)',
        background: isCached ? 'rgba(16, 185, 129, 0.05)' : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
        marginBottom: '1.5rem',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.625rem',
              background: isCached ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.12)',
              color: isCached ? '#10b981' : 'var(--accent-main, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isCached ? <CheckCircle2 size={22} /> : <WifiOff size={20} />}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3
                id="offline-cache-title"
                style={{
                  fontSize: '1rem',
                  fontWeight: '700',
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                Offline In-Office Access
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: isCached ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: isCached ? '#10b981' : 'var(--text-tertiary)',
                }}
              >
                {isCached ? 'Saved Locally' : 'Online Only'}
              </span>
            </div>

            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {isCached
                ? `Available offline without internet connection (Synced: ${formattedCachedTime || 'Recently'}).`
                : 'Pre-cache this guide to access procedures & checklists in network-shadowed government offices.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={handleToggle}
            aria-label={isCached ? `Remove ${service.name} from offline cache` : `Save ${service.name} for offline visit`}
            className={isCached ? 'btn btn-secondary' : 'btn btn-primary'}
            style={{
              padding: '0.5rem 0.9rem',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            {isCached ? (
              <>
                <Trash2 size={14} color="#ef4444" />
                <span>Remove Cache</span>
              </>
            ) : (
              <>
                <DownloadCloud size={14} />
                <span>Save for Offline Visit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
