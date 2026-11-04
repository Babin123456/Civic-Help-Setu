import React, { useState, useEffect } from 'react';
import {
  QrCode,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  ExternalLink,
  Printer,
} from 'lucide-react';
import {
  createOrRotateStatusToken,
  revokeStatusToken,
  buildStatusQrPath,
} from '../../services/applicationStatusQrService';

export default function ApplicationStatusQrModal({
  isOpen,
  onClose,
  application,
  initialRecord,
}) {
  const [tokenRecord, setTokenRecord] = useState(() => {
    if (initialRecord) return initialRecord;
    if (isOpen && application?.id) {
      return createOrRotateStatusToken(application.id, application);
    }
    return null;
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && application?.id && !tokenRecord) {
      const record = createOrRotateStatusToken(application.id, application);
      setTokenRecord(record);
    }
  }, [isOpen, application, tokenRecord]);

  if (!isOpen || !application) return null;

  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://civichelpsetu.gov.in';
  const lookupUrl = tokenRecord
    ? `${origin}/app-status/${tokenRecord.token}`
    : '';

  const qrData = lookupUrl ? buildStatusQrPath(lookupUrl) : null;

  const handleCopy = () => {
    if (!lookupUrl) return;
    navigator.clipboard.writeText(lookupUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleRotate = () => {
    const record = createOrRotateStatusToken(application.id, application);
    setTokenRecord(record);
  };

  const handleRevoke = () => {
    if (tokenRecord?.token) {
      revokeStatusToken(tokenRecord.token);
      setTokenRecord({ ...tokenRecord, revoked: true });
    }
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
          maxWidth: '500px',
          width: '100%',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <QrCode className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Application QR Status Pass
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

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
          Show this QR code at municipal help desks or service counters to quickly look up your application milestone status without entering long IDs.
        </p>

        {tokenRecord && !tokenRecord.revoked && qrData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {/* SVG QR Code */}
            <div
              style={{
                background: '#ffffff',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                display: 'inline-block',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="QR Code for Application Status Lookup"
                viewBox={`0 0 ${qrData.size} ${qrData.size}`}
                width="160"
                height="160"
                shapeRendering="crispEdges"
              >
                <rect width="100%" height="100%" fill="#ffffff" />
                <path d={qrData.path} fill="#0f172a" />
              </svg>
            </div>

            {/* Application Name Pill */}
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {application.serviceName || application.title || 'Civic Application'}
            </div>

            {/* URL Display */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                }}
              >
                {lookupUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copied ? '#10b981' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Privacy Shield */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: '#059669',
                background: 'rgba(16, 185, 129, 0.08)',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'left',
              }}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Opaque token protection: QR encodes no applicant personal details or documents.</span>
            </div>

            {/* Management Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleRotate}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rotate Token
              </button>

              <button
                type="button"
                onClick={handleRevoke}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Deactivate Pass
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#dc2626',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>Pass Deactivated</div>
            <p style={{ fontSize: '0.8rem', margin: '0 0 1rem 0' }}>
              The QR code has been revoked. Nobody scanning it can see your milestone progress.
            </p>
            <button
              type="button"
              onClick={handleRotate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.4rem',
                background: 'var(--accent-main)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Generate New Pass
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
