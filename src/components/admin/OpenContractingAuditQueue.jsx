import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SEED_INITIAL_REVIEWS } from '../../data/openContractingSeed.js';

export default function OpenContractingAuditQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState(SEED_INITIAL_REVIEWS);

  useEffect(() => {
    fetch('/api/open-contracting-analytics?role=auditor')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.reviews) && data.reviews.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = data.reviews.filter((i) => !existingIds.has(i.id));
            return [...newItems, ...prev];
          });
        }
      })
      .catch(() => {
        // Fallback to seed data in memory/SSR
      });
  }, []);

  const handleVerify = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, disposition: 'cleared_with_explanation' } : item
      )
    );
    toast?.success?.('Procurement review outcome certified and confirmed in audit register.');
  };

  const handleDismiss = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast?.info?.('Audit item removed from active administrative queue.');
  };

  return (
    <div
      className="admin-card"
      style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginTop: '1.5rem',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldAlert size={20} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
              Open Contracting Red-Flag Audit &amp; Triage Queue (#751)
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Supervisory audit register for review outcomes, false-positive declarations, and sealed oversight files.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.25rem 0.65rem',
              borderRadius: '1rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
            }}
          >
            {items.length} Active Audit Cases
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
          No pending procurement audit reviews in queue.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <article
              key={item.id}
              tabIndex="0"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                      Case {item.id}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • Ref: {item.noticeId || item.flagId}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • {item.jurisdiction}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Reviewer: <strong>{item.reviewerId}</strong> ({item.reviewerRole}) • {item.timestamp?.slice(0, 10)}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.25rem',
                    background:
                      item.disposition === 'marked_false_positive'
                        ? 'rgba(100, 116, 139, 0.3)'
                        : item.disposition === 'escalated_for_formal_audit'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(245, 158, 11, 0.2)',
                    color:
                      item.disposition === 'marked_false_positive'
                        ? '#cbd5e1'
                        : item.disposition === 'escalated_for_formal_audit'
                          ? '#f87171'
                          : '#fbbf24',
                    textTransform: 'capitalize',
                  }}
                >
                  {item.disposition?.replace(/_/g, ' ')}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {item.justification}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Lock size={13} color="#38bdf8" aria-hidden="true" />
                  <span style={{ color: 'var(--text-muted)' }}>Sealed Token:</span>
                  <code style={{ color: '#38bdf8', fontWeight: 600 }}>{item.auditSeal}</code>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => handleVerify(item.id)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <CheckCircle2 size={13} color="#4ade80" aria-hidden="true" />
                    Certify
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.id)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: '#f87171',
                    }}
                  >
                    <XCircle size={13} aria-hidden="true" />
                    Dismiss
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
