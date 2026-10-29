import { History, FileText, CheckCircle, ExternalLink, Calendar, ShieldCheck } from 'lucide-react';
import { formatCircularCitation } from '../../services/serviceChangelogService';
import { safeHttpUrl } from '../../utils/safeContent';

export default function VersionHistoryTimeline({ revisions = [] }) {
  if (!revisions.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
        No historical Government Orders or Gazette revisions recorded for this service.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', marginTop: '12px' }}>
      {revisions.map((rev, idx) => (
        <div
          key={rev.version}
          style={{
            background: '#ffffff',
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem' }}>
                {rev.version}
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                {rev.title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#64748b' }}>
              <Calendar size={13} />
              <span>Effective: {new Date(rev.effectiveDate).toLocaleDateString('en-IN')}</span>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '6px', fontWeight: 500 }}>
            Official Gazette / Circular: <strong>{rev.circularNumber}</strong> ({rev.issuingAuthority})
          </div>

          <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {rev.changes.map((ch, i) => (
              <li key={i}>{ch}</li>
            ))}
          </ul>

          {rev.sourceUrl && (
            <div style={{ marginTop: '10px' }}>
              <a
                href={safeHttpUrl(rev.sourceUrl) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.76rem',
                  color: '#2563eb',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}
              >
                <span>View Official Gazette Circular</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
