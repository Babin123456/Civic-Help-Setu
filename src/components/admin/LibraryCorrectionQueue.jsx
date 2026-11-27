import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

export default function LibraryCorrectionQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState([
    {
      id: 'sub_lib_seed_101',
      libraryId: 'delhi-public-library-central',
      libraryName: 'Delhi Public Library - Central Library',
      proposedChange: 'Delhi Public Library Board gazette notice: Sunday reading room operating hours extended to 08:00 AM - 08:00 PM for competitive exam students.',
      officialSourceUrl: 'https://dpl.gov.in/notices/extended-reading-hours-2026',
      contributorRole: 'librarian',
      submittedAt: '2026-11-10T09:00:00Z',
      status: 'pending_review',
      verificationSeal: 'LIB-CORR-A421-99B0',
    },
    {
      id: 'sub_lib_seed_102',
      libraryId: 'anna-centenary-library-chennai',
      libraryName: 'Anna Centenary Library - Kotturpuram',
      proposedChange: 'Tamil Nadu Public Library Commission circular: Sugamya Pustakalaya DAISY screen reader section expanded with 12 new high-contrast Braille terminals.',
      officialSourceUrl: 'https://annacentenarylibrary.org/news/braille-section-upgrade',
      contributorRole: 'citizen',
      submittedAt: '2026-11-12T14:30:00Z',
      status: 'pending_review',
      verificationSeal: 'LIB-CORR-7B14-88E2',
    },
  ]);

  useEffect(() => {
    // Attempt fetching live items from API
    fetch('/api/library-corrections')
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
        // Fallback to initial seed items
      });
  }, []);

  const handleApprove = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'approved' } : item))
    );
    toast?.success?.('Library correction verified against official source and approved.');
  };

  const handleReject = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
    );
    toast?.info?.('Library correction rejected.');
  };

  const pending = items.filter((i) => i.status === 'pending_review');

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginTop: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} style={{ color: 'var(--accent-main)' }} />
            Public Library & Learning Resource Corrections Queue
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
            Unverified community submissions and librarian updates pending dated gazette or institutional portal verification.
          </p>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '9999px',
            backgroundColor: pending.length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(22, 163, 74, 0.15)',
            color: pending.length > 0 ? 'var(--warning, #f59e0b)' : 'var(--success, #16a34a)',
          }}
        >
          {pending.length} Pending
        </span>
      </div>

      {pending.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          No pending library corrections. All records match dated official sources.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pending.map((item) => {
            const safeSource = safeHttpUrl(item.officialSourceUrl);
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-main)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {item.libraryName}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                      ({item.libraryId})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-main)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.verificationSeal}
                    </code>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: item.contributorRole === 'librarian' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: item.contributorRole === 'librarian' ? 'var(--accent-main)' : 'var(--text-secondary)',
                      }}
                    >
                      Role: {item.contributorRole}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>Proposed Change:</strong> {item.proposedChange}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
                  {safeSource ? (
                    <a
                      href={safeSource}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--accent-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        textDecoration: 'underline',
                      }}
                    >
                      Verify Official Source <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      No valid source URL
                    </span>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleReject(item.id)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-main)',
                        borderRadius: '4px',
                        color: 'var(--danger, #ef4444)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--accent-main)',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <CheckCircle2 size={14} /> Approve & Verify
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

