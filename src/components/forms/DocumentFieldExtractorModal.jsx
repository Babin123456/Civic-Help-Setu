import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Check,
  AlertTriangle,
  ShieldCheck,
  Edit2,
  Trash2,
  ArrowRight,
  Eye,
} from 'lucide-react';
import {
  extractFieldsFromDocument,
  applyConfirmedAutofill,
} from '../../services/documentFieldExtractorService';

export default function DocumentFieldExtractorModal({
  isOpen,
  onClose,
  targetForm = {},
  onAutofillConfirmed,
}) {
  const [documentText, setDocumentText] = useState('');
  const [extractedCandidates, setExtractedCandidates] = useState([]);
  const [hasScanned, setHasScanned] = useState(false);

  if (!isOpen) return null;

  const handleScan = () => {
    if (!documentText.trim()) return;
    const candidates = extractFieldsFromDocument(documentText);
    setExtractedCandidates(candidates);
    setHasScanned(true);
  };

  const handleToggleConfirm = (index) => {
    setExtractedCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, confirmed: !c.confirmed } : c))
    );
  };

  const handleEditValue = (index, newVal) => {
    setExtractedCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, extractedValue: newVal } : c))
    );
  };

  const handleApply = () => {
    const updated = applyConfirmedAutofill(targetForm, extractedCandidates);
    if (onAutofillConfirmed) {
      onAutofillConfirmed(updated);
    }
    onClose();
  };

  const confirmedCount = extractedCandidates.filter((c) => c.confirmed).length;

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
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              AI Document Field Extractor &amp; Autofill
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

        {/* Accuracy and Consent Warning Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.55rem',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#d97706',
            fontSize: '0.825rem',
            marginBottom: '1.25rem',
          }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Citizen Confirmation Required:</strong> Optical extraction may misread numbers, names, or dates.
            No value is autofilled into your application without your explicit checkbox confirmation.
          </span>
        </div>

        {!hasScanned ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                Paste Document Text or OCR Transcript
              </label>
              <textarea
                rows="6"
                placeholder="Paste text from your Aadhaar, PAN card, or certificate..."
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!documentText.trim()}
                onClick={handleScan}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.4rem',
                  background: 'var(--accent-main)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: documentText.trim() ? 'pointer' : 'not-allowed',
                  opacity: documentText.trim() ? 1 : 0.6,
                }}
              >
                <Sparkles className="w-4 h-4" /> Extract Candidate Fields
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Extracted Fields ({extractedCandidates.length})
              </span>
              <button
                type="button"
                onClick={() => setHasScanned(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-main)',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Scan Different Document
              </button>
            </div>

            {extractedCandidates.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>
                No recognizable form fields were found in the provided document text.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {extractedCandidates.map((c, idx) => (
                  <div
                    key={c.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: c.confirmed ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-secondary, rgba(0,0,0,0.02))',
                      border: c.confirmed ? '1px solid #10b981' : '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={c.confirmed}
                        onChange={() => handleToggleConfirm(idx)}
                        id={`field-${c.key}`}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <label
                            htmlFor={`field-${c.key}`}
                            style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                          >
                            {c.label}
                          </label>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '0.25rem',
                              fontWeight: '700',
                              background:
                                c.confidenceLevel === 'HIGH'
                                  ? 'rgba(16, 185, 129, 0.1)'
                                  : c.confidenceLevel === 'MEDIUM'
                                    ? 'rgba(59, 130, 246, 0.1)'
                                    : 'rgba(239, 68, 68, 0.1)',
                              color:
                                c.confidenceLevel === 'HIGH'
                                  ? '#059669'
                                  : c.confidenceLevel === 'MEDIUM'
                                    ? '#2563eb'
                                    : '#dc2626',
                            }}
                          >
                            {c.confidenceLevel} CONFIDENCE
                          </span>
                        </div>

                        <input
                          type="text"
                          value={c.extractedValue}
                          onChange={(e) => handleEditValue(idx, e.target.value)}
                          style={{
                            marginTop: '0.25rem',
                            padding: '0.35rem 0.55rem',
                            borderRadius: '0.35rem',
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            width: '100%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
              <button
                type="button"
                disabled={confirmedCount === 0}
                onClick={handleApply}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.4rem',
                  background: 'var(--accent-main)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: confirmedCount > 0 ? 'pointer' : 'not-allowed',
                  opacity: confirmedCount > 0 ? 1 : 0.6,
                }}
              >
                <Check className="w-4 h-4" /> Apply Confirmed Fields ({confirmedCount})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
