import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Mail,
  ExternalLink,
} from 'lucide-react';
import {
  createShareableDirectoryView,
  DIRECTORY_EXPIRY_OPTIONS,
} from '../../services/shareableDirectoryService';

export default function ShareDirectoryModal({
  isOpen,
  onClose,
  currentFilters = {},
}) {
  const [title, setTitle] = useState('Curated Civic Services');
  const [description, setDescription] = useState('Recommended government schemes matching these criteria.');
  const [expiry, setExpiry] = useState(DIRECTORY_EXPIRY_OPTIONS.DAYS_7);
  const [createdShare, setCreatedShare] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://civichelpsetu.gov.in';

  const handleGenerate = () => {
    const record = createShareableDirectoryView(currentFilters, {
      title,
      description,
      expiry,
    });
    setCreatedShare(record);
  };

  const shareUrl = createdShare
    ? `${origin}/shared-directory/${createdShare.token}`
    : '';

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Curated Civic Services: ${title}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is a curated list of government services from Civic Help Setu:\n${shareUrl}\n\n${description}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
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
          maxWidth: '520px',
          width: '100%',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Share2 className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Share This Filtered List
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

        {/* Security Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
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
          <span>Shared views bundle catalogue query parameters only. No private profile or applicant data is exposed.</span>
        </div>

        {createdShare ? (
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
                Shareable Link Ready
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
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
                    gap: '0.3rem',
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>
                  {createdShare.expiresAt
                    ? `Expires: ${new Date(createdShare.expiresAt).toLocaleDateString()}`
                    : 'Permanent (No Expiry)'}
                </span>

                <button
                  type="button"
                  onClick={handleEmailShare}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-main)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  <Mail className="w-3.5 h-3.5" /> Share via Email
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                List Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                Note for Recipients
              </label>
              <textarea
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                Expiry Window
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value={DIRECTORY_EXPIRY_OPTIONS.HOURS_24}>24 Hours</option>
                <option value={DIRECTORY_EXPIRY_OPTIONS.DAYS_7}>7 Days (Recommended)</option>
                <option value={DIRECTORY_EXPIRY_OPTIONS.DAYS_30}>30 Days</option>
                <option value={DIRECTORY_EXPIRY_OPTIONS.NEVER}>Permanent (No Expiry)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.4rem',
                  background: 'var(--accent-main)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Share2 className="w-4 h-4" /> Create Share Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
