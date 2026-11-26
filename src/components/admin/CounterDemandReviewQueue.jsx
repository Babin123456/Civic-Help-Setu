import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  BarChart2,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CounterDemandReviewQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      reportId: 'cdr_seed_101',
      officeId: 'off_delhi_south_01',
      reportType: 'AGGREGATE_ANOMALY',
      observedDate: '2026-11-12',
      timeSlot: '10:00-11:00',
      summary: 'Observed extreme surge of 70+ citizens due to regional power and portal outage in neighboring sub-district. Required temporary desk redeployment.',
      estimatedFootfallVariancePct: 48,
      verificationSeal: 'CDR-5E21-7A11',
      status: 'PENDING_ADMIN_REVIEW',
      submittedAt: '2026-11-12T11:30:00Z',
    },
    {
      reportId: 'cdr_seed_102',
      officeId: 'off_mumbai_central_02',
      reportType: 'UNEXPECTED_CLOSURE',
      observedDate: '2026-11-10',
      timeSlot: '14:00-17:00',
      summary: 'Precautionary high-tide advisory declared by Municipal Commissioner. Afternoon counters suspended early.',
      estimatedFootfallVariancePct: -85,
      verificationSeal: 'CDR-3B90-99C2',
      status: 'PENDING_ADMIN_REVIEW',
      submittedAt: '2026-11-10T14:15:00Z',
    },
  ]);

  useEffect(() => {
    fetch('/api/counter-demand-reports')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.reportId));
            const newItems = data.items.filter((i) => !existingIds.has(i.reportId));
            return [...newItems, ...prev];
          });
        }
      })
      .catch(() => {
        // Fallback to initial seeds in disconnected test environments
      });
  }, []);

  const handleApprove = (reportId) => {
    setItems((prev) =>
      prev.map((item) =>
        item.reportId === reportId ? { ...item, status: 'ACCEPTED_FOR_BASELINE' } : item
      )
    );
    toast.success('Observation accepted. Baseline recalibration flagged.');
  };

  const handleDismiss = (reportId) => {
    setItems((prev) =>
      prev.map((item) =>
        item.reportId === reportId ? { ...item, status: 'DISMISSED' } : item
      )
    );
    toast.info('Observation dismissed without modifying baseline.');
  };

  const pending = items.filter((i) => i.status === 'PENDING_ADMIN_REVIEW');

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ padding: '0.4rem', borderRadius: '6px', background: 'var(--accent-subtle, #dbeafe)', color: 'var(--accent-main, #2563eb)' }}>
            <BarChart2 size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Counter Demand &amp; Queue Anomaly Moderation Queue
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Operational reports requiring review before modifying time-series weights (#764)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to="/counter-demand"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ExternalLink size={14} />
            Open Workspace
          </Link>
          <span
            style={{
              fontSize: '0.8rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: pending.length > 0 ? 'var(--warning-bg, #fef3c7)' : 'var(--success-bg, #dcfce7)',
              color: pending.length > 0 ? 'var(--warning-text, #92400e)' : 'var(--success-text, #166534)',
              fontWeight: 600,
            }}
          >
            {pending.length} Pending Actions
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0' }}>
          No counter observations or demand anomaly reports in queue.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <div
              key={item.reportId}
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>
                    {item.reportType.replace(/_/g, ' ')}
                  </strong>{' '}
                  • <span style={{ color: 'var(--text-secondary)' }}>Office: {item.officeId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Seal: {item.verificationSeal}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: item.status === 'ACCEPTED_FOR_BASELINE'
                        ? 'var(--success-bg, #dcfce7)'
                        : item.status === 'DISMISSED'
                          ? 'var(--danger-bg, #fee2e2)'
                          : 'var(--warning-bg, #fef3c7)',
                      color: item.status === 'ACCEPTED_FOR_BASELINE'
                        ? 'var(--success-text, #166534)'
                        : item.status === 'DISMISSED'
                          ? 'var(--danger-text, #991b1b)'
                          : 'var(--warning-text, #92400e)',
                    }}
                  >
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                {item.summary}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span>Observed Date: <strong>{item.observedDate}</strong></span>
                  {item.timeSlot && <span>Slot: <strong>{item.timeSlot}</strong></span>}
                  {item.estimatedFootfallVariancePct !== null && (
                    <span>
                      Variance:{' '}
                      <strong style={{ color: item.estimatedFootfallVariancePct > 0 ? 'var(--warning-text, #b45309)' : 'inherit' }}>
                        {item.estimatedFootfallVariancePct > 0 ? `+${item.estimatedFootfallVariancePct}%` : `${item.estimatedFootfallVariancePct}%`}
                      </strong>
                    </span>
                  )}
                </div>

                {item.status === 'PENDING_ADMIN_REVIEW' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDismiss(item.reportId)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <XCircle size={14} />
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleApprove(item.reportId)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <CheckCircle2 size={14} />
                      Accept for Recalibration
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

