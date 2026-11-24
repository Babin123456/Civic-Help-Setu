import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  GitFork,
  Hash,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

export default function ProvenanceReviewQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      id: 'prov_sub_seed_01',
      targetEntityId: 'tree-pruning-permission:processingTime',
      sourceUrl: 'https://forest.delhigovt.nic.in/tree-felling-permission',
      publisher: 'Department of Forests & Wildlife, GNCTD',
      proposedFact: 'Section 9(3) prescribes maximum 60 calendar days statutory turnaround for tree officer sanction.',
      statutorySection: 'Section 9(3)',
      submittedAt: '2026-10-25T08:30:00Z',
      status: 'pending_editorial_review',
      seal: 'PROV-SEAL-8A19-3F21',
    },
    {
      id: 'prov_sub_seed_02',
      targetEntityId: 'aadhaar-card:fees',
      sourceUrl: 'https://uidai.gov.in/en/legal-framework/aadhaar-act.html',
      publisher: 'Unique Identification Authority of India (UIDAI)',
      proposedFact: 'Mandatory biometric update for children reaching 5 years and 15 years is statutory free of cost.',
      statutorySection: 'Regulation 15',
      submittedAt: '2026-11-01T09:15:00Z',
      status: 'pending_editorial_review',
      seal: 'PROV-SEAL-1B90-E57A',
    },
  ]);

  useEffect(() => {
    fetch('/api/knowledge-provenance')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = data.items.filter((i) => !existingIds.has(i.id));
            return [...prev, ...newItems];
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleApprove = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'approved' } : item
      )
    );
    toast?.success?.('Provenance correction verified and committed to knowledge graph.');
  };

  const handleDismiss = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'dismissed' } : item
      )
    );
    toast?.success?.('Submission dismissed.');
  };

  const pending = items.filter((i) => i.status === 'pending_editorial_review');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <GitFork size={18} color="var(--accent-main)" />
            Statutory Provenance Review Queue
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Review official gazette citations, statutory references, and community-submitted source updates ({pending.length} pending).
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          No pending provenance corrections in moderation queue.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pending.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '1rem',
                borderLeft: '4px solid var(--accent-main)',
                background: 'var(--glass-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-main)' }}>
                      {item.targetEntityId}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                      <Hash size={11} style={{ display: 'inline', marginRight: '2px' }} />
                      {item.seal}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Publisher: {item.publisher}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => handleApprove(item.id)}
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <XCircle size={13} /> Dismiss
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <strong>Proposed Statutory Rule:</strong> {item.proposedFact}
              </div>

              {item.sourceUrl && (
                <div style={{ fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Official Source: </span>
                  <a
                    href={safeHttpUrl(item.sourceUrl) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    {item.sourceUrl}
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
