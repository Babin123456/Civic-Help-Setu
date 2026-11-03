import React, { useState, useEffect } from 'react';
import {
  Share2,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Clock,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  createShareableProfile,
  revokeSharedProfile,
  getActiveShareForUser,
  SHARE_EXPIRY_OPTIONS,
} from '../../services/shareableProfileService';

export default function ShareableProfileModal({
  isOpen,
  onClose,
  currentUser,
  profileData,
}) {
  const [expiry, setExpiry] = useState(SHARE_EXPIRY_OPTIONS.DAYS_7);
  const [copied, setCopied] = useState(false);
  const [activeShare, setActiveShare] = useState(null);
  const [visibility, setVisibility] = useState({
    showFullName: true,
    showLocation: true,
    showCategory: true,
    showOccupation: false,
    showSavedServices: true,
    showApplicationMilestones: true,
    showReadinessScore: true,
  });

  const userId = currentUser?.id || currentUser?.username || 'current-user';

  useEffect(() => {
    if (isOpen) {
      const existing = getActiveShareForUser(userId);
      if (existing) {
        setActiveShare(existing);
        setVisibility(existing.visibility || visibility);
      } else {
        setActiveShare(null);
      }
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleCreateShare = () => {
    const newShare = createShareableProfile(userId, profileData, {
      expiry,
      visibility,
    });
    setActiveShare(newShare);
  };

  const handleRevokeShare = () => {
    if (activeShare?.token) {
      revokeSharedProfile(activeShare.token);
      setActiveShare(null);
    }
  };

  const toggleVisibility = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const shareUrl = activeShare
    ? `${window.location.origin}/shared-profile/${activeShare.token}`
    : '';

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--card-bg)',
          borderRadius: '0.75rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Share2 className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Privacy-Controlled Profile Sharing
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Security explanation banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#059669',
            fontSize: '0.825rem',
            marginBottom: '1.25rem',
          }}
        >
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>
            Private documents, identity numbers, and contact details are permanently excluded from all shared views.
          </span>
        </div>

        {/* Active share view */}
        {activeShare ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                padding: '1rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Active Read-Only Share Link
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '0.375rem',
                    background: copied ? '#10b981' : 'var(--accent-main)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  {activeShare.expiresAt
                    ? `Expires: ${new Date(activeShare.expiresAt).toLocaleDateString()}`
                    : 'No expiry set'}
                </span>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: 'var(--accent-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    textDecoration: 'none',
                    fontWeight: '600',
                  }}
                >
                  Preview Shared View <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleRevokeShare}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Trash2 className="w-4 h-4" />
                Revoke Access Immediately
              </button>

              <button
                type="button"
                onClick={handleCreateShare}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate Link
              </button>
            </div>
          </div>
        ) : (
          /* Create New Share Flow */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                Select Section Visibility
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { key: 'showFullName', label: 'Full Name' },
                  { key: 'showLocation', label: 'State & District Location' },
                  { key: 'showCategory', label: 'Social Category' },
                  { key: 'showOccupation', label: 'Occupation' },
                  { key: 'showSavedServices', label: 'Saved Services Portfolio' },
                  { key: 'showApplicationMilestones', label: 'Active Application Progress' },
                  { key: 'showReadinessScore', label: 'Calculated Readiness Score' },
                ].map(({ key, label }) => {
                  const isVisible = visibility[key];
                  return (
                    <div
                      key={key}
                      onClick={() => toggleVisibility(key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.45rem',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary, rgba(0,0,0,0.01))',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{label}</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: isVisible ? '#10b981' : 'var(--text-secondary)',
                        }}
                      >
                        {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {isVisible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.4rem' }}>
                Link Expiry Window
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                <option value={SHARE_EXPIRY_OPTIONS.HOURS_24}>24 Hours</option>
                <option value={SHARE_EXPIRY_OPTIONS.DAYS_7}>7 Days (Recommended)</option>
                <option value={SHARE_EXPIRY_OPTIONS.DAYS_30}>30 Days</option>
                <option value={SHARE_EXPIRY_OPTIONS.NEVER}>No Expiration</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateShare}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '0.45rem',
                  background: 'var(--accent-main)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Share2 className="w-4 h-4" />
                Generate Privacy-Safe Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
