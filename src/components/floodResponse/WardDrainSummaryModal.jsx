import { useState } from 'react';
import { X, Copy, Check, FileText, Printer } from 'lucide-react';
import {
  getWardDrainSummaries,
  generateMunicipalMaintenancePetition,
} from '../../services/upFloodResponseService';

export default function WardDrainSummaryModal({
  isOpen,
  onClose,
  district = 'Lucknow',
}) {
  const [selectedWard, setSelectedWard] = useState(null);
  const [applicantName, setApplicantName] = useState('Concerned Resident');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const summaries = getWardDrainSummaries(district);
  const activeWard = selectedWard || (summaries.length > 0 ? summaries[0].wardName : 'Ward 12 (Hazratganj)');

  const petitionText = generateMunicipalMaintenancePetition({
    district,
    ward: activeWard,
    applicantName: applicantName.trim() || 'Concerned Resident',
  });

  const handleCopy = () => {
    navigator.clipboard?.writeText(petitionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ward-summary-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #0f172a)',
          color: 'var(--text-primary)',
          borderRadius: '0.75rem',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-light, #334155)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 id="ward-summary-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={22} color="var(--accent, #38bdf8)" />
              Ward-Wise Drain Blockage Summaries &amp; Maintenance Petition
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              District: <strong>{district}</strong> • Municipal Corporation Jurisdiction
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* WARD ROLLUP CARDS */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Municipal Ward Desiltation Status
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
            {summaries.map((w) => {
              const isSelected = activeWard.toLowerCase() === w.wardName.toLowerCase();
              return (
                <div
                  key={w.wardName}
                  onClick={() => setSelectedWard(w.wardName)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: isSelected ? 'var(--bg-card-hover, #1e293b)' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? '2px solid var(--accent, #38bdf8)' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{w.wardName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Blockages: <strong>{w.totalBlockages}</strong> ({w.activeCriticalBlockages} critical)
                  </div>
                  <div style={{ fontSize: '0.72rem', marginTop: '0.35rem' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.4rem',
                        borderRadius: '0.25rem',
                        background: w.urgency.includes('CRITICAL') ? '#7f1d1d' : '#78350f',
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                    >
                      Urgency: {w.urgency}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* EXPORTABLE MAINTENANCE PETITION PREVIEW */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong style={{ fontSize: '0.9rem' }}>Statutory Municipal Maintenance Petition</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Target Ward: <strong>{activeWard}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="text"
                placeholder="Applicant name"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                style={{
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.78rem',
                  borderRadius: '0.3rem',
                  background: 'var(--bg-card-hover, #1e293b)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  width: '150px',
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>

          <pre
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: '#090d16',
              border: '1px solid var(--border-light)',
              color: '#e2e8f0',
              fontSize: '0.76rem',
              lineHeight: '1.45',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '260px',
              overflowY: 'auto',
              margin: 0,
            }}
          >
            {petitionText}
          </pre>
        </div>
      </div>
    </div>
  );
}
