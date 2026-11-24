import { Loader2, ShieldCheck, Cpu } from 'lucide-react';

export default function GenerationProgressBar({ status, progressPercent, currentStepLabel }) {
  const isGenerating = status === 'generating';
  const isValidating = status === 'validating';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-light, #cbd5e1)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isGenerating ? (
            <Cpu size={18} className="spin-slow" color="var(--primary, #2563eb)" aria-hidden="true" />
          ) : isValidating ? (
            <ShieldCheck size={18} color="#059669" aria-hidden="true" />
          ) : (
            <Loader2 size={18} className="spin" color="var(--primary, #2563eb)" aria-hidden="true" />
          )}
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {currentStepLabel || (isValidating ? 'Auditing Artifact for PII & Entropy Leaks...' : 'Synthesizing Civic Records...')}
          </span>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
          {progressPercent}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Dataset Generation Progress"
        style={{
          width: '100%',
          height: '8px',
          background: 'var(--bg-secondary, #e2e8f0)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: isValidating ? '#059669' : 'var(--primary, #2563eb)',
            borderRadius: '999px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)' }}>
        <span>Topological DAG Synthesis</span>
        <span>Multi-Tier PII Scan</span>
        <span>Cryptographic Seal</span>
      </div>
    </div>
  );
}
