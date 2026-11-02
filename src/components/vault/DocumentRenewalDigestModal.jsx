import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Download,
  X,
  ExternalLink,
  CheckCircle,
  FileText,
  Filter,
} from 'lucide-react';
import {
  generateDocumentRenewalDigest,
  generateRenewalICalendar,
  RENEWAL_URGENCY,
} from '../../services/documentRenewalDigestService.js';

/**
 * Document Renewal Digest & Expiry Alerts Modal (#432)
 *
 * Provides a consolidated health check of all vault documents, highlighting
 * renewal windows, statutory lead times, and providing one-click .ics calendar export.
 */
const DocumentRenewalDigestModal = ({ isOpen, onClose, documents = [] }) => {
  const [filterMode, setFilterMode] = useState('action'); // 'action' | 'all' | 'healthy'

  const digest = useMemo(() => {
    return generateDocumentRenewalDigest(documents);
  }, [documents]);

  if (!isOpen) return null;

  const handleDownloadIcs = () => {
    const icsContent = generateRenewalICalendar(digest.items);
    if (typeof window === 'undefined') return;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `civic-document-renewals-${new Date().toISOString().slice(0, 10)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredItems = digest.items.filter((item) => {
    if (filterMode === 'action') {
      return (
        item.urgency === RENEWAL_URGENCY.EXPIRED ||
        item.urgency === RENEWAL_URGENCY.URGENT ||
        item.urgency === RENEWAL_URGENCY.UPCOMING
      );
    }
    if (filterMode === 'healthy') {
      return item.urgency === RENEWAL_URGENCY.HEALTHY || item.urgency === RENEWAL_URGENCY.NO_EXPIRY;
    }
    return true; // 'all'
  });

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case RENEWAL_URGENCY.EXPIRED:
        return {
          label: 'Expired',
          bg: 'rgba(239, 68, 68, 0.15)',
          border: 'rgba(239, 68, 68, 0.35)',
          text: '#ef4444',
          icon: <AlertTriangle size={12} />,
        };
      case RENEWAL_URGENCY.URGENT:
        return {
          label: 'Urgent Renewal',
          bg: 'rgba(249, 115, 22, 0.15)',
          border: 'rgba(249, 115, 22, 0.35)',
          text: '#f97316',
          icon: <Clock size={12} />,
        };
      case RENEWAL_URGENCY.UPCOMING:
        return {
          label: 'Upcoming Window',
          bg: 'rgba(234, 179, 8, 0.15)',
          border: 'rgba(234, 179, 8, 0.35)',
          text: '#eab308',
          icon: <Clock size={12} />,
        };
      case RENEWAL_URGENCY.ADVANCE_NOTICE:
        return {
          label: 'Advance Notice',
          bg: 'rgba(56, 189, 248, 0.15)',
          border: 'rgba(56, 189, 248, 0.35)',
          text: 'var(--accent-main)',
          icon: <Calendar size={12} />,
        };
      default:
        return {
          label: 'Valid',
          bg: 'rgba(34, 197, 94, 0.15)',
          border: 'rgba(34, 197, 94, 0.35)',
          text: '#22c55e',
          icon: <CheckCircle size={12} />,
        };
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="renewal-digest-title"
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={18} color="var(--accent-main)" />
            </div>
            <div>
              <h2
                id="renewal-digest-title"
                style={{
                  fontSize: '1.15rem',
                  fontWeight: '700',
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                Document Renewal Digest &amp; Expiry Alerts
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Statutory lead times, prerequisites, and calendar alerts for your vault
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary counters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.65rem',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: digest.summary.actionRequiredCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: digest.summary.actionRequiredCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-light)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: digest.summary.actionRequiredCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                {digest.summary.actionRequiredCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
                Action Required
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ef4444' }}>
                {digest.summary.expired}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
                Expired
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f97316' }}>
                {digest.summary.urgent}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
                Urgent (&lt;30d)
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#eab308' }}>
                {digest.summary.upcoming}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
                Upcoming (&lt;90d)
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#22c55e' }}>
                {digest.summary.healthy}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
                Healthy
              </div>
            </div>
          </div>

          {/* Controls: Filter & Export */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '0.25rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setFilterMode('action')}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.78rem',
                  borderRadius: '9999px',
                  fontWeight: filterMode === 'action' ? '700' : '500',
                  background: filterMode === 'action' ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.04)',
                  color: filterMode === 'action' ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                Needs Action ({digest.summary.actionRequiredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.78rem',
                  borderRadius: '9999px',
                  fontWeight: filterMode === 'all' ? '700' : '500',
                  background: filterMode === 'all' ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.04)',
                  color: filterMode === 'all' ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                All Documents ({digest.summary.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('healthy')}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.78rem',
                  borderRadius: '9999px',
                  fontWeight: filterMode === 'healthy' ? '700' : '500',
                  background: filterMode === 'healthy' ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.04)',
                  color: filterMode === 'healthy' ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                Healthy ({digest.summary.healthy + digest.summary.noExpiry})
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadIcs}
              disabled={digest.items.filter((i) => i.expiryDate).length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--accent-main)',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              <span>Export Calendar Reminders (.ics)</span>
            </button>
          </div>

          {/* Items list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredItems.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2.5rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                }}
              >
                <CheckCircle size={32} color="#22c55e" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  No documents in this view
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  All evaluated credentials are compliant with current statutory guidelines.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const badge = getUrgencyBadge(item.urgency);

                return (
                  <div
                    key={item.documentId}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.65rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {item.documentName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          ({item.documentType})
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.text,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        {badge.icon}
                        <span>{item.urgencyLabel}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <strong>Expiry Date:</strong> {item.expiryDate ? item.expiryDate : 'None specified'}
                    </div>

                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {item.statutoryAdvice}
                    </p>

                    {item.suggestedServiceId && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <Link
                          to={`/services/${item.suggestedServiceId}`}
                          onClick={onClose}
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--accent-main)',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            textDecoration: 'underline',
                          }}
                        >
                          <span>Open official renewal service guide</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} color="#22c55e" />
            <span>Zero-Knowledge: Expirations evaluated entirely in browser memory.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentRenewalDigestModal;
