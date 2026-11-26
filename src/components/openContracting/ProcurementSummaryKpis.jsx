import { ShieldAlert, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ProcurementSummaryKpis({ analysis, noticesCount = 0 }) {
  const flags = analysis?.redFlags || [];
  const singleBidCount = flags.filter((f) => f.indicatorId === 'single_bid_award').length;
  const criticalCount = analysis?.flagsBySeverity?.critical || 0;
  const highCount = analysis?.flagsBySeverity?.high || 0;
  const pendingReviews = flags.filter((f) => !f.status || f.status === 'pending_review').length;
  const reviewedCount = flags.filter((f) => f.status && f.status !== 'pending_review').length;

  return (
    <section
      aria-label="Procurement Red-Flag Analytics Summary"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div
        className="card kpi-card"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          background: 'var(--bg-card, #1e293b)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
            Analyzed Notices
          </span>
          <FileText size={18} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
          {noticesCount}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
          Published OCDS tenders
        </span>
      </div>

      <div
        className="card kpi-card"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'var(--bg-card, #1e293b)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: 500 }}>
            Red-Flag Anomalies
          </span>
          <ShieldAlert size={18} color="#ef4444" aria-hidden="true" />
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ef4444' }}>
          {flags.length}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
          {criticalCount} critical, {highCount} high severity
        </span>
      </div>

      <div
        className="card kpi-card"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          background: 'var(--bg-card, #1e293b)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 500 }}>
            Single-Bid Awards
          </span>
          <AlertTriangle size={18} color="#f59e0b" aria-hidden="true" />
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fbbf24' }}>
          {singleBidCount}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
          Single evaluated quote pattern
        </span>
      </div>

      <div
        className="card kpi-card"
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          background: 'var(--bg-card, #1e293b)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 500 }}>
            Auditor Triage Progress
          </span>
          <CheckCircle size={18} color="#38bdf8" aria-hidden="true" />
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8' }}>
          {reviewedCount} / {flags.length}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
          {pendingReviews} awaiting human examination
        </span>
      </div>
    </section>
  );
}
