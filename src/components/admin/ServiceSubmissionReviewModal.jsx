import { useState } from 'react';
import AccessibleModal from '../common/AccessibleModal';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Clock,
  User,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

const ServiceSubmissionReviewModal = ({
  isOpen,
  onClose,
  submission,
  onApprove = () => {},
  onReject = () => {},
}) => {
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onApprove(submission.id, reviewNotes);
      toast?.success?.(`Submission for "${submission.name}" approved and published.`);
      setIsProcessing(false);
      onClose();
    }, 400);
  };

  const handleReject = () => {
    if (!reviewNotes.trim()) {
      toast?.warning?.('Please provide rejection feedback for the contributor.');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      onReject(submission.id, reviewNotes);
      toast?.info?.(`Submission for "${submission.name}" rejected.`);
      setIsProcessing(false);
      onClose();
    }, 400);
  };

  if (!submission) return null;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Community Service Submission"
      subtitle={`Verify proposed civic information and official sources before publishing.`}
      maxWidth="620px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Contributor Pill */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.6rem',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.75rem' }}>
              Submitted by:
            </span>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
              {submission.submittedBy || 'Community Contributor'} ({submission.contributorEmail || 'contributor@civic.org'})
            </span>
          </div>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
            }}
          >
            Status: {submission.status || 'Pending Review'}
          </span>
        </div>

        {/* Proposal Details Card */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.6rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            fontSize: '0.875rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '700' }}>
              Service Name & Category:
            </span>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0.2rem 0', color: 'var(--text-primary)' }}>
              {submission.name} ({submission.category})
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              {submission.shortDescription}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Processing Time:</span>
              <p style={{ fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                {submission.processingTime || '15 - 30 days'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Fees / Government Charges:</span>
              <p style={{ fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                {submission.fees || 'Free'}
              </p>
            </div>
          </div>

          {/* Official Source Link */}
          {submission.officialUrl && (
            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.25rem' }}>
                Primary Official Government Source:
              </span>
              <a
                href={safeHttpUrl(submission.officialUrl) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent-main)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                <span>{submission.officialUrl}</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        {/* Reviewer Feedback Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Moderation Feedback / Audit Notes
          </label>
          <textarea
            rows={3}
            placeholder="Document verification remarks, corrections applied, or rejection rationale..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            className="input-field"
            style={{ width: '100%', borderRadius: '0.5rem', padding: '0.6rem' }}
          />
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleReject}
            className="btn"
            style={{
              flex: 1,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              padding: '0.6rem 1rem',
            }}
          >
            <XCircle size={16} /> Reject Submission
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleApprove}
            className="btn btn-primary"
            style={{
              flex: 2,
              borderRadius: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <CheckCircle2 size={16} /> Approve & Publish Live
          </button>
        </div>
      </div>
    </AccessibleModal>
  );
};

export default ServiceSubmissionReviewModal;
