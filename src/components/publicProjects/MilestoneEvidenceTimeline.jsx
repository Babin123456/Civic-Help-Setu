import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Camera,
  MapPin,
  ChevronDown,
  ChevronUp,
  Send,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';
import {
  MILESTONE_STATUSES,
} from '../../services/publicProjectService';

const MILESTONE_STATUS_CONFIG = {
  [MILESTONE_STATUSES.PENDING]: {
    label: 'Pending',
    icon: Clock,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
  },
  [MILESTONE_STATUSES.IN_PROGRESS]: {
    label: 'In Progress',
    icon: Clock,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
  },
  [MILESTONE_STATUSES.SUBMITTED]: {
    label: 'Evidence Submitted (Pending Review)',
    icon: FileText,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
  },
  [MILESTONE_STATUSES.VERIFIED]: {
    label: 'Independently Verified',
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
  },
  [MILESTONE_STATUSES.REJECTED]: {
    label: 'Disputed / Revision Needed',
    icon: AlertCircle,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
  },
};

const MilestoneEvidenceTimeline = ({
  milestones = [],
  submissions = [],
  evidenceAssets = [],
  verificationReviews = [],
  canVerify = false,
  onOpenSubmitProgress,
  onOpenVerifyReview,
}) => {
  const [expandedMilestones, setExpandedMilestones] = useState(() => {
    // Expand active/submitted milestone by default
    const set = new Set();
    const active = milestones.find(
      (m) => m.status === MILESTONE_STATUSES.SUBMITTED || m.status === MILESTONE_STATUSES.IN_PROGRESS
    );
    if (active) set.add(active.id);
    return set;
  });

  const toggleExpand = (id) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!milestones || milestones.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
        No milestone timeline available for this project.
      </div>
    );
  }

  return (
    <div className="milestone-evidence-timeline" style={{ position: 'relative', paddingLeft: '1.5rem' }}>
      {/* Vertical Track Line */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          bottom: '1rem',
          left: '11px',
          width: '2px',
          background: 'var(--border-light, rgba(255, 255, 255, 0.12))',
          zIndex: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {milestones.map((ms) => {
          const cfg = MILESTONE_STATUS_CONFIG[ms.status] || MILESTONE_STATUS_CONFIG[MILESTONE_STATUSES.PENDING];
          const Icon = cfg.icon;
          const isExpanded = expandedMilestones.has(ms.id);

          const msSubmissions = submissions.filter((s) => s.milestoneId === ms.id);
          const msAssets = evidenceAssets.filter((a) => a.milestoneId === ms.id);
          const msReviews = verificationReviews.filter((r) => r.milestoneId === ms.id);

          return (
            <div
              key={ms.id}
              style={{
                position: 'relative',
                background: 'var(--bg-card, #1e293b)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                borderRadius: '10px',
                padding: '1.25rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
            >
              {/* Timeline Node Bullet */}
              <div
                style={{
                  position: 'absolute',
                  left: '-1.85rem',
                  top: '1.25rem',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--bg-card, #1e293b)',
                  border: `2px solid ${cfg.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: cfg.color,
                  zIndex: 1,
                }}
              >
                <Icon size={13} />
              </div>

              {/* Milestone Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  cursor: 'pointer',
                }}
                onClick={() => toggleExpand(ms.id)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(ms.id);
                  }
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-secondary, #cbd5e1)',
                      }}
                    >
                      Stage {ms.sequenceOrder}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        background: cfg.bg,
                        color: cfg.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Icon size={12} />
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      Weight: {ms.weightPercentage}%
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                    {ms.title}
                  </h4>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.4 }}>
                    {ms.description}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    <div>Target: {ms.targetDate}</div>
                    {ms.verifiedDate && (
                      <div style={{ color: '#10b981', fontWeight: 600 }}>
                        Verified: {ms.verifiedDate.slice(0, 10)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', padding: '0.2rem' }}
                    aria-label={isExpanded ? 'Collapse milestone details' : 'Expand milestone details'}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Completion Criteria Checklist */}
              {Array.isArray(ms.completionCriteria) && ms.completionCriteria.length > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
                    Statutory Verification Criteria:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                    {ms.completionCriteria.map((c, idx) => (
                      <li key={idx} style={{ marginBottom: '0.2rem' }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expanded Content: Submissions, Evidence Assets & Reviews */}
              {isExpanded && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-light, rgba(255, 255, 255, 0.1))' }}>
                  {/* Action Buttons for this Milestone */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {ms.status !== MILESTONE_STATUSES.VERIFIED && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => onOpenSubmitProgress && onOpenSubmitProgress(ms)}
                      >
                        <Send size={14} />
                        Submit Progress Evidence
                      </button>
                    )}

                    {canVerify && ms.status === MILESTONE_STATUSES.SUBMITTED && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => onOpenVerifyReview && onOpenVerifyReview(ms, msSubmissions[0])}
                      >
                        <ShieldCheck size={14} />
                        Verify Evidence & Record Decision
                      </button>
                    )}
                  </div>

                  {/* Evidence Assets Gallery */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Camera size={14} style={{ color: 'var(--accent-main, #38bdf8)' }} />
                      <span>Submitted Evidence Assets ({msAssets.length})</span>
                    </div>

                    {msAssets.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic' }}>
                        No photographic evidence submitted for this milestone stage yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                        {msAssets.map((asset) => (
                          <div
                            key={asset.id}
                            style={{
                              background: 'rgba(0, 0, 0, 0.25)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '0.6rem',
                              fontSize: '0.75rem',
                            }}
                          >
                            <div
                              style={{
                                height: '110px',
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '0.5rem',
                                border: '1px dashed rgba(255, 255, 255, 0.1)',
                                position: 'relative',
                              }}
                            >
                              <Camera size={24} style={{ color: 'var(--accent-main, #38bdf8)', marginBottom: '0.3rem' }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)' }}>
                                Site Photo Inspection
                              </span>

                              {/* Redaction Shield Pill */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '6px',
                                  right: '6px',
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  borderRadius: '999px',
                                  padding: '0.1rem 0.4rem',
                                  fontSize: '0.65rem',
                                  color: '#10b981',
                                  fontWeight: 600,
                                }}
                              >
                                Redacted
                              </div>
                            </div>

                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.2rem' }}>
                              {asset.caption || 'Field Verification Capture'}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.3rem' }}>
                              <MapPin size={11} />
                              <span>
                                {asset.geoTag ? `${asset.geoTag.lat.toFixed(4)}, ${asset.geoTag.lng.toFixed(4)}` : 'Coordinates recorded'}
                              </span>
                            </div>

                            <div
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.65rem',
                                color: 'var(--accent-main, #38bdf8)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={`SHA-256 Hash: ${asset.assetHash}`}
                            >
                              Hash: {asset.assetHash ? asset.assetHash.slice(0, 16) + '...' : 'Verified'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submissions & Reviews History */}
                  {msReviews.length > 0 && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        <FileCheck2 size={16} />
                        <span>Authorized Verification Audit Finding</span>
                      </div>
                      {msReviews.map((rev) => (
                        <div key={rev.id} style={{ fontSize: '0.8rem', color: 'var(--text-primary, #f8fafc)' }}>
                          <p style={{ margin: '0 0 0.35rem 0' }}>{rev.findings}</p>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                            Verified by: <strong>{rev.reviewerName}</strong> on {rev.decisionTimestamp?.slice(0, 10)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestoneEvidenceTimeline;
