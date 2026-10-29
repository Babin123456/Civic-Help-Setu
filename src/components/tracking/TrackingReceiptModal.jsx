import { useState, useEffect } from 'react';
import { X, Shield, Printer, Download, QrCode, Copy, Check, FileCheck2 } from 'lucide-react';
import {
  buildReceiptSummary,
  formatReceiptAsPlainText,
  downloadReceiptTextFile
} from '../../services/submissionReceiptService';

const TrackingReceiptModal = ({ app, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !app) return null;

  const summary = buildReceiptSummary(app);

  const handleCopyTextSlip = async () => {
    try {
      const text = formatReceiptAsPlainText(summary);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    downloadReceiptTextFile(summary);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        className="card animate-fade-in civic-receipt-printable"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-main, #0f172a)',
          position: 'relative',
          padding: '2.25rem',
          border: '1px solid var(--border-main, #334155)',
          borderRadius: '1rem',
          boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.3))',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close receipt"
          className="no-print"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--glass-bg, rgba(255, 255, 255, 0.05))',
            border: '1px solid var(--border-light, #334155)',
            color: 'var(--text-secondary, #94a3b8)',
            padding: '0.5rem',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        {/* Receipt Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem', borderBottom: '1px dashed var(--border-main, #334155)', paddingBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--accent-main, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} color="#0f172a" />
            </div>
            <span style={{ fontWeight: '800', fontSize: '1.15rem', color: 'var(--text-primary)' }}>CivicBridge Portal</span>
          </div>
          <h2 id="receipt-title" style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0.25rem 0 0' }}>
            Official Submission Receipt
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            National Public Service Fast-Track Verification Slip
          </p>
        </div>

        {/* Receipt Details Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))', borderRadius: '0.5rem', border: '1px solid var(--border-light, #334155)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Receipt Number
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '1rem', color: 'var(--accent-main, #38bdf8)' }}>
              {summary.receiptNumber}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Service</span>
              <strong style={{ color: 'var(--text-primary)' }}>{summary.serviceName}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Applicant</span>
              <strong style={{ color: 'var(--text-primary)' }}>{summary.applicantName}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Submission Date</span>
              <strong style={{ color: 'var(--text-primary)' }}>{summary.submissionDate}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Target Completion</span>
              <strong style={{ color: 'var(--text-primary)' }}>{summary.targetCompletionDate}</strong>
            </div>
          </div>

          {/* Digital Verification Seal */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--glass-bg-subtle, rgba(255, 255, 255, 0.02))', borderRadius: '0.5rem', border: '1px solid var(--border-light, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block', textTransform: 'uppercase' }}>
                Digital Verification Seal
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                {summary.verificationSeal}
              </span>
              <small style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                Statutory Checksum Validated
              </small>
            </div>
            <div style={{ color: 'var(--accent-main, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={36} aria-label="Digital Verification QR Code" />
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.8rem', borderRadius: '0.4rem' }}>
            ℹ️ {summary.statutoryNotice}
          </div>
        </div>

        {/* Action Controls */}
        <div className="no-print" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopyTextSlip}
            className="btn btn-secondary"
            aria-label="Copy receipt slip text"
            style={{ flex: '1 1 120px', padding: '0.65rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
            <span>{copied ? 'Copied Slip' : 'Copy Text'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-secondary"
            aria-label="Print receipt"
            style={{ flex: '1 1 120px', padding: '0.65rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <Printer size={15} />
            <span>Print Slip</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="btn btn-primary"
            aria-label="Save receipt text file"
            style={{ flex: '1 1 140px', padding: '0.65rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <Download size={15} />
            <span>Download Slip</span>
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .civic-receipt-printable, .civic-receipt-printable * {
            visibility: visible !important;
          }
          .civic-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            box-shadow: none !important;
            padding: 2cm !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TrackingReceiptModal;
