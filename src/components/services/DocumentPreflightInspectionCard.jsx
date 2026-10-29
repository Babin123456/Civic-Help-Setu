import { useState } from 'react';
import {
  FileCheck2,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import {
  getDocumentPreflightRules,
  calculatePreflightReadiness,
  generatePreflightInspectionText
} from '../../services/documentPreflightCheckService';

export default function DocumentPreflightInspectionCard({ service }) {
  const [checkedIds, setCheckedIds] = useState([]);
  const [copied, setCopied] = useState(false);

  if (!service) return null;

  const rules = getDocumentPreflightRules(service.id, service.documents || []);
  const readiness = calculatePreflightReadiness(checkedIds, rules);

  const toggleCheck = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleCopyReport = async () => {
    try {
      const text = generatePreflightInspectionText(
        service.name || 'Civic Service',
        readiness,
        rules,
        checkedIds
      );
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <section
      className="glass-panel"
      role="region"
      aria-label={`Document Pre-Flight & Attestation Readiness for ${service.name}`}
      style={{
        marginTop: '1.5rem',
        padding: '1.5rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-light, #334155)',
        background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.65rem',
              borderRadius: '0.75rem',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileCheck2 size={24} aria-hidden="true" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              Document Pre-Flight Inspection &amp; Attestation Check
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Avoid counter-level rejections, photocopy omissions, and spelling discrepancies.
            </p>
          </div>
        </div>

        {/* Live Score Display */}
        <div style={{ textAlign: 'right', minWidth: '120px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Counter Readiness</div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: '800',
              color: readiness.isReadyForVisit ? '#10b981' : '#f59e0b',
            }}
          >
            {readiness.percentage}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: '6px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '9999px',
          overflow: 'hidden',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${readiness.percentage}%`,
            background: readiness.isReadyForVisit
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Status Warning / Success Pill */}
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
          marginBottom: '1.25rem',
          background: readiness.isReadyForVisit
            ? 'rgba(16, 185, 129, 0.12)'
            : 'rgba(245, 158, 11, 0.12)',
          color: readiness.isReadyForVisit ? '#34d399' : '#fbbf24',
          border: `1px solid ${
            readiness.isReadyForVisit ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'
          }`,
        }}
      >
        {readiness.isReadyForVisit ? (
          <CheckCircle size={18} aria-hidden="true" />
        ) : (
          <AlertTriangle size={18} aria-hidden="true" />
        )}
        <span>
          {readiness.isReadyForVisit
            ? 'All mandatory pre-flight checks verified. You are cleared for physical counter submission!'
            : `Notice: ${readiness.missingMandatoryCount} mandatory pre-flight items remain unverified. Complete all items before visiting.`}
        </span>
      </div>

      {/* Checklist items */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {rules.map((rule) => {
          const isChecked = checkedIds.includes(rule.id);
          const isMandatory = rule.criticality === 'MANDATORY';

          return (
            <label
              key={rule.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem',
                borderRadius: '0.5rem',
                background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isChecked ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light, #334155)'}`,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleCheck(rule.id)}
                style={{
                  marginTop: '0.2rem',
                  accentColor: 'var(--accent-main, #38bdf8)',
                  cursor: 'pointer',
                  width: '16px',
                  height: '16px',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      color: isChecked ? '#34d399' : 'var(--text-primary)',
                      textDecoration: isChecked ? 'line-through' : 'none',
                    }}
                  >
                    {rule.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      background: isMandatory ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: isMandatory ? '#f87171' : 'var(--text-secondary)',
                    }}
                  >
                    {rule.criticality}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.5' }}>
                  {rule.guideline}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-main, #38bdf8)', marginTop: '0.25rem' }}>
                  📌 {rule.validityNote}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Copy Report Action */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--border-light, #334155)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Info size={14} aria-hidden="true" />
          Carry 2 self-attested photocopy sets and all original IDs to the counter.
        </div>

        <button
          type="button"
          onClick={handleCopyReport}
          className="btn btn-secondary"
          aria-label="Copy Pre-Flight Inspection Summary"
          style={{
            padding: '0.45rem 0.85rem',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'var(--glass-bg)',
          }}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          <span>{copied ? 'Report Copied!' : 'Copy Pre-Flight Inspection Report'}</span>
        </button>
      </div>
    </section>
  );
}
