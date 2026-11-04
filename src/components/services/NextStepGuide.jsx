import { ExternalLink, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeContent';
import { generateNextStepGuide } from '../../services/nextStepGuideService';

const NextStepGuide = ({ service }) => {
  const guide = generateNextStepGuide(service);

  if (!guide.hasData && guide.steps.length === 1 && guide.steps[0].needsConfirmation) {
    return (
      <section className="next-step-guide" aria-labelledby="next-step-guide-heading">
        <div className="next-step-guide__empty">
          <HelpCircle size={32} color="var(--text-tertiary)" style={{ marginBottom: '0.75rem' }} />
          <h3 id="next-step-guide-heading" className="next-step-guide__title">
            Next-Step Guide Unavailable
          </h3>
          <p className="next-step-guide__message">
            {guide.steps[0].description}
          </p>
          <p className="next-step-guide__hint">
            Please refer to the official service description above or contact the department directly for guidance.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="next-step-guide" aria-labelledby="next-step-guide-heading">
      <div className="next-step-guide__header">
        <h3 id="next-step-guide-heading" className="next-step-guide__title">
          Your Next Steps
        </h3>
        <p className="next-step-guide__subtitle">
          A plain-language guide generated from verified service data. Steps marked with{' '}
          <span className="next-step-guide__legend">
            <AlertCircle size={14} color="var(--accent-warning)" aria-hidden="true" />{' '}
            Confirm with department
          </span>{' '}
          need verification from the responsible office.
        </p>
      </div>

      <ol className="next-step-guide__list" role="list">
        {guide.steps.map((step, index) => (
          <li key={`${step.order}-${index}`} className="next-step-guide__item">
            <div className="next-step-guide__step-header">
              <span className="next-step-guide__step-number">{step.order}</span>
              <div className="next-step-guide__step-title-row">
                <strong className="next-step-guide__step-title">{step.title}</strong>
                {step.needsConfirmation && (
                  <span className="next-step-guide__confirm-badge" title={step.confirmationReason}>
                    <AlertCircle size={14} color="var(--accent-warning)" aria-hidden="true" />
                    Confirm with department
                  </span>
                )}
                {!step.needsConfirmation && step.sourceField && (
                  <span className="next-step-guide__source-badge" title={`Source: ${step.sourceLabel}`}>
                    <CheckCircle2 size={14} color="var(--accent-success)" aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>
            </div>

            <p className="next-step-guide__step-description">{step.description}</p>

            {step.officialUrl && (
              <div className="next-step-guide__action">
                <a
                  href={safeHttpUrl(step.officialUrl) || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="next-step-guide__link"
                  aria-label={`Open ${step.sourceLabel || 'official source'} (opens in new tab)`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {step.sourceField === 'officialSources'
                    ? 'Open official portal'
                    : step.sourceField === 'contacts'
                    ? 'Contact department'
                    : 'View source'}
                </a>
              </div>
            )}

            {step.needsConfirmation && step.confirmationReason && (
              <p className="next-step-guide__confirmation-note">
                <HelpCircle size={12} color="var(--text-tertiary)" aria-hidden="true" />
                <em>Note: {step.confirmationReason}</em>
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="next-step-guide__summary">
        <p className="next-step-guide__summary-text">
          {guide.summary.traceableSteps} step(s) from verified data{' '}
          {guide.summary.confirmationSteps > 0
            ? `• ${guide.summary.confirmationSteps} step(s) need department confirmation`
            : '• All steps verified'}
        </p>
      </div>
    </section>
  );
};

export default NextStepGuide;