import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function PublicToiletReviewQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      id: 'sub_seed_pt_01',
      facilityId: 'pt-blr-ward150-001',
      facilityName: 'Koramangala 5th Block Community Sanitation Complex',
      reportType: 'maintenance_issue',
      category: 'plumbing_leak',
      description: 'Flush valve leaking in cabin 2, water continuously running.',
      receiptSeal: 'PT-SEAL-8B12-4F91',
      submittedAt: '2026-11-16T08:30:00Z',
      status: 'pending_review',
    },
    {
      id: 'sub_seed_pt_02',
      facilityId: 'pt-del-ward045-003',
      facilityName: 'Connaught Place Central Park She-Toilet Complex',
      reportType: 'citizen_feedback',
      category: 'hygiene_cleanliness',
      description: 'Sanitary napkin dispenser empty, liquid hand soap refilled and clean.',
      receiptSeal: 'PT-SEAL-2C44-91EA',
      submittedAt: '2026-11-16T10:15:00Z',
      status: 'pending_review',
    },
  ]);

  useEffect(() => {
    fetch('/api/public-toilets')
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

  const handleApprove = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'approved_forwarded' } : item))
    );
    toast?.success?.('Incident report approved and forwarded to ward sanitation team.');
  };

  const handleDismiss = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast?.success?.('Submission cleared from moderation queue.');
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        marginTop: '2rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-light, #e2e8f0)',
        backgroundColor: 'var(--bg-surface, #ffffff)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Building2 size={20} style={{ color: 'var(--accent-main, #3b82f6)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Public Toilet Moderation &amp; Maintenance Review Queue
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Moderation of citizen sanitation tickets, hygiene feedback, and cryptographic receipts
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--primary-main, #2563eb)',
            fontWeight: 600,
          }}
        >
          {items.length} Pending Actions
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem auto', color: 'var(--success-main, #22c55e)' }} />
          All public toilet incident reports and feedback submissions are moderated.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--bg-main, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {item.facilityName || item.facilityId}
                  </strong>
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.35rem',
                      backgroundColor: item.reportType === 'maintenance_issue' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(147, 51, 234, 0.1)',
                      color: item.reportType === 'maintenance_issue' ? 'var(--danger-main, #ef4444)' : '#7e22ce',
                      fontWeight: 600,
                    }}
                  >
                    {item.reportType === 'maintenance_issue' ? 'Maintenance Issue' : 'Citizen Feedback'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{new Date(item.submittedAt).toLocaleString()}</span>
                </div>
              </div>

              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {item.description}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Receipt Seal: <code style={{ color: 'var(--primary-main)', fontWeight: 600 }}>{item.receiptSeal}</code>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {item.status !== 'approved_forwarded' ? (
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <CheckCircle2 size={13} /> Approve &amp; Dispatch
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success-main)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={13} /> Dispatched to Ward
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.id)}
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <XCircle size={13} /> Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
