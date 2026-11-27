import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

export default function AddressChangeCorrectionQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      id: 'sub_seed_ac_01',
      recordId: 'driving-licence-address-change',
      recordName: 'Driving Licence Change of Address (Sarathi / Parivahan)',
      proposedDetails: 'Transport Department of Delhi launched contactless Aadhaar e-KYC service for DL address change without requiring in-person RTO visit.',
      officialSourceUrl: 'https://transport.delhi.gov.in/transport/contactless-services',
      stateScope: 'Delhi',
      moveTypeScope: 'all',
      submittedAt: '2026-11-13T10:00:00Z',
      status: 'pending_review',
      seal: 'AC-CORR-1A90-44F2',
    },
    {
      id: 'sub_seed_ac_02',
      recordId: 'ration-card-address-transfer',
      recordName: 'Ration Card / PDS Beneficiary Record Transfer',
      proposedDetails: 'Updated Maharashtra Food & Civil Supplies circular on RCMS portal link for online taluka transfers.',
      officialSourceUrl: 'https://mahafood.gov.in/website/english/Download.aspx',
      stateScope: 'Maharashtra',
      moveTypeScope: 'inter_district',
      submittedAt: '2026-11-14T08:30:00Z',
      status: 'pending_review',
      seal: 'AC-CORR-88B1-09CD',
    },
  ]);

  useEffect(() => {
    fetch('/api/address-change-corrections')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.queue) && data.queue.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = data.queue.filter((i) => !existingIds.has(i.id));
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
    toast?.success?.('Correction approved and queued for catalog deployment.');
  };

  const handleReject = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
    );
    toast?.info?.('Correction rejected.');
  };

  const pendingCount = items.filter((i) => i.status === 'pending_review').length;

  return (
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginTop: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #e5e7eb)',
          paddingBottom: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation size={20} color="var(--accent-main, #2563eb)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            Moving-Home Address Change Corrections Queue
          </h3>
          <span
            style={{
              fontSize: '0.75rem',
              backgroundColor: pendingCount > 0 ? '#fef3c7' : '#f3f4f6',
              color: pendingCount > 0 ? '#92400e' : '#4b5563',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontWeight: 600,
            }}
          >
            {pendingCount} Pending
          </span>
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Review community-submitted gazette updates, state portal changes, and broken link reports. Every approval requires verifying the official dated government source link.
      </p>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          No community correction reports in the queue.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--border-light, #e5e7eb)',
                borderRadius: '0.5rem',
                padding: '1rem',
                backgroundColor: item.status === 'approved' ? '#f0fdf4' : item.status === 'rejected' ? '#fef2f2' : 'var(--bg-page, #ffffff)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {item.recordName}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({item.recordId})</span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Scope: <strong>{item.moveTypeScope}</strong></span>
                    <span>State: <strong>{item.stateScope}</strong></span>
                    <span>Seal: <strong>{item.seal}</strong></span>
                    <span>Submitted: {new Date(item.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      backgroundColor: item.status === 'approved' ? '#dcfce7' : item.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                      color: item.status === 'approved' ? '#166534' : item.status === 'rejected' ? '#991b1b' : '#92400e',
                    }}
                  >
                    {item.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {item.proposedDetails}
              </div>

              <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid var(--border-light, #f3f4f6)', paddingTop: '0.5rem' }}>
                <div>
                  <a
                    href={safeHttpUrl(item.officialSourceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8rem', color: 'var(--accent-main, #2563eb)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'underline' }}
                  >
                    <ExternalLink size={13} /> Verify Official Source URL ↗
                  </a>
                </div>

                {item.status === 'pending_review' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(item.id)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <XCircle size={13} /> Reject
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

