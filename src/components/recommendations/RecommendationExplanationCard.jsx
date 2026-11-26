import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  X,
} from 'lucide-react';
import { recordFeedback } from '../../services/feedbackRankingPipelineService.js';

/**
 * RecommendationExplanationCard Component (#78)
 * Renders a ranked service recommendation with explicit match breakdown and reasonings.
 */
RecommendationExplanationCard = ({ recommendation, onFeedbackToggle }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!recommendation) return null;

  const {
    serviceId,
    serviceName,
    category,
    department,
    fees,
    processingTime,
    matchPercentage,
    matchedCriteria = [],
    unmetRequirements = [],
    unknownCriteria = [],
    needsOfficialVerification,
    disclaimer,
  } = recommendation;

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(null); // 1 = useful, -1 = not useful
  const [feedbackReason, setFeedbackReason] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Badge colors based on score
  const getScoreColor = (pct) => {
    if (pct >= 80) return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' };
    if (pct >= 55) return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
    return { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.3)' };
  };

  const scoreBadge = getScoreColor(matchPercentage);

  return (
    <div
      className="recommendation-explanation-card animate-fade-in"
      style={{
        background: 'var(--bg-card, #121212)',
        border: '1px solid var(--border-main, rgba(255, 255, 255, 0.12))',
        borderRadius: '1rem',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.5))',
        position: 'relative',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary, #a1a1aa)',
                letterSpacing: '0.05em',
              }}
            >
              {category} &bull; {department}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary, #ffffff)' }}>
            {serviceName}
          </h3>
        </div>

        {/* Match Percentage Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            background: scoreBadge.bg,
            color: scoreBadge.text,
            border: `1px solid ${scoreBadge.border}`,
            fontWeight: '800',
            fontSize: '0.9rem',
          }}
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>{matchPercentage}% Match</span>
        </div>

        {/* Feedback Trigger */}
        {onFeedbackToggle && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              background: 'rgba(156, 39, 176, 0.1)',
              border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
              fontSize: '0.8rem',
              color: '#9f7aea',
            }}
            onClick={() => onFeedbackToggle(serviceId)}
          >
            <Sparkles size={12} aria-hidden="true" />
            <span>Give Feedback</span>
          </div>
        )}
      </div>

      {/* Meta Pills */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '0.375rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary, #cbd5e1)' }}>
          Fees: <strong>{fees}</strong>
        </span>
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '0.375rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary, #cbd5e1)' }}>
          Time: <strong>{processingTime}</strong>
        </span>
      </div>

      {/* Primary Reason Excerpt */}
      {matchedCriteria.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: '#4ade80' }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{matchedCriteria[0]}</span>
        </div>
      )}

      {/* Warning if unmet criteria */}
      {unmetRequirements.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: '#fbbf24' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{unmetRequirements[0]}</span>
        </div>
      )}

      {/* Toggle Detailed Explanation */}
      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.4rem 0',
          color: 'var(--accent-main, #38bdf8)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.825rem',
          fontWeight: '700',
          textAlign: 'left',
          width: 'fit-content',
        }}
      >
        <span>{showDetails ? 'Hide Recommendation Breakdown' : 'Why is this recommended? (View Audit Breakdown)'}</span>
        {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded Breakdown */}
      {showDetails && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            fontSize: '0.825rem',
          }}
        >
          {/* Matched Criteria */}
          {matchedCriteria.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.4rem', color: '#4ade80', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700' }}>
                Satisfied / Positive Match Signals:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {matchedCriteria.map((c, idx) => (
                  <li key={idx} style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Unmet Criteria */}
          {unmetRequirements.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.4rem', color: '#f87171', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700' }}>
                Unmet / Conflicting Criteria:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {unmetRequirements.map((u, idx) => (
                  <li key={idx} style={{ color: '#fca5a5' }}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Unknown Criteria */}
          {unknownCriteria.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.4rem', color: '#93c5fd', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700' }}>
                Unknown / Unprovided Details (Not Assumed Satisfied):
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {unknownCriteria.map((unk, idx) => (
                  <li key={idx} style={{ color: '#bfdbfe' }}>{unk}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Verification notice */}
          {needsOfficialVerification && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.4rem',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'rgba(234, 179, 8, 0.08)',
                color: '#facc15',
                fontSize: '0.75rem',
              }}
            >
              <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Official verification required: Some eligibility factors or document originals require departmental authentication.
              </span>
            </div>
          )}

{/* Legal Disclaimer */}
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
            {disclaimer}
          </p>
        </div>

        {/* Feedback Section */}
        {showFeedback && (
          <div
            style={{
              padding: '0.875rem',
              borderRadius: '0.75rem',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
              marginTop: '0.5rem',
              fontSize: '0.825rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-primary, #ffffff)' }}>Was this recommendation useful?</span>
              <button
                type="button"
                onClick={() => setShowFeedback(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0.2rem',
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Rating */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setFeedbackRating(1)}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  borderRadius: '0.5rem',
                  background: feedbackRating === 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${feedbackRating === 1 ? '#4ade80' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                  color: feedbackRating === 1 ? '#4ade80' : 'var(--text-secondary, #cbd5e1)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                }}
                aria-pressed={feedbackRating === 1}
              >
                <ThumbsUp size={12} /> Useful
              </button>
              <button
                type="button"
                onClick={() => setFeedbackRating(-1)}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  borderRadius: '0.5rem',
                  background: feedbackRating === -1 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${feedbackRating === -1 ? '#facc15' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                  color: feedbackRating === -1 ? '#facc15' : 'var(--text-secondary, #cbd5e1)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                }}
                aria-pressed={feedbackRating === -1}
              >
                <ThumbsDown size={12} /> Not useful
              </button>
            </div>

            {/* Reason Selection */}
            {feedbackRating !== null && (
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.75rem' }}>Why?</span>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFeedbackReason('intent_mismatch')}
                    style={{
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.375rem',
                      background: feedbackReason === 'intent_mismatch' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0,0,0,0.1)',
                      border: `1px solid ${feedbackReason === 'intent_mismatch' ? '#38bdf8' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                      color: feedbackReason === 'intent_mismatch' ? '#38bdf8' : 'var(--text-secondary, #cbd5e1)',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                    }}
                  >
                    Goal mismatch
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackReason('document_missing')}
                    style={{
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.375rem',
                      background: feedbackReason === 'document_missing' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0,0,0,0.1)',
                      border: `1px solid ${feedbackReason === 'document_missing' ? '#4ade80' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                      color: feedbackReason === 'document_missing' ? '#4ade80' : 'var(--text-secondary, #cbd5e1)',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                    }}
                  >
                    Documents missing
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackReason('eligibility_unknown')}
                    style={{
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.375rem',
                      background: feedbackReason === 'eligibility_unknown' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(0,0,0,0.1)',
                      border: `1px solid ${feedbackReason === 'eligibility_unknown' ? '#facc15' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                      color: feedbackReason === 'eligibility_unknown' ? '#facc15' : 'var(--text-secondary, #cbd5e1)',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                    }}
                  >
                    Eligibility unclear
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackReason('other')}
                    style={{
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.375rem',
                      background: feedbackReason === 'other' ? 'rgba(156, 39, 176, 0.15)' : 'rgba(0,0,0,0.1)',
                      border: `1px solid ${feedbackReason === 'other' ? '#9f7aea' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                      color: feedbackReason === 'other' ? '#9f7aea' : 'var(--text-secondary, #cbd5e1)',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                    }}
                  >
                    Other
                  </button>
                </div>
              </div>
            )}

            {/* Free-text reason (optional)*/}
            {feedbackReason === 'other' && (
              <textarea
                rows={2}
                placeholder="Brief reason (optional)"
                style={{
                  width: '100%',
                  marginTop: '0.3rem',
                  padding: '0.4rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  resize: 'vertical',
                }}
              />
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={() => submitFeedback()}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'var(--accent-main, #38bdf8)',
                color: 'white',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Submit Feedback
            </button>
          </div>
        )}

        {/* Action Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light, rgba(255,255,255,0.08))', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to={`/services/${serviceId}`}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          <span>View Service Details & Checklist</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};

/* Submit feedback via the privacy-safe pipeline */
const submitFeedback = async () => {
  if (submittingFeedback) return;
  if (feedbackRating === null) return;

  setSubmittingFeedback(true);

  // Check consent - recommendation feedback falls under personalization consent
  const hasPersonalizationConsent = await checkPersonalizationConsent();

  if (!hasPersonalizationConsent) {
    setSubmittingFeedback(false);
    // Show consent prompt - in a real implementation, this would open a modal
    // For now, we'll record with a note that consent was pending
    setFeedbackRating(null);
    setFeedbackReason(null);
    return;
  }

  const reasonMap = {
    intent_mismatch: 'The recommended service did not match the user\'s selected goals or intent.',
    document_missing: 'The user does not have the required documents for the recommended service.',
    eligibility_unknown: 'Key eligibility criteria were not provided or were unknown.',
    other: feedbackReason || 'User indicated the recommendation was not useful.',
  };

  const note =
    feedbackReason === 'other'
      ? 'User selected Other and provided free-text explanation'
      : reasonMap[feedbackReason] || '';

  const { recorded } = await recordFeedback({
    queryText: serviceName,
    retrievedChunkIds: [serviceId],
    selectedChunkId: serviceId,
    rating: feedbackRating,
    feedbackNote: note,
    hasConsent: hasPersonalizationConsent,
  });

  if (recorded) {
    // Reset feedback state
    setShowFeedback(false);
    setFeedbackRating(null);
    setFeedbackReason(null);
    setSubmittingFeedback(false);
    // Show success indication
    // In a real implementation, this would show a toast
  } else {
    setSubmittingFeedback(false);
    // Handle failure - show error
    setFeedbackRating(null);
    setFeedbackReason(null);
  }
};

/* Check if personalization consent is granted */
const checkPersonalizationConsent = async () => {
  // In a real implementation, this would check the consent service
  // For now, check localStorage or a simulated consent state
  try {
    const consentGranted = localStorage.getItem('civicbridge_consent_preferences')
      ? JSON.parse(localStorage.getItem('civicbridge_consent_preferences')).personalization
      : true; // default granted
    return consentGranted === true;
  } catch {
    return true; // default to granted if no storage
  }
};

export default RecommendationExplanationCard;
