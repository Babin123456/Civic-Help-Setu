import { useState, useMemo } from 'react';
import { Sparkles, SlidersHorizontal, RefreshCw, X, Check, HelpCircle, Compass, ThumbsUp, ThumbsDown } from 'lucide-react';
import { rankCivicServices } from '../../services/recommendationEngine.js';
import RecommendationExplanationCard from './RecommendationExplanationCard';

const GOAL_OPTIONS = [
  { id: 'travel_abroad', label: 'Travel Abroad / International Transit', icon: '✈️' },
  { id: 'identity_proof', label: 'Primary Proof of Identity & Address', icon: '🪪' },
  { id: 'tax_and_finance', label: 'Tax Filing & Banking Verification', icon: '💳' },
  { id: 'voting_election', label: 'Voter Registration for Elections', icon: '🗳️' },
  { id: 'food_subsidy', label: 'Food Subsidies & Ration Entitlements', icon: '🌾' },
  { id: 'birth_registration', label: 'Birth Registration & Vital Records', icon: '👶' },
  { id: 'scholarship_aid', label: 'Scholarship & Educational Aid Documents', icon: '🎓' },
];

const COMMON_DOCS = [
  'Aadhaar Card',
  'PAN Card',
  'Birth Certificate',
  'Utility Bill (Electricity/Water)',
  'Passport',
  'Salary Slips / IT Returns',
  'Passport Size Photograph',
];

/**
 * ServiceRecommendationWizard Component (#78)
 * Stepped questionnaire that matches citizen situations to recommended services.
 */
const ServiceRecommendationWizard = ({ isOpen, onClose }) => {
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [heldDocuments, setHeldDocuments] = useState([]);
  const [feePreference, setFeePreference] = useState('any');
  const [maxDays, setMaxDays] = useState(60);
  const [ageInput, setAgeInput] = useState('');
  const [citizenship, setCitizenship] = useState('indian');

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackServiceId, setFeedbackServiceId] = useState(null);

  // Toggle goal selection
  const handleToggleGoal = (goalId) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
    );
  };

  // Toggle document selection
  const handleToggleDoc = (docName) => {
    setHeldDocuments((prev) =>
      prev.includes(docName) ? prev.filter((d) => d !== docName) : [...prev, docName]
    );
  };

  // Reset filters
  const handleReset = () => {
    setSelectedGoals([]);
    setHeldDocuments([]);
    setFeePreference('any');
    setMaxDays(60);
    setAgeInput('');
    setCitizenship('indian');
    setShowFeedback(false);
    setFeedbackRating(null);
    setFeedbackServiceId(null);
  };

  // Toggle feedback for a specific service
  const handleToggleFeedback = (serviceId) => {
    setFeedbackServiceId(serviceId);
    setShowFeedback(true);
  };

  // Compute recommendations reactively
  const recommendations = useMemo(() => {
    const preferences = {
      intents: selectedGoals,
      heldDocuments,
      feePreference,
      maxTurnaroundDays: maxDays === 60 ? null : maxDays,
      age: ageInput ? parseInt(ageInput, 10) : null,
      citizenship,
    };

    return rankCivicServices(undefined, preferences);
  }, [selectedGoals, heldDocuments, feePreference, maxDays, ageInput, citizenship]);

  if (!isOpen) return null;

  return (
    <div
      className="wizard-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="wizard-modal-content animate-fade-in"
        style={{
          background: 'var(--bg-main, #0a0a0a)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
          borderRadius: '1.25rem',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
        }}
      >
        {/* Wizard Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.5rem',
                background: 'var(--accent-light, rgba(56, 189, 248, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <Compass size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                Civic Service Recommendation Wizard
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Rule-based matching grounded in transparent eligibility and prerequisites
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close wizard"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Wizard Body (Scrollable) */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Step 1: Goals */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              1. What civic goals or services do you need right now? (Select all that apply)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
              {GOAL_OPTIONS.map((g) => {
                const isSelected = selectedGoals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGoal(g.id)}
                    style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: '0.625rem',
                      border: `1px solid ${isSelected ? 'var(--accent-main, #38bdf8)' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, #cbd5e1)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? '700' : '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{g.icon}</span>
                    <span style={{ flex: 1 }}>{g.label}</span>
                    {isSelected && <Check size={14} color="var(--accent-main, #38bdf8)" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Documents */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              2. Which documents do you already have in hand?
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {COMMON_DOCS.map((doc) => {
                const isSelected = heldDocuments.includes(doc);
                return (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => handleToggleDoc(doc)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '9999px',
                      border: `1px solid ${isSelected ? '#4ade80' : 'var(--border-light, rgba(255,255,255,0.1))'}`,
                      background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#4ade80' : 'var(--text-secondary, #cbd5e1)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    {isSelected && <Check size={12} />}
                    <span>{doc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Constraints */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Your Age (Optional)
              </label>
              <input
                type="number"
                placeholder="e.g. 24"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Fee Preference
              </label>
              <select
                value={feePreference}
                onChange={(e) => setFeePreference(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  background: 'var(--bg-card, #1e293b)',
                  border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="any">Any (Free or Paid)</option>
                <option value="free_only">Free Services Only</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Max Turnaround: {maxDays === 60 ? 'Any duration' : `< ${maxDays} days`}
              </label>
              <input
                type="range"
                min="7"
                max="60"
                step="7"
                value={maxDays}
                onChange={(e) => setMaxDays(parseInt(e.target.value, 10))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Results Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>
                Ranked Recommendations ({recommendations.length} services)
              </h3>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-main, #38bdf8)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <RefreshCw size={12} />
                <span>Reset Filters</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {recommendations.slice(0, 4).map((rec) => (
                <React.Fragment key={rec.serviceId}>
                  <RecommendationExplanationCard
                  key={rec.serviceId}
                  recommendation={rec}
                  onFeedbackToggle={handleToggleFeedback}
                />
                  {showFeedback && feedbackServiceId === rec.serviceId && (
                    <div
                      style={{
                        padding: '0.875rem',
                        borderRadius: '0.75rem',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                        marginTop: '0.5rem',
                        fontSize: '0.825rem',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary, #ffffff)' }}>Was this recommendation useful?</span>
                        <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => setFeedbackRating(1)}
                            style={{
                              padding: '0.3rem 0.5rem',
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
                              padding: '0.3rem 0.5rem',
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
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowFeedback(false);
                          setFeedbackRating(null);
                          setFeedbackServiceId(null);
                        }}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '0.375rem',
                          background: 'var(--border-main, rgba(255,255,255,0.1))',
                          border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                          color: 'var(--text-secondary, #cbd5e1)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceRecommendationWizard;
