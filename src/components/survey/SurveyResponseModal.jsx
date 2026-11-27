import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Copy,
  Check,
  Send,
  AlertCircle,
  Key,
} from 'lucide-react';
import { evaluateBranching, QUESTION_TYPES } from '../../data/surveyContract.js';
import { submitResponse } from '../../services/surveyService.js';

const SurveyResponseModal = ({ survey, onClose, onSuccess }) => {
  const activeVersion =
    survey.versions?.find((v) => v.id === survey.activeVersionId) ||
    survey.versions?.[0] || { questions: [], branchingRules: [] };

  const questions = activeVersion.questions || [];
  const branchingRules = activeVersion.branchingRules || [];

  const [consentGiven, setConsentGiven] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0 = consent, 1..N = questions, 999 = completed
  const [answers, setAnswers] = useState({});
  const [idempotencyKey] = useState(() => `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Question navigation order
  const currentQuestionIndex = currentStep - 1;
  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerChange = (val) => {
    if (!currentQuestion) return;
    setAnswers({
      ...answers,
      [currentQuestion.id]: val,
    });
    setErrorMsg('');
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!consentGiven) {
        setErrorMsg('Please read and agree to the voluntary consent terms before proceeding.');
        return;
      }
      setErrorMsg('');
      setCurrentStep(1);
      return;
    }

    if (currentQuestion) {
      const val = answers[currentQuestion.id];
      if (currentQuestion.required && (val === undefined || val === null || val === '')) {
        setErrorMsg('This question is required. Please provide a response.');
        return;
      }

      // Check dynamic branching
      const branch = evaluateBranching(branchingRules, answers, currentQuestion.id);
      if (branch) {
        if (branch.terminate) {
          handleSubmit();
          return;
        }
        if (branch.nextQuestionId) {
          const targetIdx = questions.findIndex((q) => q.id === branch.nextQuestionId);
          if (targetIdx >= 0) {
            setCurrentStep(targetIdx + 1);
            return;
          }
        }
      }
    }

    if (currentStep < questions.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrorMsg('');
    } else if (currentStep === 1) {
      setCurrentStep(0);
      setErrorMsg('');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = submitResponse(survey.id, {
        idempotencyKey,
        consentGiven: true,
        answers,
        completionDurationSecs: 45,
      });

      setSubmissionReceipt(res);
      setCurrentStep(999); // Finished
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record response. Please verify inputs and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReceiptToken = async () => {
    if (submissionReceipt?.consentToken && navigator.clipboard) {
      await navigator.clipboard.writeText(submissionReceipt.consentToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="response-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div>
            <h2 id="response-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {survey.title}
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {survey.department} • Anonymous Public Response
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              role="alert"
            >
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          {/* Step 0: Consent Notice */}
          {currentStep === 0 && (
            <div>
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid var(--border-light)',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-main)', fontWeight: 700 }}>
                  <ShieldCheck size={20} /> Voluntary Informed Consent &amp; Privacy Notice
                </div>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.55', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  {survey.consentConfig?.consentText || 'Participation is voluntary and processed anonymously for public improvement.'}
                </p>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong>Statutory Withdrawal Right:</strong> {survey.consentConfig?.withdrawalNotice || 'You may withdraw consent using your anonymous receipt key at any time.'}
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{ marginTop: '0.2rem', accentColor: 'var(--accent-main)' }}
                />
                <span>I understand and voluntarily consent to contribute my anonymous response.</span>
              </label>
            </div>
          )}

          {/* Steps 1..N: Questions */}
          {currentStep >= 1 && currentStep <= questions.length && currentQuestion && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <span>Question {currentStep} of {questions.length}</span>
                <span>{currentQuestion.required ? 'Mandatory Field *' : 'Voluntary'}</span>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                {currentQuestion.prompt}
              </h3>

              {currentQuestion.helpText && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  {currentQuestion.helpText}
                </p>
              )}

              {/* Question Input Types */}
              <div style={{ marginTop: '1rem' }}>
                {[QUESTION_TYPES.SINGLE_CHOICE, QUESTION_TYPES.DEMOGRAPHIC_VOLUNTARY].includes(currentQuestion.type) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(currentQuestion.options || []).map((opt) => {
                      const optVal = typeof opt === 'object' ? opt.value : opt;
                      const optLabel = typeof opt === 'object' ? opt.label : opt;
                      const isSelected = answers[currentQuestion.id] === optVal;
                      return (
                        <label
                          key={optVal}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${isSelected ? 'var(--accent-main)' : 'var(--border-light)'}`,
                            background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            value={optVal}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(optVal)}
                            style={{ accentColor: 'var(--accent-main)' }}
                          />
                          <span>{optLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === QUESTION_TYPES.NUMERIC_RATING && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4, 5].map((num) => {
                      const isSelected = Number(answers[currentQuestion.id]) === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleAnswerChange(num)}
                          style={{
                            width: '45px',
                            height: '45px',
                            borderRadius: '0.5rem',
                            border: `1px solid ${isSelected ? 'var(--accent-main)' : 'var(--border-light)'}`,
                            background: isSelected ? 'var(--accent-main)' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: 'pointer',
                          }}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === QUESTION_TYPES.TEXT_SHORT && (
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    maxLength={currentQuestion.maxCharLength || 250}
                    placeholder="Enter short text answer..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                    aria-label={currentQuestion.prompt}
                  />
                )}
              </div>
            </div>
          )}

          {/* Step 999: Completed Receipt */}
          {currentStep === 999 && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  marginBottom: '1rem',
                }}
              >
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Response Recorded Successfully
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                Your feedback has been incorporated into the anonymous public consultation dataset.
              </p>

              {/* Receipt & Token Box */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border-light)',
                  textAlign: 'left',
                  maxWidth: '480px',
                  margin: '0 auto 1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <Key size={16} color="var(--accent-main)" /> Anonymous Consent Withdrawal Key
                </div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Save this key if you wish to revoke your response before consultation window closes:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <code
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.65rem',
                      background: 'var(--bg-main)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.82rem',
                      color: 'var(--accent-main)',
                    }}
                  >
                    {submissionReceipt?.consentToken}
                  </code>
                  <button
                    type="button"
                    onClick={copyReceiptToken}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {tokenCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    {tokenCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <button type="button" onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                Close &amp; Return to Directory
              </button>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        {currentStep < 999 && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--glass-bg)',
            }}
          >
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                opacity: currentStep === 0 ? 0.4 : 1,
                cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <ArrowLeft size={15} /> Back
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {currentStep === 0 ? (
                <>Begin Survey <ArrowRight size={15} /></>
              ) : currentStep === questions.length ? (
                <><Send size={15} /> Submit Response</>
              ) : (
                <>Next Question <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyResponseModal;

