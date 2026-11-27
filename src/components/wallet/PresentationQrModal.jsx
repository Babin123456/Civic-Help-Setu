import { useState, useMemo } from 'react';
import { X, Copy, Check, ShieldCheck } from 'lucide-react';
import qrcode from 'qrcode-generator';

export default function PresentationQrModal({
  presentation,
  onClose,
  onOpenVerifier
}) {
  const [copied, setCopied] = useState(false);

  const presentationJson = useMemo(() => {
    return JSON.stringify(presentation, null, 2);
  }, [presentation]);

  const qrDataUrl = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      // For QR, encode presentationId and minimal attributes to fit safely in QR matrix
      const qrPayload = JSON.stringify({
        id: presentation.presentationId,
        aud: presentation.audience,
        nonce: presentation.nonce,
        exp: presentation.validUntil,
        claims: presentation.disclosedClaims,
        sig: presentation.presentationDigest.slice(0, 16)
      });
      qr.addData(qrPayload);
      qr.make();
      return qr.createDataURL(4);
    } catch {
      return null;
    }
  }, [presentation]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(presentationJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary)',
          borderRadius: '1rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light, #e2e8f0)',
          padding: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 id="qr-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Verifiable Presentation Generated
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ID: <code>{presentation.presentationId}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close dialog"
            style={{ padding: '0.35rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* QR Code Container */}
          {qrDataUrl && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                background: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-light, #e2e8f0)'
              }}
            >
              <img
                src={qrDataUrl}
                alt="Presentation QR Code"
                style={{ width: '180px', height: '180px', borderRadius: '0.5rem', background: '#ffffff', padding: '0.5rem' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Scan at civic service inspection counter
              </span>
            </div>
          )}

          {/* Presentation Metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              fontSize: '0.82rem'
            }}
          >
            <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '0.6rem', borderRadius: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Audience:</span>
              <strong style={{ wordBreak: 'break-all' }}>{presentation.audience}</strong>
            </div>
            <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '0.6rem', borderRadius: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Valid Until:</span>
              <strong>{new Date(presentation.validUntil).toLocaleTimeString()}</strong>
            </div>
          </div>

          {/* Disclosed Attributes preview */}
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              Disclosed Attributes ({Object.keys(presentation.disclosedClaims).length} claims • {presentation.withheldClaimsCount} withheld):
            </span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem'
              }}
            >
              {Object.entries(presentation.disclosedClaims).map(([k, v]) => (
                <span
                  key={k}
                  style={{
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary-color)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                >
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          </div>

          {/* Raw JSON viewer */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Signed Presentation Envelope
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-sm btn-ghost"
                style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                {copied ? <Check size={13} color="green" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
            <pre
              style={{
                maxHeight: '130px',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid var(--border-light, #e2e8f0)',
                padding: '0.6rem',
                borderRadius: '0.5rem',
                fontSize: '0.74rem',
                fontFamily: 'monospace',
                margin: 0
              }}
            >
              {presentationJson}
            </pre>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onOpenVerifier(presentation)}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <ShieldCheck size={15} />
              Test in Verifier Sandbox
            </button>
            <button type="button" onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
