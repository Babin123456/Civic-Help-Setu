import { useState, useMemo } from 'react';
import {
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Search,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import {
  findDuplicateCandidates,
  setPairReviewStatus,
  REVIEW_STATUS,
  DEFAULT_SIMILARITY_THRESHOLD,
} from '../../services/duplicateServiceDetector';
import { safeHttpUrl } from '../../utils/safeContent';

export default function DuplicateServiceDetectorPanel({ services = [], onRefresh }) {
  const [threshold, setThreshold] = useState(DEFAULT_SIMILARITY_THRESHOLD);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPair, setSelectedPair] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Compute duplicate candidates dynamically
  const candidates = useMemo(() => {
    return findDuplicateCandidates(services, {
      threshold,
      statusFilter,
    });
  }, [services, threshold, statusFilter]);

  // Filter candidates by search term
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.serviceA.title.toLowerCase().includes(q) ||
        c.serviceB.title.toLowerCase().includes(q) ||
        (c.serviceA.department && c.serviceA.department.toLowerCase().includes(q)) ||
        (c.serviceB.department && c.serviceB.department.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  const handleStatusChange = (pairId, newStatus) => {
    const success = setPairReviewStatus(
      pairId,
      newStatus,
      adminNotes,
      'Administrator'
    );
    if (success) {
      setFeedbackMsg({
        type: 'success',
        text: `Pair updated to "${newStatus.replace('_', ' ')}". No catalogue records were altered.`,
      });
      setAdminNotes('');
      if (onRefresh) onRefresh();
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case REVIEW_STATUS.CONFIRMED_DUPLICATE:
        return (
          <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            Confirmed Duplicate
          </span>
        );
      case REVIEW_STATUS.MARKED_DISTINCT:
        return (
          <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            Marked Distinct
          </span>
        );
      default:
        return (
          <span style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            Review Pending
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Policy Notice */}
      <div style={{ backgroundColor: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Sparkles style={{ width: '1.4rem', height: '1.4rem', color: 'var(--color-primary, #2563eb)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
            Duplicate & Near-Duplicate Service Detector
          </h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #64748b)', margin: '0 0 0.75rem 0' }}>
          Scans all catalogued and draft civic services to flag overlapping records based on title semantics, department, jurisdiction, and official endpoints.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', borderRadius: '0.35rem', fontSize: '0.8125rem', color: '#334155' }}>
          <ShieldCheck style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb', flexShrink: 0 }} />
          <span>
            <strong>Safety Guardrail:</strong> The detector is strictly advisory. It will never auto-delete, auto-merge, or modify services without explicit administrative review and confirmation.
          </span>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '0.75rem', padding: '1rem' }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Filter by title or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.2rem', borderRadius: '0.375rem', border: '1px solid var(--color-border, #cbd5e1)', fontSize: '0.875rem' }}
          />
        </div>

        {/* Threshold Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sliders style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
          <label htmlFor="dup-threshold" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #1e293b)' }}>
            Sensitivity Threshold: {Math.round(threshold * 100)}%
          </label>
          <input
            id="dup-threshold"
            type="range"
            min="0.40"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ width: '120px', cursor: 'pointer' }}
          />
        </div>

        {/* Review Status Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
          {['ALL', 'PENDING', 'CONFIRMED_DUPLICATE', 'MARKED_DISTINCT'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              style={{
                border: 'none',
                background: statusFilter === status ? '#ffffff' : 'transparent',
                fontWeight: statusFilter === status ? 600 : 500,
                color: statusFilter === status ? '#0f172a' : '#64748b',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: statusFilter === status ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {feedbackMsg && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: feedbackMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${feedbackMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: feedbackMsg.type === 'success' ? '#166534' : '#991b1b', fontSize: '0.875rem' }}>
          {feedbackMsg.text}
        </div>
      )}

      {/* Candidate List */}
      {filteredCandidates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '0.75rem' }}>
          <CheckCircle style={{ width: '2.5rem', height: '2.5rem', color: '#16a34a', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
            No Duplicate Candidates Found
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #64748b)', margin: 0 }}>
            {statusFilter !== 'ALL'
              ? `No pairs match the "${statusFilter.replace('_', ' ')}" filter at ${Math.round(threshold * 100)}% threshold.`
              : `All catalogued services appear distinct above the ${Math.round(threshold * 100)}% similarity threshold.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredCandidates.map((candidate) => {
            const { pairId, serviceA, serviceB, similarity, reviewStatus, reviewNotes } = candidate;
            const scorePercent = Math.round(similarity.score * 100);

            return (
              <div
                key={pairId}
                style={{
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                {/* Pair Header */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border, #f1f5f9)', paddingBottom: '0.75rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      backgroundColor: similarity.confidenceLevel === 'HIGH' ? '#fee2e2' : '#fef3c7',
                      color: similarity.confidenceLevel === 'HIGH' ? '#991b1b' : '#92400e',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}>
                      <AlertTriangle style={{ width: '0.9rem', height: '0.9rem' }} />
                      {scorePercent}% Similarity ({similarity.confidenceLevel})
                    </div>
                    {getStatusBadge(reviewStatus)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Pair ID: {pairId}
                  </span>
                </div>

                {/* Side-by-Side Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {/* Service A */}
                  <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Candidate Service 1 (ID: {serviceA.id})
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                      {serviceA.title || serviceA.name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.25rem' }}>
                      <strong>Dept:</strong> {serviceA.department || 'Not listed'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.25rem' }}>
                      <strong>Jurisdiction:</strong> {serviceA.jurisdiction || serviceA.state || 'National'}
                    </div>
                    {serviceA.officialUrl && (
                      <div style={{ fontSize: '0.8125rem', color: '#2563eb', marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={safeHttpUrl(serviceA.officialUrl) || undefined} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2563eb', textDecoration: 'underline' }}>
                          Official URL <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} />
                        </a>
                      </div>
                    )}
                    <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0, maxHeight: '4.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {serviceA.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Service B */}
                  <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Candidate Service 2 (ID: {serviceB.id})
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                      {serviceB.title || serviceB.name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.25rem' }}>
                      <strong>Dept:</strong> {serviceB.department || 'Not listed'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.25rem' }}>
                      <strong>Jurisdiction:</strong> {serviceB.jurisdiction || serviceB.state || 'National'}
                    </div>
                    {serviceB.officialUrl && (
                      <div style={{ fontSize: '0.8125rem', color: '#2563eb', marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={safeHttpUrl(serviceB.officialUrl) || undefined} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2563eb', textDecoration: 'underline' }}>
                          Official URL <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} />
                        </a>
                      </div>
                    )}
                    <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0, maxHeight: '4.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {serviceB.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Similarity Breakdown & Reasons */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '0.5rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Match Assessment & Field Breakdown:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    {similarity.matchedFields.map((f) => (
                      <span key={f} style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        ✓ Matched {f}
                      </span>
                    ))}
                    {similarity.differingFields.map((f) => (
                      <span key={f} style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        ✕ Differing {f}
                      </span>
                    ))}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.775rem', color: '#475569' }}>
                    {similarity.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Review Controls & Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderTop: '1px solid var(--color-border, #f1f5f9)', paddingTop: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder="Optional admin review notes / rationale..."
                      defaultValue={reviewNotes}
                      onBlur={(e) => setAdminNotes(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(pairId, REVIEW_STATUS.CONFIRMED_DUPLICATE)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <CheckCircle style={{ width: '0.85rem', height: '0.85rem' }} />
                      Confirm Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(pairId, REVIEW_STATUS.MARKED_DISTINCT)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <XCircle style={{ width: '0.85rem', height: '0.85rem' }} />
                      Mark Distinct
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(pairId, REVIEW_STATUS.PENDING)}
                      title="Reset to Pending"
                      style={{
                        padding: '0.4rem 0.5rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw style={{ width: '0.85rem', height: '0.85rem' }} />
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
