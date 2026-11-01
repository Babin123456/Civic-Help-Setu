import React, { useState } from 'react';
import { X, Share2, Copy, Check, MessageCircle, Send, Mail, QrCode } from 'lucide-react';
import QRCodeView from '../common/QRCodeView';
import { checklistExportService } from '../../services/checklistExportService';
import { safeHttpUrl } from '../../utils/safeContent';

const ShareServiceModal = ({ isOpen, onClose, service }) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen || !service) return null;

  const currentUrl = `${window.location.origin}/services/${service.id}`;

  const handleCopy = () => {
    const text = checklistExportService.formatTextSummary(service);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="card-glass animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Share2 size={20} />
            </div>
            <div>
              <h2 id="share-modal-title" style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Share Service Guide
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Send checklist and document instructions to family or mobile.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Channels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <a
              href={safeHttpUrl(checklistExportService.getWhatsAppShareUrl(service)) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem',
                textDecoration: 'none',
                borderRadius: '0.75rem',
                color: '#25D366'
              }}
            >
              <MessageCircle size={24} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>WhatsApp</span>
            </a>

            <a
              href={safeHttpUrl(checklistExportService.getTelegramShareUrl(service)) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem',
                textDecoration: 'none',
                borderRadius: '0.75rem',
                color: '#0088cc'
              }}
            >
              <Send size={24} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>Telegram</span>
            </a>

            <a
              href={safeHttpUrl(checklistExportService.getEmailShareUrl(service)) || undefined}
              className="btn btn-outline"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem',
                textDecoration: 'none',
                borderRadius: '0.75rem',
                color: 'var(--accent-main)'
              }}
            >
              <Mail size={24} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>Email</span>
            </a>
          </div>

          {/* Copy Full Dossier */}
          <div
            style={{
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Copy Full Checklist & Notes
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Includes requirements, documents list, and office visit tips.
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem', flexShrink: 0 }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Mobile QR Toggle */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-main)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <QrCode size={16} />
              <span>{showQR ? 'Hide Mobile QR Code' : 'Show Mobile QR Code (Instant Scan)'}</span>
            </button>

            {showQR && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <QRCodeView url={currentUrl} size={160} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareServiceModal;
