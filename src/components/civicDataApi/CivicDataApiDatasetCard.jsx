import { Database, ExternalLink, Filter, ShieldCheck } from 'lucide-react';

const badgeStyle = (tone) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.2rem 0.55rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
  border: '1px solid',
  ...(tone === 'approved'
    ? { color: 'var(--success, #047857)', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' }
    : { color: 'var(--warning, #92400e)', background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' }),
});

export default function CivicDataApiDatasetCard({ dataset, onUseInSandbox }) {
  return (
    <article
      aria-labelledby={`dataset-title-${dataset.id}`}
      style={{
        border: '1px solid var(--border-main)',
        borderRadius: '0.85rem',
        padding: '1.25rem',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {dataset.category.replaceAll('_', ' ')}
          </p>
          <h3 id={`dataset-title-${dataset.id}`} style={{ margin: '0.2rem 0 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            {dataset.name}
          </h3>
        </div>
        <span style={badgeStyle(dataset.status === 'approved' ? 'approved' : 'warning')}>{dataset.status}</span>
      </div>

      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{dataset.description}</p>

      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', margin: 0 }}>
        <div>
          <dt style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Version</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{dataset.version} / schema {dataset.schemaVersion}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Records</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{dataset.recordCount}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily quota</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{dataset.dailyQuota.sandbox} sandbox</dd>
        </div>
        <div>
          <dt style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{dataset.requestsPerMinute.sandbox} req/min</dd>
        </div>
      </dl>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }} aria-label="Public fields">
        {dataset.publicFields.map((field) => (
          <span key={field} style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '999px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-secondary)' }}>
            {field}
          </span>
        ))}
      </div>

      <details>
        <summary style={{ cursor: 'pointer', color: 'var(--accent-main)', fontWeight: 600 }}>
          <Filter size={14} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem' }} />
          Filters and endpoint
        </summary>
        <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Filters:</strong> {dataset.filterFields.join(', ')}
          </p>
          <code style={{ display: 'block', overflowWrap: 'anywhere', padding: '0.5rem', borderRadius: '0.45rem', background: 'var(--bg-main)' }}>
            GET {dataset.endpoint}?page=1&amp;pageSize={dataset.defaultPageSize}
          </code>
          <p style={{ margin: 0 }}>
            <strong>Owner:</strong> {dataset.owner}. <strong>License:</strong> {dataset.license}.
          </p>
        </div>
      </details>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={() => onUseInSandbox(dataset.id)}>
          <Database size={15} aria-hidden="true" /> Use in sandbox
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          <ShieldCheck size={14} aria-hidden="true" /> Public fields only
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          <ExternalLink size={14} aria-hidden="true" /> {dataset.dataClassification.replaceAll('_', ' ')}
        </span>
      </div>
    </article>
  );
}
