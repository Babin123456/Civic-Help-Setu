import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

export default function RoadHazardReviewQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      id: 'rh_seed_01',
      segmentId: 'seg-ka-blr-nh44-01',
      corridorName: 'NH-44 Outer Ring Road (Hebbal)',
      hazardType: 'missing_pedestrian_crossing',
      severity: 'critical',
      description: 'High volume of pedestrians crossing highway at Hebbal down-ramp without any signal or refuge island.',
      locationHint: 'Near BMTC Hebbal bus shelter',
      submittedAt: '2026-02-14T08:15:00Z',
      status: 'pending_review',
      verificationSeal: 'RH-HAZ-4A12-88B1',
      evidenceUrl: 'https://morth.nic.in/reports/hebbal-audit.pdf',
    },
    {
      id: 'rh_seed_02',
      segmentId: 'seg-dl-del-ring-03',
      corridorName: 'Inner Ring Road (Ashram Chowk)',
      hazardType: 'poor_streetlight',
      severity: 'high',
      description: 'Underpass exit streetlights are completely non-operational, causing severe night glare and blind braking.',
      locationHint: 'Underpass northern exit toward Sarai Kale Khan',
      submittedAt: '2026-02-15T21:40:00Z',
      status: 'pending_review',
      verificationSeal: 'RH-HAZ-7C33-9F02',
      evidenceUrl: null,
    },
  ]);

  useEffect(() => {
    fetch('/api/road-hazards')
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
      prev.map((item) => (item.id === id ? { ...item, status: 'approved' } : item))
    );
    toast?.success?.('Road hazard report approved and incorporated into blackspot scoring review.');
  };

  const handleReject = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
    );
    toast?.info?.('Road hazard report dismissed as duplicate or insufficient evidence.');
  };

  return (
    <div
      role="region"
      aria-label="Citizen Road Hazard Moderation Queue"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginTop: '2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="#ef4444" />
            Citizen Road Hazard Moderation Queue
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            Review, validate, and incorporate crowdsourced road hazard reports into blackspot scoring (#769).
          </p>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            fontWeight: '700',
          }}
        >
          {items.filter((i) => i.status === 'pending_review').length} Pending Review
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((item) => {
          const isPending = item.status === 'pending_review';
          const isApproved = item.status === 'approved';
          const safeUrl = safeHttpUrl(item.evidenceUrl);

          return (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--border-main)',
                borderRadius: '0.5rem',
                padding: '0.85rem 1rem',
                background: 'var(--bg-main)',
                opacity: isPending ? 1 : 0.75,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {item.corridorName || item.segmentId}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: 'var(--accent-main)',
                      }}
                    >
                      {item.hazardType.replace(/_/g, ' ')}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <Clock size={12} /> {item.submittedAt.split('T')[0]}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: '1.4' }}>
                    {item.description}
                  </p>
                  {item.locationHint && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                      <strong>Location Hint:</strong> {item.locationHint}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldCheck size={12} color="var(--accent-main)" /> Seal: <code>{item.verificationSeal}</code>
                    </span>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--accent-main)' }}
                      >
                        Official Evidence <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApprove(item.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Validate</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleReject(item.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      >
                        <XCircle size={13} />
                        <span>Dismiss</span>
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: isApproved ? '#10b981' : '#ef4444',
                        background: isApproved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      {isApproved ? 'Approved' : 'Dismissed'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

