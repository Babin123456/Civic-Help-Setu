import { Database, Play, FileSpreadsheet } from 'lucide-react';

export default function SyntheticDatasetEmptyState({ onLaunchPreset }) {
  return (
    <div
      style={{
        padding: '3rem 1.5rem',
        textAlign: 'center',
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '0.85rem',
        border: '1px dashed var(--border-light, #cbd5e1)',
        margin: '1.5rem 0',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.1)',
          color: 'var(--primary, #2563eb)',
          marginBottom: '1rem',
        }}
        aria-hidden="true"
      >
        <Database size={28} />
      </div>

      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
        No Synthetic Dataset Generated Yet
      </h3>

      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary, #64748b)',
          maxWidth: '520px',
          margin: '0 auto 1.5rem auto',
          lineHeight: 1.5,
        }}
      >
        Generate realistic, privacy-safe civic records (services, applications, grievances, and administrative offices)
        to stress-test workflows and UI components without touching citizen PII.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => onLaunchPreset('scen-pune-grievance-surge')}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <Play size={15} aria-hidden="true" />
          Generate Grievance Backlog Surge
        </button>

        <button
          type="button"
          onClick={() => onLaunchPreset('scen-maha-rts-compliance-audit')}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <FileSpreadsheet size={15} aria-hidden="true" />
          Generate RTS Compliance Audit
        </button>
      </div>
    </div>
  );
}
