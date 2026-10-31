import { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertTriangle, FileCheck2, Copy, Check, Printer, Clock } from 'lucide-react';
import {
  OBJECTION_CATEGORIES,
  calculateCureTimeline,
  generateRectificationNoticeDraft,
} from '../../services/deficiencyCureService';
import { useToast } from '../../context/ToastContext';

export default function DeficiencyCureModal({ application, isOpen, onClose, citizenName = 'Applicant Citizen' }) {
  const { toast } = useToast?.() || {};
  const [objectionId, setObjectionId] = useState('DOCUMENT_ILLEGIBLE');
  const [explanation, setExplanation] = useState('');
  const [rectifiedDocInput, setRectifiedDocInput] = useState('');
  const [rectifiedDocuments, setRectifiedDocuments] = useState(['Rectified proof copy']);
  const [copied, setCopied] = useState(false);

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

  if (!isOpen || !application) return null;

  const timeline = calculateCureTimeline(application);
  const activePreset = OBJECTION_CATEGORIES.find((c) => c.id === objectionId);

  const draft = generateRectificationNoticeDraft(application, {
    citizenName,
    objectionId,
    explanation,
    rectifiedDocuments,
  });

  const handleAddDoc = () => {
    if (!rectifiedDocInput.trim()) return;
    setRectifiedDocuments((prev) => [...prev, rectifiedDocInput.trim()]);
    setRectifiedDocInput('');
  };

  const handleRemoveDoc = (index) => {
    setRectifiedDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopyNotice = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft);
        setCopied(true);
        toast?.success?.('Rectification response notice copied to clipboard.');
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      toast?.error?.('Could not copy notice.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deficiency-modal-title"
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
          maxWidth: '680px',
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
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <FileCheck2 size={20} />
            </div>
            <div>
              <h2 id="deficiency-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Statutory Deficiency Cure &amp; Objection Resolution
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Respond to scrutiny objections for <strong>{application.serviceName}</strong> ({application.id}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close deficiency resolution dialog"
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

        {/* Statutory Timeline Warning Banner */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.6rem',
            background: timeline.isExpired ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${timeline.isExpired ? '#ef4444' : '#f59e0b'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color={timeline.isExpired ? '#ef4444' : '#f59e0b'} />
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              {timeline.isExpired
                ? 'Statutory 15-Day Cure Window Expired — Immediate Appeal Recommended'
                : `Statutory Cure Window: ${timeline.daysRemaining} Days Left to Resolve`}
            </span>
          </div>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '0.15rem 0.6rem',
              borderRadius: '99px',
              background: timeline.isExpired ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: timeline.isExpired ? '#ef4444' : '#f59e0b',
            }}
          >
            Day {timeline.daysElapsed} of {timeline.statutoryWindowDays}
          </span>
        </div>

        {/* Objection Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="objection-category-select" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Communicated Objection Category
            </label>
            <select
              id="objection-category-select"
              value={objectionId}
              onChange={(e) => setObjectionId(e.target.value)}
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
              {OBJECTION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {activePreset && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--accent-main)' }}>
                Tip: {activePreset.suggestedResolution}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="rectification-explanation" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Applicant Explanation / Rectification Statement
            </label>
            <textarea
              id="rectification-explanation"
              rows={3}
              placeholder="Explain how the pointed defect has been cured..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Enclosed Rectified Documents Checklist
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="e.g. Fresh Scan of Aadhar Card.pdf"
                value={rectifiedDocInput}
                onChange={(e) => setRectifiedDocInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDoc();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddDoc}
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem' }}
              >
                Add Document
              </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {rectifiedDocuments.map((doc, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '99px',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{doc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}
                    aria-label={`Remove ${doc}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Live Formal Notice Letter Preview */}
        <div>
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Statutory Rectification Compliance Petition
          </span>
          <pre
            style={{
              margin: 0,
              padding: '1rem',
              borderRadius: '0.5rem',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              fontSize: '0.76rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '180px',
              overflowY: 'auto',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
            }}
          >
            {draft}
          </pre>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyNotice}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            {copied ? <Check size={15} color="#22c55e" /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy Notice'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Printer size={15} /> Print Compliance Letter
          </button>
        </div>
      </div>
    </div>
  );
}
