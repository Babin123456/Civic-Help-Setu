import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import AccessibleModal from '../common/AccessibleModal';
import { REVIEW_DECISIONS } from '../../services/publicProjectService';
import { generateDiscrepancyHint, DISCREPANCY_LEVELS } from '../../services/evidenceVerificationService';

const EvidenceReviewModal = ({
  isOpen,
  onClose,
  project,
  milestone,
  submission,
  onSaveReview,
}) => {
  const [decision, setDecision] = useState(REVIEW_DECISIONS.APPROVE);
  const [findings, setFindings] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Bounded AI Discrepancy Recommendation derived via useMemo
  const discrepancyHint = useMemo(() => {
    if (!isOpen || !milestone) return null;
    return generateDiscrepancyHint({
      baselineAsset: { capturedAt: project?.startDate || '2026-04-15' },
      currentAsset: { storageUrl: 'https://preview.jpg', capturedAt: submission?.submissionDate },
      projectCategory: project?.category || 'roads',
      milestoneCriteria: milestone?.completionCriteria || [],
    });
  }, [isOpen, project, milestone, submission]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!findings || findings.trim().length < 15) {
      setErrorMessage('Verification findings must be at least 15 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      onSaveReview({
        projectId: project.id,
        milestoneId: milestone.id,
        submissionId: submission ? submission.id : `sub-${milestone.id}`,
        decision,
        findings: findings.trim(),
        overrideReason: overrideReason.trim(),
        automatedHint: discrepancyHint,
      });
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record verification review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!milestone) return null;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify Milestone Evidence & Record Decision"
      subtitle={`Stage ${milestone.sequenceOrder}: ${milestone.title}`}
      maxWidth="680px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Project Context Pill */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.2rem' }}>
            {project?.title}
          </div>
          <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.78rem' }}>
            Jurisdiction: {project?.jurisdiction?.wardNumber} • Weight: {milestone.weightPercentage}% of total budget
          </div>
        </div>

        {/* Bounded Intelligence / CV Discrepancy Advisory Card */}
        {discrepancyHint && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-main, #38bdf8)' }}>
                <Sparkles size={16} />
                <span>Bounded Computer Vision Discrepancy Advisory</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace' }}>
                Ruleset: {discrepancyHint.rulesetVersion}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background:
                    discrepancyHint.discrepancyLevel === DISCREPANCY_LEVELS.LOW
                      ? 'rgba(16, 185, 129, 0.15)'
                      : discrepancyHint.discrepancyLevel === DISCREPANCY_LEVELS.MODERATE
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                  color:
                    discrepancyHint.discrepancyLevel === DISCREPANCY_LEVELS.LOW
                      ? '#10b981'
                      : discrepancyHint.discrepancyLevel === DISCREPANCY_LEVELS.MODERATE
                        ? '#f59e0b'
                        : '#ef4444',
                }}
              >
                Score: {discrepancyHint.discrepancyScore !== null ? `${discrepancyHint.discrepancyScore * 100}% Variance` : 'N/A'} ({discrepancyHint.discrepancyLevel})
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Window: {discrepancyHint.featureWindow.timeSpanDays} days elapsed
              </span>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-primary, #f8fafc)', lineHeight: 1.4 }}>
              {discrepancyHint.explanation}
            </p>

            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {discrepancyHint.influencingFactors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>

            <div
              style={{
                marginTop: '0.6rem',
                fontSize: '0.7rem',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontStyle: 'italic',
              }}
            >
              <AlertTriangle size={12} />
              <span>
                Safety Invariant: Computer vision serves only as a discrepancy hint. Authorized human verification is required.
              </span>
            </div>
          </div>
        )}

        {/* Decision Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary, #f8fafc)' }}>
            Reviewer Determination <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <button
              type="button"
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: decision === REVIEW_DECISIONS.APPROVE ? '2px solid #10b981' : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                background: decision === REVIEW_DECISIONS.APPROVE ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                color: decision === REVIEW_DECISIONS.APPROVE ? '#10b981' : 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onClick={() => setDecision(REVIEW_DECISIONS.APPROVE)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} />
                <span>Approve Milestone</span>
              </div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                Evidence matches criteria; releases progress milestone.
              </div>
            </button>

            <button
              type="button"
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: decision === REVIEW_DECISIONS.REQUEST_EVIDENCE ? '2px solid #f59e0b' : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                background: decision === REVIEW_DECISIONS.REQUEST_EVIDENCE ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.2)',
                color: decision === REVIEW_DECISIONS.REQUEST_EVIDENCE ? '#f59e0b' : 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onClick={() => setDecision(REVIEW_DECISIONS.REQUEST_EVIDENCE)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                <HelpCircle size={16} />
                <span>Request Evidence</span>
              </div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                Requires additional laboratory or site core measurements.
              </div>
            </button>

            <button
              type="button"
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: decision === REVIEW_DECISIONS.REJECT ? '2px solid #ef4444' : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                background: decision === REVIEW_DECISIONS.REJECT ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0,0,0,0.2)',
                color: decision === REVIEW_DECISIONS.REJECT ? '#ef4444' : 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onClick={() => setDecision(REVIEW_DECISIONS.REJECT)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                <XCircle size={16} />
                <span>Reject / Dispute</span>
              </div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                Work fails specifications or non-compliance observed.
              </div>
            </button>
          </div>
        </div>

        {/* Verification Findings Textarea */}
        <div>
          <label htmlFor="findings-textarea" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary, #f8fafc)' }}>
            Official Verification Audit Findings <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            id="findings-textarea"
            rows={3}
            placeholder="Record detailed observations, test report numbers, and site inspection measurements (min 15 characters)..."
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '6px',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Override Justification */}
        <div>
          <label htmlFor="override-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary, #f8fafc)' }}>
            Reviewer Override / Deviation Note (Optional)
          </label>
          <input
            id="override-input"
            type="text"
            placeholder="Reason for deviation from planned timeline, specification, or advisory..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '6px',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            style={{
              padding: '0.6rem 0.8rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.8rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Recording...' : 'Commit Verification Decision'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
};

export default EvidenceReviewModal;
