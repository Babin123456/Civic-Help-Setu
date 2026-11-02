import { useState, useMemo } from 'react';
import { Clock, Calendar, ShieldCheck, AlertCircle, Info, Send, FileCheck2, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateServiceSlaForecast } from '../../services/serviceSlaReliabilityService.js';

/**
 * Service Turnaround & SLA Delivery Forecast Card (#431)
 *
 * Provides citizens with a realistic delivery completion forecast based on
 * official citizen charter timelines, non-working days (weekends + gazetted holidays),
 * delivery transit channels, and statutory appellate escalation rights.
 */
const ServiceSlaReliabilityCard = ({ service }) => {
  const [submissionDateInput, setSubmissionDateInput] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [showDetails, setShowDetails] = useState(false);

  const forecast = useMemo(() => {
    const parsedDate = new Date(submissionDateInput);
    return calculateServiceSlaForecast({
      service,
      submissionDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    });
  }, [service, submissionDateInput]);

  const formatDateDisplay = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const parts = isoStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return isoStr;
    } catch {
      return isoStr;
    }
  };

  const getConfidenceBadgeColor = (rating) => {
    switch (rating) {
      case 'High':
        return { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e' };
      case 'Moderate':
        return { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' };
      default:
        return { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: 'var(--accent-main)' };
    }
  };

  const badgeStyle = getConfidenceBadgeColor(forecast.confidenceRating);

  return (
    <div
      className="service-sla-reliability-card animate-fade-in"
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-light)',
      }}
      aria-labelledby="sla-forecast-heading"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <Clock size={18} color="var(--accent-main)" />
          </div>
          <div>
            <h3
              id="sla-forecast-heading"
              style={{
                fontSize: '1rem',
                fontWeight: '700',
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              Turnaround & SLA Delivery Forecast
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Working days calculation &amp; Citizen Service Guarantee timeline
            </p>
          </div>
        </div>

        {/* Confidence pill */}
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: '600',
            padding: '0.2rem 0.55rem',
            borderRadius: '9999px',
            background: badgeStyle.bg,
            border: `1px solid ${badgeStyle.border}`,
            color: badgeStyle.text,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <ShieldCheck size={13} />
          <span>
            {forecast.confidenceRating} Reliability ({forecast.confidenceScore}%)
          </span>
        </div>
      </div>

      {/* Submission Date Picker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.6rem 0.85rem',
          borderRadius: '0.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-light)',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <Calendar size={15} color="var(--accent-main)" />
          <span>If applied / submitted on:</span>
        </div>
        <input
          type="date"
          value={submissionDateInput}
          onChange={(e) => setSubmissionDateInput(e.target.value)}
          aria-label="Application submission date"
          style={{
            padding: '0.25rem 0.55rem',
            fontSize: '0.8rem',
            borderRadius: '4px',
            border: '1px solid var(--border-light)',
            background: 'rgba(0, 0, 0, 0.2)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setSubmissionDateInput(new Date().toISOString().slice(0, 10))}
          style={{
            fontSize: '0.72rem',
            background: 'none',
            border: 'none',
            color: 'var(--accent-main)',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '0 0.25rem',
          }}
        >
          Reset to Today
        </button>
      </div>

      {/* Main Delivery Window Banner */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '0.65rem',
          background: 'rgba(56, 189, 248, 0.06)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.25rem' }}>
          ESTIMATED COMPLETION DATE
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {formatDateDisplay(forecast.expectedCompletionMinIso)} — {formatDateDisplay(forecast.expectedCompletionMaxIso)}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
          Based on official timeline of <strong>{forecast.officialTimeline}</strong> with non-working days and dispatch buffers applied.
        </div>
      </div>

      {/* Breakdown Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        {/* Delivery Channel */}
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>
            <Send size={13} />
            <span>Fulfillment Channel</span>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {forecast.deliveryChannelLabel}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
            {forecast.deliveryDescription}
          </div>
        </div>

        {/* Statutory Guarantee Escalation */}
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>
            <FileCheck2 size={13} />
            <span>Citizen Service Guarantee Deadline</span>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {formatDateDisplay(forecast.appellateEscalationDateIso)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
            Statutory right to lodge formal delay grievance / appellate review.
          </div>
        </div>
      </div>

      {/* Accordion / Details toggle */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: 0,
          }}
        >
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{showDetails ? 'Hide calendar exclusion details' : 'View working days & holiday exclusions'}</span>
        </button>

        {showDetails && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div>
              • <strong>Weekend buffer:</strong> {forecast.weekendsSkippedCount} non-working weekend days accounted for in timeline.
            </div>
            {forecast.holidaysSkipped.length > 0 ? (
              <div>
                • <strong>Public holidays encountered:</strong>{' '}
                {forecast.holidaysSkipped.map((h) => `${h.name} (${h.date})`).join(', ')}.
              </div>
            ) : (
              <div>• <strong>Public holidays:</strong> No national gazetted holidays fall within this evaluation window.</div>
            )}
            {forecast.transitBufferDays > 0 && (
              <div>
                • <strong>Postal dispatch buffer:</strong> Added {forecast.transitBufferDays} days for Speed Post logistics.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.4rem',
          marginTop: '0.75rem',
          fontSize: '0.7rem',
          color: 'var(--text-tertiary)',
          lineHeight: '1.4',
        }}
      >
        <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>{forecast.disclaimer}</span>
      </div>
    </div>
  );
};

export default ServiceSlaReliabilityCard;
