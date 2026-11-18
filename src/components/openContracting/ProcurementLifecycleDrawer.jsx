import {
  X,
  FileText,
  Users,
  Award,
  GitCommit,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { REVIEW_STATUSES } from '../../data/openContractingContract.js';

export default function ProcurementLifecycleDrawer({ lifecycle, onClose, onReviewFlag, userRole }) {
  if (!lifecycle || !lifecycle.notice) return null;

  const { notice, bids = [], award, amendments = [], redFlags = [] } = lifecycle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lifecycle-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card modal-content"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card, #0f172a)',
          color: 'var(--text-primary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
              Linked Procurement Lifecycle
            </div>
            <h2 id="lifecycle-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>
              {notice.title}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ref: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{notice.tenderRefNumber}</span> • {notice.issuingAuthority} ({notice.jurisdiction})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lifecycle inspector"
            className="btn btn-secondary"
            style={{ padding: '0.4rem', borderRadius: '50%', minWidth: 'auto' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Stage Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Stage 1: Notice Publication */}
          <div
            style={{
              borderLeft: '3px solid #38bdf8',
              paddingLeft: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <FileText size={16} color="#38bdf8" aria-hidden="true" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Stage 1: Tender Notice &amp; Advertisement
              </h3>
            </div>
            <div style={{ fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.375rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Value: </span>
                <strong>₹{Number(notice.estimatedValue).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Method: </span>
                <strong style={{ textTransform: 'capitalize' }}>{notice.procurementMethod?.replace('_', ' ')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Published: </span>
                <strong>{notice.publicationDate?.slice(0, 10)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Closing Date: </span>
                <strong>{notice.submissionDeadline?.slice(0, 10)}</strong>
              </div>
            </div>
            {notice.sourceUrl && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                <a
                  href={notice.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ExternalLink size={12} aria-hidden="true" />
                  View Published Tender Notice on Official Portal
                </a>
                {notice.sourceDocumentHash && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    SHA-256 Seal: <code>{notice.sourceDocumentHash}</code>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stage 2: Bids Received */}
          <div style={{ borderLeft: '3px solid #fbbf24', paddingLeft: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Users size={16} color="#fbbf24" aria-hidden="true" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Stage 2: Bids Received ({bids.length} Submissions)
              </h3>
            </div>
            {bids.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No bids submitted yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.4rem' }}>Rank</th>
                      <th style={{ padding: '0.4rem' }}>Bidder Entity</th>
                      <th style={{ padding: '0.4rem' }}>Bid Amount</th>
                      <th style={{ padding: '0.4rem' }}>Technical Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.4rem', fontWeight: 600 }}>L{b.rank}</td>
                        <td style={{ padding: '0.4rem' }}>{b.vendorName}</td>
                        <td style={{ padding: '0.4rem' }}>₹{Number(b.bidAmount).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '0.4rem' }}>
                          {b.isTechnicallyQualified ? (
                            <span style={{ color: '#4ade80' }}>Qualified</span>
                          ) : (
                            <span style={{ color: '#f87171' }}>Disqualified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stage 3: Contract Award */}
          <div style={{ borderLeft: '3px solid #34d399', paddingLeft: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Award size={16} color="#34d399" aria-hidden="true" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Stage 3: Contract Award
              </h3>
            </div>
            {award ? (
              <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Winning Contractor: </span>
                  <strong>{award.vendor ? award.vendor.name : award.vendorId}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Awarded Amount: </span>
                  <strong style={{ color: '#34d399' }}>₹{Number(award.awardedAmount).toLocaleString('en-IN')}</strong>{' '}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({((Number(award.awardedAmount) / Number(notice.estimatedValue)) * 100).toFixed(1)}% of estimate)
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Contract Signed: </span>
                  <strong>{award.contractSigningDate?.slice(0, 10)}</strong>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Award pending evaluation.</p>
            )}
          </div>

          {/* Stage 4: Amendments */}
          <div style={{ borderLeft: '3px solid #a855f7', paddingLeft: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <GitCommit size={16} color="#a855f7" aria-hidden="true" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Stage 4: Contract Amendments ({amendments.length} Variations)
              </h3>
            </div>
            {amendments.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No contract variations recorded (clean implementation).</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {amendments.map((am) => (
                  <div key={am.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.65rem', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Variation: +₹{Number(am.costDelta).toLocaleString('en-IN')} (+{am.percentageVariation}%)</span>
                      <span style={{ color: 'var(--text-muted)' }}>{am.amendmentDate?.slice(0, 10)}</span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#cbd5e1', fontSize: '0.75rem' }}>
                      {am.statutoryRationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage 5: Flags & Auditor Reviews */}
          <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <ShieldCheck size={16} color="#ef4444" aria-hidden="true" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Stage 5: Red-Flag Findings &amp; Audit Trail
              </h3>
            </div>
            {redFlags.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#4ade80', margin: 0 }}>No red flags detected on this notice.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {redFlags.map((flag) => {
                  const statusInfo = REVIEW_STATUSES[flag.status] || { label: flag.status };
                  return (
                    <div
                      key={flag.id}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <strong style={{ color: '#f87171' }}>{flag.title}</strong>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', background: 'rgba(255,255,255,0.1)' }}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: '#cbd5e1' }}>{flag.explanation}</p>
                      {userRole !== 'citizen' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => onReviewFlag(flag)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            Update Audit Review
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
