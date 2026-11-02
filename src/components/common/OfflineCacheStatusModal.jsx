import React, { useState, useEffect } from 'react';
import { X, Wifi, WifiOff, HardDrive, RefreshCw, CheckCircle2, Trash2, DownloadCloud, FileText } from 'lucide-react';
import { useNetwork } from '../../context/NetworkContext';
import { getOfflineSnapshotStats, getOfflineCachedData, cacheAllSavedGuides, clearOfflineCache } from '../../services/offlineCacheService';
import { Link } from 'react-router-dom';

const OfflineCacheStatusModal = ({ isOpen, onClose }) => {
  const { isOnline, checkConnection, isChecking } = useNetwork();
  const [stats, setStats] = useState(() => getOfflineSnapshotStats());
  const [cachedData, setCachedData] = useState(() => getOfflineCachedData());
  const [syncMessage, setSyncMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setStats(getOfflineSnapshotStats());
      setCachedData(getOfflineCachedData());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncAll = () => {
    const result = cacheAllSavedGuides();
    if (result.success) {
      setStats(getOfflineSnapshotStats());
      setCachedData(getOfflineCachedData());
      setSyncMessage(`Successfully cached ${result.count} service guides for offline use!`);
      setTimeout(() => setSyncMessage(null), 3500);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all offline cached guides from this device?')) {
      clearOfflineCache();
      setStats(getOfflineSnapshotStats());
      setCachedData(getOfflineCachedData());
      setSyncMessage('Offline cache cleared.');
      setTimeout(() => setSyncMessage(null), 2500);
    }
  };

  const cachedServiceList = Object.values(cachedData.services || {});

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex',  alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: '5.5rem', paddingRight: '1rem' }}>
      <div 
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          padding: '2rem',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--glass-bg)',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '0.45rem',
            borderRadius: '50%',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isOnline ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isOnline ? <Wifi size={24} /> : <WifiOff size={24} />}
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Offline Office-Visit Readiness
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Status: <strong style={{ color: isOnline ? '#10b981' : '#ef4444' }}>{isOnline ? 'Connected to Internet' : 'Offline Mode Active'}</strong>
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>Guides</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-main, #3b82f6)' }}>
              {stats.serviceCount}
            </p>
          </div>
          <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>Tokens</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
              {stats.applicationCount}
            </p>
          </div>
          <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>Local Disk</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {stats.sizeInKb} KB
            </p>
          </div>
        </div>

        {/* Sync message banner */}
        {syncMessage && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.875rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} /> {syncMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSyncAll}
            className="btn btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.875rem' }}
          >
            <DownloadCloud size={16} /> Pre-cache Saved Guides
          </button>
          <button
            type="button"
            onClick={checkConnection}
            disabled={isChecking}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.875rem' }}
          >
            <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} /> Test Ping
          </button>
        </div>

        {/* Cached Services List */}
        <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '1.25rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', margin: '0 0 0.75rem 0', color: 'var(--text-primary)' }}>
            Available Offline on this Device
          </h4>

          {cachedServiceList.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', background: 'var(--glass-bg-subtle)', borderRadius: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}>No guides cached yet.</p>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                Save services from the directory and click "Pre-cache Saved Guides" before visiting government offices.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {cachedServiceList.map((srv) => (
                <div 
                  key={srv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-main)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} color="var(--accent-main, #3b82f6)" />
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>{srv.name}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>Cached ✓</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info & clear */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            {stats.lastSync ? `Last synced: ${new Date(stats.lastSync).toLocaleTimeString()}` : 'Not synced yet'}
          </span>
          {stats.serviceCount > 0 && (
            <button
              type="button"
              onClick={handleClear}
              style={{ background: 'none', border: 'none', color: 'var(--error, #ef4444)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Trash2 size={13} /> Clear Cache
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineCacheStatusModal;
