import React, { useMemo, useState } from 'react';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  buildQrMatrix,
  isSafeShareableQrPayload,
  downloadProfileQrHandout,
} from '../../services/profileQrService';

export default function ProfileQrCard({
  shareUrl,
  citizenName = 'Citizen Applicant',
  expiryDate,
  isRevoked = false,
}) {
  const [copied, setCopied] = useState(false);

  const isValidUrl = useMemo(() => isSafeShareableQrPayload(shareUrl), [shareUrl]);

  const qrData = useMemo(() => {
    if (!isValidUrl || isRevoked) return null;
    try {
      return buildQrMatrix(shareUrl);
    } catch {
      return null;
    }
  }, [shareUrl, isValidUrl, isRevoked]);

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadHandout = () => {
    downloadProfileQrHandout({
      url: shareUrl,
      citizenName,
      expiryText: expiryDate ? `Expires on ${new Date(expiryDate).toLocaleDateString()}` : 'No expiration configured',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isRevoked) {
    return (
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '0.65rem',
          padding: '1.25rem',
          textAlign: 'center',
          color: '#dc2626',
        }}
      >
        <AlertTriangle className="w-8 h-8" style={{ margin: '0 auto 0.5rem' }} />
        <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: '700' }}>QR Code Deactivated</h4>
        <p style={{ fontSize: '0.825rem', margin: 0, color: 'var(--text-secondary)' }}>
          This profile share link has been revoked. The previous QR code no longer resolves to profile data.
        </p>
      </div>
    );
  }

  if (!qrData) {
    return null;
  }

  return (
    <div
      className="profile-qr-card"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <QrCode className="w-5 h-5 text-indigo-500" />
        <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          In-Person Verification QR Pass
        </h4>
      </div>

      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '380px' }}>
        Scan at civic camps or help desks to open your read-only profile view on mobile.
      </p>

      {/* SVG QR Code */}
      <div
        style={{
          background: '#ffffff',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          display: 'inline-block',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="QR Code for verified citizen profile"
          viewBox={`0 0 ${qrData.size} ${qrData.size}`}
          width="180"
          height="180"
          shapeRendering="crispEdges"
        >
          <rect width="100%" height="100%" fill="#ffffff" />
          <path d={qrData.path} fill="#0f172a" />
        </svg>
      </div>

      {/* Expiry Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.75rem',
          fontWeight: '600',
          padding: '0.25rem 0.65rem',
          borderRadius: '9999px',
          background: 'rgba(245, 158, 11, 0.1)',
          color: '#d97706',
        }}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>
          {expiryDate
            ? `Expires: ${new Date(expiryDate).toLocaleDateString()}`
            : 'Active until revoked'}
        </span>
      </div>

      {/* Human-readable Fallback URL */}
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
          {shareUrl}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy share link URL"
          style={{
            background: 'none',
            border: 'none',
            color: copied ? '#10b981' : 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.2rem',
          }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleDownloadHandout}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '0.4rem',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            fontSize: '0.825rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Download className="w-4 h-4" />
          Download Pass (HTML)
        </button>

        <button
          type="button"
          onClick={handlePrint}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '0.4rem',
            border: '1px solid var(--accent-main)',
            background: 'var(--accent-main)',
            color: '#ffffff',
            fontSize: '0.825rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Printer className="w-4 h-4" />
          Print / PDF
        </button>
      </div>

      {/* Privacy reminder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginTop: '0.25rem',
        }}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span>Payload encodes only the revocable URL. No personal identity numbers or documents are inside the QR code.</span>
      </div>
    </div>
  );
}
