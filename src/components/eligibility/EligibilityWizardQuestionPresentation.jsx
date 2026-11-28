import React, { useRef, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import './EligibilityWizardQuestionPresentation.css';

export default function EligibilityWizardQuestionPresentation({
  currentStepIndex = 0,
  totalSteps = 5,
  stepTitle = 'Basic Demographics',
  question = {
    id: 'domicile-status',
    text: 'What is your current state of permanent residence / domicile?',
    description: 'State welfare schemes and statutory entitlements require verification of domicile certificate or permanent residential address.',
    helpText: 'If you reside in a rental home without permanent address, select your legal voting state.',
    type: 'single-select',
    required: true,
    options: [
      { id: 'delhi', label: 'NCT of Delhi', description: 'Full access to Delhi state schemes & DDC benefits' },
      { id: 'up', label: 'Uttar Pradesh', description: 'Access to UP eSathi, pension, and scholarship schemes' },
      { id: 'maharashtra', label: 'Maharashtra', description: 'Access to Aaple Sarkar portal and Sanjay Gandhi Niradhar Yojana' }
    ]
  },
  selectedValue = '',
  onSelectOption,
  onPrevious,
  onNext,
  validationError = '',
  canProceed = true
}) {
  const headingRef = useRef(null);
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Focus shift for screen reader accessibility on step switch
  useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, [currentStepIndex]);

  return (
    <div className="ewq-container" aria-label="Eligibility Question Wizard">
      {/* Visual & Textual Progress Bar */}
      <div className="ewq-progress-card" role="region" aria-label="Wizard progress indicator">
        <div className="ewq-progress-header">
          <span className="ewq-step-text">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <span className="ewq-step-percent">{progressPercent}% Completed</span>
        </div>
        <div
          className="ewq-progress-track"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall eligibility progress: ${progressPercent} percent`}
        >
          <div className="ewq-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="ewq-stage-name">{stepTitle}</div>
      </div>

      {/* Main Question Card */}
      <section className="ewq-question-card">
        <div className="ewq-question-header">
          <span className="ewq-q-badge" aria-hidden="true">
            Q{currentStepIndex + 1}
          </span>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="ewq-q-title"
            id={`question-title-${question.id}`}
          >
            {question.text}
            {question.required && (
              <span className="ewq-required-tag" title="Mandatory question">
                *
              </span>
            )}
          </h2>
        </div>

        {question.description && (
          <p className="ewq-q-desc" id={`question-desc-${question.id}`}>
            {question.description}
          </p>
        )}

        {/* Answer Options Grid */}
        <fieldset
          className="ewq-options-group"
          aria-labelledby={`question-title-${question.id}`}
          aria-describedby={question.description ? `question-desc-${question.id}` : undefined}
        >
          <legend className="sr-only">{question.text}</legend>
          {question.options.map((opt) => {
            const isSelected = selectedValue === opt.id;
            return (
              <label
                key={opt.id}
                className={`ewq-option-label ${isSelected ? 'selected' : ''}`}
                htmlFor={`opt-${opt.id}`}
              >
                <input
                  type="radio"
                  id={`opt-${opt.id}`}
                  name={`question-${question.id}`}
                  value={opt.id}
                  checked={isSelected}
                  onChange={() => onSelectOption?.(opt.id)}
                  className="ewq-radio-input"
                />
                <div className="ewq-option-content">
                  <div className="ewq-option-title-row">
                    <span className="ewq-option-title">{opt.label}</span>
                    {isSelected && <CheckCircle2 size={18} className="ewq-check-icon" aria-hidden="true" />}
                  </div>
                  {opt.description && <span className="ewq-option-desc">{opt.description}</span>}
                </div>
              </label>
            );
          })}
        </fieldset>

        {/* Field-level Validation Error */}
        {validationError && (
          <div className="ewq-error-alert" role="alert" aria-live="assertive">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Explanatory Context / Helper Drawer */}
        {question.helpText && (
          <div className="ewq-help-box">
            <HelpCircle size={16} className="ewq-help-icon" aria-hidden="true" />
            <p className="ewq-help-text">
              <strong>Official Note:</strong> {question.helpText}
            </p>
          </div>
        )}

        {/* Wizard Navigation Footer */}
        <div className="ewq-nav-actions">
          <button
            type="button"
            className="ewq-nav-btn ewq-btn-prev"
            onClick={onPrevious}
            disabled={currentStepIndex === 0}
            aria-label="Return to previous question"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            className="ewq-nav-btn ewq-btn-next"
            onClick={onNext}
            disabled={!canProceed}
            aria-label="Proceed to next question"
          >
            <span>{currentStepIndex === totalSteps - 1 ? 'Review Assessment' : 'Continue'}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
