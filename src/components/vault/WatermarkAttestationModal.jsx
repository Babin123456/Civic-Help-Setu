import { useState, useEffect } from 'react';
import { X, ShieldAlert, Stamp, Copy, Check, Printer, FileBadge } from 'lucide-react';
import {
  ATTESTATION_PURPOSE_PRESETS,
  generateAttestationPayload,
} from '../../services/documentWatermarkService';
import { useToast } from '../../context/ToastContext';

export default function WatermarkAttestationModal({ doc, isOpen, onClose, defaultCitizenName = '' }) {
  const { toast } = useToast?.() || {};
  const [purposeId, setPurposeId] = useState('PASSPORT');
  const [customPurpose, setCustomPurpose] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selfAttested, setSelfAttested] = useState(true);
  const [attestationName, setAttestationName] = useState(defaultCitizenName || 'Citizen Applicant');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultCitizenName) {
      setAttestationName(defaultCitizenName);
    }
  }, [defaultCitizenName]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const payload = generateAttestationPayload(doc, {
    purposeId,
    customPurpose,
    recipientOrganization: recipient,
    selfAttested,
    attestationName,
  });

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.formattedSummary);
        setCopied(true);
        toast?.success?.('Watermarked attestation summary copied to clipboard.');
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      toast?.error?.('Could not copy to clipboard.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watermark-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          padding: '1.75rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.6rem',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main)',
              }}
            >
              <Stamp size={20} />
            </div>
            <div>
              <h2 id="watermark-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Watermark & Purpose Attestation
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Stamp usage restrictions on <strong>{doc.name || 'document'}</strong> before submission.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attestation modal"
            className="btn-icon"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Advisory */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.6rem',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.82rem',
            color: '#f59e0b',
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>
            UIDAI & MeitY advisory: Always specify the intended recipient and date to prevent identity fraud.
          </span>
        </div>

        {/* Configuration Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="watermark-purpose-select" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Submission Purpose Preset
            </label>
            <select
              id="watermark-purpose-select"
              value={purposeId}
              onChange={(e) => setPurposeId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              {ATTESTATION_PURPOSE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {purposeId === 'CUSTOM' && (
            <div>
              <label htmlFor="watermark-custom-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Custom Intended Purpose
              </label>
              <input
                id="watermark-custom-input"
                type="text"
                placeholder="e.g. Electricity Connection in Ward 12"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label htmlFor="watermark-recipient-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Recipient Authority / Department
              </label>
              <input
                id="watermark-recipient-input"
                type="text"
                placeholder="e.g. State Bank of India or RTO"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="watermark-citizen-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Attestation Name
              </label>
              <input
                id="watermark-citizen-input"
                type="text"
                value={attestationName}
                onChange={(e) => setAttestationName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={selfAttested}
              onChange={(e) => setSelfAttested(e.target.checked)}
            />
            <span>Include Self-Attestation declaration statement</span>
          </label>
        </div>

        {/* Live Stamped Preview Box */}
        <div>
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Live Watermarked Proof Specification
          </span>
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '1.25rem',
              borderRadius: '0.6rem',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px dashed var(--accent-main)',
            }}
          >
            {/* Diagonal Watermark Overlay Text */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                opacity: 0.12,
                transform: 'rotate(-20deg)',
                fontSize: '1.4rem',
                fontWeight: 900,
                color: 'var(--text-primary)',
                textAlign: 'center',
                userSelect: 'none',
                padding: '1rem',
              }}
            >
              {payload.watermarkText}
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <FileBadge size={16} color="var(--accent-main)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{doc.name}</span>
                <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '99px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-main)' }}>
                  {payload.dateString}
                </span>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: '0.76rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                }}
              >
                {payload.formattedSummary}
              </pre>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            {copied ? <Check size={15} color="#22c55e" /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy Attestation'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Printer size={15} /> Print / Export Document
          </button>
        </div>
      </div>
    </div>
  );
}
