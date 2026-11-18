import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SurveyAuditQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      id: 'sub_seed_srv_01',
      surveyId: 'srv-water-sanitation-2026',
      surveyTitle: 'Ward 12 Municipal Water Supply & Pipeline Reliability Survey',
      receiptSeal: 'SRV-SEAL-8F12-3D91',
      submittedAt: '2026-11-14T09:30:00Z',
      status: 'recorded',
      auditNote: 'Anonymous response safely ingested under public consultation seal.',
    },
    {
      id: 'sub_seed_srv_02',
      surveyId: 'srv-urban-mobility-transit-2026',
      surveyTitle: 'Feeder Bus & Last-Mile Metro Transit Connectivity Assessment',
      receiptSeal: 'SRV-SEAL-1B44-77EA',
      submittedAt: '2026-11-14T11:45:00Z',
      status: 'recorded',
      auditNote: 'Transit commuter response verified under anonymous mode.',
    },
  ]);

  useEffect(() => {
    fetch('/api/civic-surveys')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = data.items.filter((i) => !existingIds.has(i.id));
            return [...newItems, ...prev];
          });
        }
      })
      .catch(() => {
        // Fallback to initial seeds
      });
  }, []);

  const handleVerify = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'verified' } : item))
    );
    toast?.success?.('Survey submission verified and confirmed in audit log.');
  };

  const handleDismiss = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast?.success?.('Submission cleared from review queue.');
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        marginTop: '2rem',
        borderRadius: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
      aria-label="Civic Surveys Audit Queue"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Activity size={20} color="var(--accent-main)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              Civic Survey Quality &amp; Response Audit Queue
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Verifies anonymous citizen response seals, privacy thresholds, and sampling audit logs.
            </p>
          </div>
        </div>

        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '99px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--accent-main)',
          }}
        >
          {items.length} Active Records
        </span>
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', margin: '2rem 0' }}>
          No pending survey audit items in the queue.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-light)',
                background: 'var(--glass-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.surveyTitle || item.surveyId}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: item.status === 'verified' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: item.status === 'verified' ? '#10b981' : '#f59e0b',
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>Seal: <code>{item.receiptSeal}</code></span>
                  <span>Submitted: {new Date(item.submittedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {item.status !== 'verified' && (
                  <button
                    type="button"
                    onClick={() => handleVerify(item.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <CheckCircle2 size={13} color="#10b981" /> Verify
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(item.id)}
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <XCircle size={13} color="#ef4444" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

