import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { evaluateDocumentRenewalNeeds } from '../../services/documentRenewalReminderService';

export default function VaultRenewalReminderBanner({ documents = [] }) {
  const reminders = useMemo(() => evaluateDocumentRenewalNeeds(documents), [documents]);

  if (!reminders || reminders.length === 0) return null;

  return (
    <div
      className="glass-panel animate-fade-in"
      role="region"
      aria-label="Statutory Document Renewal Reminders"
      style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '1rem',
        background: 'rgba(239, 68, 68, 0.04)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        marginBottom: '2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CalendarClock size={20} color="#ef4444" aria-hidden="true" />
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ef4444' }}>
            Statutory Document Expiry &amp; Renewal Notices ({reminders.length})
          </h4>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Indian Fiscal &amp; Motor Vehicle Regulations
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
        {reminders.map((item, idx) => {
          const isUrgent = item.renewalUrgency === 'URGENT' || item.renewalUrgency === 'EXPIRED';
          return (
            <div
              key={idx}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.65rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: isUrgent ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.6rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.88rem' }}>{item.docType} ({item.docNumber})</strong>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      background: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isUrgent ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {item.renewalUrgency}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  {item.headline}
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {item.description}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <Link
                  to={item.renewalServicePath || '/services'}
                  className="btn btn-outline"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.65rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  Apply Renewal <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
