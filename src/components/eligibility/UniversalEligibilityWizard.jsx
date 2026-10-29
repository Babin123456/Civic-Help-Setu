import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Info,
  PencilLine,
  Bookmark,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  evaluateAllSchemes,
  saveAssessment,
} from '../../services/assessmentStorage';

import {
  applyCriteria,
  RESULT_STATUS_LABELS,
} from '../../services/eligibilityCriteria';

import EligibilityBadge from './EligibilityBadge';
import CriteriaList from './CriteriaList';
import { useToast } from '../../context/ToastContext';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import { isFormDirty } from '../../utils/formDraft';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { logDiagnostic } from '../../utils/diagnostics';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

const FIELD_PREFIX = 'elig-';

const fieldId = (key) => `${FIELD_PREFIX}${key}`;

const DEFAULT_PROFILE = {
  age: 26,
  annualIncome: 180000,
  employment: 'salaried',
  category: 'OBC',
  state: 'Maharashtra',
  isStudent: false,
  ownsAgriculturalLand: false,
  hasAadhaar: true,
  hasPan: true,
  hasLearnerLicense: false,
  hasIncomeCertificate: false,
};

// Keep cleared number fields empty instead of converting them to zero.
const toAnswer = (raw) => {
  if (raw === '') {
    return '';
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : '';
};

const validateBasics = (profile) => {
  const errors = {};

  const age =
    profile.age === '' || profile.age == null
      ? NaN
      : Number(profile.age);

  const income =
    profile.annualIncome === '' || profile.annualIncome == null
      ? NaN
      : Number(profile.annualIncome);

  if (!Number.isFinite(age) || age < 1 || age > 110) {
    errors.age = 'Enter an age between 1 and 110.';
  }

  if (!Number.isFinite(income) || income < 0) {
    errors.annualIncome =
      'Enter your annual family income, 0 or more.';
  }

  return errors;
};

const PREREQUISITES = [
  {
    key: 'hasAadhaar',
    label: 'Have Aadhaar card with mobile linked',
  },
  {
    key: 'hasPan',
    label: 'Hold valid PAN Card',
  },
  {
    key: 'hasLearnerLicense',
    label: 'Hold valid Learner License for 30+ days',
  },
  {
    key: 'hasIncomeCertificate',
    label: 'Have valid Tehsildar Income Certificate',
  },
  {
    key: 'ownsAgriculturalLand',
    label: 'Own cultivable agricultural land (Khatauni / Patta)',
  },
  {
    key: 'isStudent',
    label: 'Currently enrolled student in college/institute',
  },
];

const FILTER_OPTIONS = [
  'all',
  'eligible',
  'conditional',
  'ineligible',
  'unknown',
];

const UniversalEligibilityWizard = ({
  onAssessmentSaved = () => {},
  onDirtyChange = () => {},
}) => {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(() => ({
    ...DEFAULT_PROFILE,
  }));

  // The baseline represents the answers associated with the last save.
  const [baseline, setBaseline] = useState(() => ({
    ...DEFAULT_PROFILE,
  }));

  const [evaluations, setEvaluations] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSaved, setIsSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [errors, setErrors] = useState({});

  const resultsHeadingRef = useRef(null);
  const pendingFocusRef = useRef(null);

  const isDirty = isFormDirty(profile, baseline);
  const guard = useUnsavedChangesGuard(isDirty);

  // Notify the parent when the form's unsaved state changes.
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  // Clear the parent's dirty indicator when this component unmounts.
  useEffect(() => {
    return () => {
      onDirtyChange(false);
    };
  }, [onDirtyChange]);

  const focusField = useCallback((id) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    });

    element.focus({
      preventScroll: true,
    });
  }, []);

  // Restore focus after navigating between wizard steps.
  useEffect(() => {
    if (step === 3) {
      resultsHeadingRef.current?.focus({
        preventScroll: true,
      });

      return;
    }

    if (pendingFocusRef.current) {
      focusField(pendingFocusRef.current);
      pendingFocusRef.current = null;
    }
  }, [step, focusField]);

  const updateProfile = useCallback((key, value) => {
    setProfile((previous) => ({
      ...previous,
      [key]: value,
    }));

    // Remove only the error associated with the edited field.
    setErrors((previous) => {
      if (!(key in previous)) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];

      return next;
    });

    // Previously generated results must not be treated as current
    // after the user changes an answer.
    setIsSaved(false);
  }, []);

  const goToField = useCallback(
    (key, targetStep) => {
      setReviewing(true);

      if (targetStep === step) {
        focusField(fieldId(key));
        return;
      }

      pendingFocusRef.current = fieldId(key);
      setStep(targetStep);
    },
    [step, focusField]
  );

  const handleContinue = () => {
    const found = validateBasics(profile);

    setErrors(found);

    if (Object.keys(found).length > 0) {
      focusField(fieldId(found.age ? 'age' : 'annualIncome'));
      return;
    }

    setStep(2);
  };

  const handleRunEvaluation = () => {
    const found = validateBasics(profile);

    setErrors(found);

    if (Object.keys(found).length > 0) {
      goToField(
        found.age ? 'age' : 'annualIncome',
        1
      );

      return;
    }

    try {
      const results = evaluateAllSchemes(profile).map((evaluation) =>
        applyCriteria(evaluation, profile)
      );

      setEvaluations(results);

      // Keep the existing filter when possible. Otherwise, show all.
      setFilterStatus((current) =>
        current === 'all' ||
        results.some((evaluation) => evaluation.status === current)
          ? current
          : 'all'
      );

      setReviewing(false);
      setIsSaved(false);
      setStep(3);
    } catch (error) {
      logDiagnostic('Failed to evaluate scheme eligibility:', error);

      toast.error?.(
        'Unable to evaluate eligibility. Please try again.'
      );
    }
  };

  const handleSaveToProfile = () => {
    if (!evaluations || isSaved) {
      return;
    }

    try {
      // Preserve the existing storage format by excluding criteria.
      const storedEvaluations = evaluations.map((evaluation) => {
        const stored = { ...evaluation };
        delete stored.criteria;

        return stored;
      });

      saveAssessment(profile, storedEvaluations);

      setBaseline({ ...profile });
      setIsSaved(true);

      toast.success(
        'Eligibility assessment record saved to your profile!'
      );

      onAssessmentSaved();
    } catch (error) {
      logDiagnostic('Failed to save eligibility assessment:', error);

      toast.error?.(
        'Unable to save the assessment. Please try again.'
      );
    }
  };

  const handleReset = () => {
    // Start a fresh assessment while retaining the user's answers.
    setStep(1);
    setEvaluations(null);
    setFilterStatus('all');
    setIsSaved(false);
    setReviewing(false);
    setErrors({});
    pendingFocusRef.current = fieldId('age');
  };

  const handleCheckboxChange = (key, checked) => {
    updateProfile(key, checked);
  };

  const reviewNote = (
    <p
      role="status"
      style={{
        margin: 0,
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
      }}
    >
      You are reviewing your answers. Your results are updated only
      when you choose Update results.
    </p>
  );

  const visibleEvaluations = (evaluations || []).filter(
    (evaluation) =>
      filterStatus === 'all' ||
      evaluation.status === filterStatus
  );

  return (
    <div
      className="card animate-fade-in"
      style={{
        padding: '2rem',
        borderRadius: '1.25rem',
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-main)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Progress header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              color: 'var(--accent-main)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Interactive Civic Wizard
          </span>

          <h2
            ref={resultsHeadingRef}
            tabIndex={-1}
            style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              margin: '0.2rem 0 0',
            }}
          >
            {step === 1 &&
              'Step 1: Demographic & Income Profile'}

            {step === 2 &&
              'Step 2: Assets, Occupation & Held Documents'}

            {step === 3 &&
              'Assessment Results & Scheme Recommendations'}
          </h2>
        </div>

        <div
          aria-label={`Step ${step} of 3`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {[1, 2, 3].map((currentStep) => (
            <div
              key={currentStep}
              aria-current={
                step === currentStep ? 'step' : undefined
              }
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: '700',
                background:
                  step === currentStep
                    ? 'var(--accent-main)'
                    : step > currentStep
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'var(--glass-bg)',
                color:
                  step === currentStep
                    ? 'var(--bg-main)'
                    : step > currentStep
                      ? '#10b981'
                      : 'var(--text-tertiary)',
                border:
                  step === currentStep
                    ? '1px solid var(--accent-main)'
                    : '1px solid var(--border-light)',
              }}
            >
              {step > currentStep ? '✓' : currentStep}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Demographics and income */}
      {step === 1 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {reviewing && reviewNote}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Age */}
            <div>
              <label
                htmlFor={fieldId('age')}
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  marginBottom: '0.4rem',
                }}
              >
                Applicant Age (Years) *
              </label>

              <input
                id={fieldId('age')}
                name="age"
                type="number"
                min="1"
                max="110"
                step="1"
                inputMode="numeric"
                className="input-field"
                value={profile.age}
                onChange={(event) =>
                  updateProfile(
                    'age',
                    toAnswer(event.target.value)
                  )
                }
                aria-invalid={Boolean(errors.age)}
                aria-describedby={
                  errors.age ? 'elig-age-error' : undefined
                }
                style={{ width: '100%' }}
                required
              />

              {errors.age && (
                <span
                  id="elig-age-error"
                  role="alert"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--error, #ef4444)',
                    marginTop: '0.2rem',
                    display: 'block',
                  }}
                >
                  {errors.age}
                </span>
              )}
            </div>

            {/* Annual family income */}
            <div>
              <label
                htmlFor={fieldId('annualIncome')}
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  marginBottom: '0.4rem',
                }}
              >
                Annual Family Income (₹ INR) *
              </label>

              <input
                id={fieldId('annualIncome')}
                name="annualIncome"
                type="number"
                step="10000"
                min="0"
                inputMode="decimal"
                className="input-field"
                value={profile.annualIncome}
                onChange={(event) =>
                  updateProfile(
                    'annualIncome',
                    toAnswer(event.target.value)
                  )
                }
                aria-invalid={Boolean(errors.annualIncome)}
                aria-describedby={
                  errors.annualIncome
                    ? 'elig-annualIncome-error'
                    : 'elig-income-hint'
                }
                style={{ width: '100%' }}
                required
              />

              {errors.annualIncome && (
                <span
                  id="elig-annualIncome-error"
                  role="alert"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--error, #ef4444)',
                    marginTop: '0.2rem',
                    display: 'block',
                  }}
                >
                  {errors.annualIncome}
                </span>
              )}

              <span
                id="elig-income-hint"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  marginTop: '0.2rem',
                  display: 'block',
                }}
              >
                ₹
                {Number(profile.annualIncome || 0).toLocaleString(
                  'en-IN'
                )}{' '}
                / year
              </span>
            </div>
          </div>

          {/* Occupation, category and state */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div>
              <label
                htmlFor={fieldId('employment')}
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  marginBottom: '0.4rem',
                }}
              >
                Primary Occupation / Status
              </label>

              <select
                id={fieldId('employment')}
                name="employment"
                className="input-field"
                value={profile.employment}
                onChange={(event) =>
                  updateProfile('employment', event.target.value)
                }
                style={{ width: '100%' }}
              >
                <option value="salaried">
                  Salaried (Private / Govt)
                </option>
                <option value="self-employed">
                  Self-Employed / Trader
                </option>
                <option value="farmer">
                  Farmer / Agriculturalist
                </option>
                <option value="student">
                  Student / Research Scholar
                </option>
                <option value="unemployed">
                  Currently Seeking Employment
                </option>
                <option value="homemaker">
                  Homemaker
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor={fieldId('category')}
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  marginBottom: '0.4rem',
                }}
              >
                Social Category (Reservation / Welfare Quota)
              </label>

              <select
                id={fieldId('category')}
                name="category"
                className="input-field"
                value={profile.category}
                onChange={(event) =>
                  updateProfile('category', event.target.value)
                }
                style={{ width: '100%' }}
              >
                <option value="General">General / Open</option>
                <option value="EWS">
                  Economically Weaker Section (EWS)
                </option>
                <option value="OBC">
                  Other Backward Class (OBC)
                </option>
                <option value="SC">Scheduled Caste (SC)</option>
                <option value="ST">Scheduled Tribe (ST)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={fieldId('state')}
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  marginBottom: '0.4rem',
                }}
              >
                State / Union Territory of Residence
              </label>

              <select
                id={fieldId('state')}
                name="state"
                className="input-field"
                value={profile.state}
                onChange={(event) =>
                  updateProfile('state', event.target.value)
                }
                style={{ width: '100%' }}
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 1 actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            {reviewing && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRunEvaluation}
                style={{
                  padding: '0.65rem 1.5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Sparkles size={16} aria-hidden="true" />
                <span>Update results</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleContinue}
              style={{
                padding: '0.65rem 1.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>Continue to Prerequisite Check</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Prerequisites and documents */}
      {step === 2 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {reviewing && reviewNote}

          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            Check the credentials and circumstances that apply to
            you. This enables matching against the eligibility rules
            available in the application.
          </p>

          <fieldset
            style={{
              border: 0,
              padding: 0,
              margin: 0,
              minWidth: 0,
            }}
          >
            <legend
              style={{
                fontSize: '0.9rem',
                fontWeight: '700',
                marginBottom: '0.75rem',
              }}
            >
              Select all applicable conditions
            </legend>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {PREREQUISITES.map(({ key, label }) => {
                const checked = Boolean(profile[key]);

                return (
                  <label
                    key={key}
                    htmlFor={fieldId(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      background: checked
                        ? 'rgba(56, 189, 248, 0.12)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: checked
                        ? '1px solid var(--accent-main)'
                        : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <input
                      id={fieldId(key)}
                      name={key}
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        handleCheckboxChange(
                          key,
                          event.target.checked
                        )
                      }
                      style={{
                        width: '18px',
                        height: '18px',
                        flexShrink: 0,
                        accentColor: 'var(--accent-main)',
                        cursor: 'pointer',
                      }}
                    />

                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: checked ? '700' : '500',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Step 2 actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(1)}
              style={{
                padding: '0.65rem 1.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunEvaluation}
              style={{
                padding: '0.65rem 1.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>
                {reviewing
                  ? 'Update results'
                  : 'Evaluate My Eligibility'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Assessment results */}
      {step === 3 && evaluations && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Important disclaimer */}
          <div
            role="note"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-main)',
              background: 'var(--glass-bg-subtle)',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            <Info
              size={18}
              aria-hidden="true"
              style={{
                flexShrink: 0,
                marginTop: '0.1rem',
                color: 'var(--accent-main)',
              }}
            />

            <span>
              <strong style={{ color: 'var(--text-primary)' }}>
                Potential eligibility is not an official decision.
              </strong>{' '}
              These results indicate which schemes may suit the
              answers you provided. The relevant department makes the
              final decision after verifying your documents.
              Eligibility predictions do not guarantee approval.
            </span>
          </div>

          {/* Filter buttons and actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div
              role="group"
              aria-label="Filter schemes by eligibility status"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              {FILTER_OPTIONS.filter(
                (filter) =>
                  filter !== 'unknown' ||
                  evaluations.some(
                    (evaluation) =>
                      evaluation.status === 'unknown'
                  )
              ).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={filterStatus === filter}
                  onClick={() => setFilterStatus(filter)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '99px',
                    border:
                      filterStatus === filter
                        ? '1px solid var(--accent-main)'
                        : '1px solid var(--border-light)',
                    background:
                      filterStatus === filter
                        ? 'rgba(56, 189, 248, 0.2)'
                        : 'var(--glass-bg)',
                    color:
                      filterStatus === filter
                        ? 'var(--accent-main)'
                        : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {filter === 'all'
                    ? `All Schemes (${evaluations.length})`
                    : RESULT_STATUS_LABELS[filter] || filter}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveToProfile}
                disabled={isSaved}
                style={{
                  padding: '0.45rem 1.15rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: isSaved ? 0.7 : 1,
                  cursor: isSaved ? 'not-allowed' : 'pointer',
                }}
              >
                <Bookmark size={15} aria-hidden="true" />

                <span>
                  {isSaved
                    ? 'Saved to Profile'
                    : 'Save Assessment to Profile'}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => goToField('age', 1)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <PencilLine size={14} aria-hidden="true" />
                <span>Review answers</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Re-check</span>
              </button>
            </div>
          </div>

          {/* Live result summary */}
          <p
            role="status"
            aria-live="polite"
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            Showing {visibleEvaluations.length} of{' '}
            {evaluations.length} schemes.
          </p>

          {/* Scheme evaluation cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {visibleEvaluations.map((evaluation) => {
              const isEligible =
                evaluation.status === 'eligible';

              const isConditional =
                evaluation.status === 'conditional';

              return (
                <article
                  key={evaluation.schemeId}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '0.85rem',
                    background: 'var(--glass-bg)',
                    border: isEligible
                      ? '1px solid rgba(16, 185, 129, 0.35)'
                      : isConditional
                        ? '1px solid rgba(245, 158, 11, 0.35)'
                        : evaluation.status === 'unknown'
                          ? '1px dashed var(--border-main)'
                          : '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {/* Scheme information */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          textTransform: 'uppercase',
                          fontWeight: '700',
                        }}
                      >
                        {evaluation.category}
                      </span>

                      <h3
                        style={{
                          margin: '0.2rem 0',
                          fontSize: '1.2rem',
                          fontWeight: '800',
                          color: 'var(--text-primary)',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {evaluation.schemeName}
                      </h3>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {evaluation.benefit}
                      </p>
                    </div>

                    <EligibilityBadge
                      status={evaluation.status}
                      size="large"
                    />
                  </div>

                  {/* Reason for the assessment */}
                  <div
                    style={{
                      padding: '0.75rem 0.95rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.2)',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      color: 'var(--text-primary)',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <strong>Based on your answers:</strong>{' '}
                    {evaluation.reason}
                  </div>

                  {/* Criteria and missing requirements */}
                  <CriteriaList
                    schemeId={evaluation.schemeId}
                    schemeName={evaluation.schemeName}
                    criteria={evaluation.criteria}
                    onReview={(criterion) =>
                      goToField(
                        criterion.field,
                        criterion.step
                      )
                    }
                  />

                  {evaluation.missingPrerequisites?.length > 0 && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#f59e0b',
                        lineHeight: '1.5',
                      }}
                    >
                      <strong>Action Needed:</strong>{' '}
                      {evaluation.missingPrerequisites.join(', ')}
                    </div>
                  )}

                  {/* Required documents */}
                  {evaluation.requiredDocuments?.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        flexWrap: 'wrap',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--text-tertiary)',
                          fontWeight: '600',
                        }}
                      >
                        Required Documents:
                      </span>

                      {evaluation.requiredDocuments.map(
                        (document, index) => (
                          <span
                            key={`${document}-${index}`}
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              color: 'var(--accent-main)',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {document}
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* Application navigation */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    <Link
                      to={evaluation.actionLink || '/services'}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>View Application Steps</span>
                      <ArrowRight
                        size={13}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </article>
              );
            })}

            {/* Empty filter state */}
            {visibleEvaluations.length === 0 && (
              <div
                role="status"
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  borderRadius: '0.85rem',
                  border: '1px dashed var(--border-main)',
                  color: 'var(--text-secondary)',
                }}
              >
                <p
                  style={{
                    margin: '0 0 0.75rem',
                    fontWeight: '600',
                  }}
                >
                  No schemes match this filter.
                </p>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilterStatus('all')}
                >
                  View all schemes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unsaved changes protection */}
      <UnsavedChangesDialog
        isOpen={guard.isBlocked}
        onStay={guard.stay}
        onDiscard={guard.discard}
      />
    </div>
  );
};

export default UniversalEligibilityWizard;
