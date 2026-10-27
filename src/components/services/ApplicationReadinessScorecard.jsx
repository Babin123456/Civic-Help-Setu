import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Info,
  Save,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCheck2,
} from 'lucide-react';
import {
  READINESS_CATEGORIES,
  READINESS_CATEGORY_LABELS,
  calculateReadinessScore,
  saveReadinessProgress,
  getReadinessProgress,
  resetReadinessProgress,
} from '../../services/readinessScorecardService';
import { useToast } from '../../context/ToastContext';

const ApplicationReadinessScorecard = ({ service }) => {
  const { toast } = useToast();
  const [checkedIds, setCheckedIds] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});
  const [lastSaved, setLastSaved] = useState(null);

  // Load saved progress from localStorage on mount or when service changes
  useEffect(() => {
    if (!service?.id) return;
    const saved = getReadinessProgress(service.id);
    if (saved && Array.isArray(saved.checkedIds)) {
      setCheckedIds(saved.checkedIds);
      setLastSaved(saved.updatedAt);
    } else {
      setCheckedIds([]);
      setLastSaved(null);
    }
  }, [service?.id]);

  const scoreData = useMemo(() => {
    return calculateReadinessScore(service, checkedIds);
  }, [service, checkedIds]);

  const toggleItem = (itemId) => {
    setCheckedIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];

      // Auto-save progress
      if (service?.id) {
        saveReadinessProgress(service.id, next);
        setLastSaved(new Date().toISOString());
      }
      return next;
    });
  };

  const toggleExpand = (itemId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleManualSave = () => {
    if (!service?.id) return;
    saveReadinessProgress(service.id, checkedIds);
    setLastSaved(new Date().toISOString());
    toast?.success?.('Readiness checklist progress saved to this device.');
  };

  const handleReset = () => {
    if (window.confirm('Reset all completed checklist items for this service?')) {
      setCheckedIds([]);
      if (service?.id) {
        resetReadinessProgress(service.id);
      }
      setLastSaved(null);
      toast?.info?.('Readiness scorecard reset.');
    }
  };

  if (!service) return null;

  const scoreColor =
    scoreData.score >= 90 ? '#10b981' : scoreData.score >= 50 ? '#f59e0b' : '#ef4444';

  const displayedCriteria =
    activeCategory === 'all'
      ? scoreData.allCriteria
      : scoreData.allCriteria.filter((c) => c.category === activeCategory);

  return (
    <div
      className="card-glass animate-fade-in readiness-scorecard"
      style={{
        marginTop: '2rem',
        borderRadius: '1.25rem',
        background: 'var(--bg-card, #111827)',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        padding: '1.75rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
      }}
      role="region"
      aria-label={`Application Readiness Scorecard for ${service.name}`}
    >
      {/* Header with Title and Badges */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--accent-main, #38bdf8)',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '0.35rem',
            }}
          >
            <FileCheck2 size={16} aria-hidden="true" />
            Transparent Application Pre-Flight
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Application Readiness Scorecard
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Verify eligibility, documents, official fees, and submission requirements before starting.
          </p>
        </div>

        {/* Big Score Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.05))',
            padding: '0.6rem 1.2rem',
            borderRadius: '1rem',
            border: `1px solid ${scoreColor}`,
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Readiness Score
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: scoreColor, lineHeight: 1.1 }}>
              {scoreData.score}%
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: `conic-gradient(${scoreColor} ${scoreData.score * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--bg-card, #111827)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: scoreColor,
              }}
            >
              {scoreData.completedCount}/{scoreData.totalCriteria}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Acceptance Criteria: Statutory Non-Guarantee Disclaimer Banner */}
      <div
        className="readiness-disclaimer-banner"
        style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '0.75rem',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-primary)',
          lineHeight: '1.45',
        }}
      >
        <Info size={18} color="var(--accent-main, #38bdf8)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
        <div>
          <strong style={{ color: 'var(--accent-main, #38bdf8)' }}>Important Notice: </strong>
          {scoreData.disclaimer}
        </div>
      </div>

      {/* Mandatory Acceptance Criteria: Data Confidence & Missing/Unverified Service Data Disclosure */}
      {scoreData.dataConfidence.disclosures.length > 0 && (
        <div
          className="data-confidence-banner"
          style={{
            background:
              scoreData.dataConfidence.level === 'low'
                ? 'rgba(239, 68, 68, 0.1)'
                : 'rgba(245, 158, 11, 0.1)',
            border:
              scoreData.dataConfidence.level === 'low'
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '0.75rem',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            fontSize: '0.82rem',
            lineHeight: '1.45',
          }}
        >
          <AlertTriangle
            size={18}
            color={scoreData.dataConfidence.level === 'low' ? '#ef4444' : '#f59e0b'}
            style={{ flexShrink: 0, marginTop: '2px' }}
            aria-hidden="true"
          />
          <div>
            <div style={{ fontWeight: 700, color: scoreData.dataConfidence.level === 'low' ? '#ef4444' : '#f59e0b' }}>
              Data Confidence Rating: {scoreData.dataConfidence.level.toUpperCase()} ({scoreData.dataConfidence.score}/100)
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Missing or unverified service data lowers confidence:
            </div>
            <ul style={{ margin: '0.35rem 0 0 1.2rem', padding: 0, color: 'var(--text-secondary)' }}>
              {scoreData.dataConfidence.disclosures.map((disc, i) => (
                <li key={i}>{disc}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '0.35rem 0.8rem',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeCategory === 'all' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
            background: activeCategory === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeCategory === 'all' ? 'var(--accent-main)' : 'var(--text-secondary)',
          }}
        >
          All Criteria ({scoreData.allCriteria.length})
        </button>

        {Object.entries(READINESS_CATEGORIES).map(([k, cat]) => {
          const stat = scoreData.categoryStats[cat];
          if (!stat || stat.totalCount === 0) return null;
          const label = READINESS_CATEGORY_LABELS[cat];
          const isSelected = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: isSelected ? 'var(--accent-main)' : 'var(--text-secondary)',
              }}
            >
              {label} ({stat.completedCount}/{stat.totalCount})
            </button>
          );
        })}
      </div>

      {/* Criteria Checklist Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {displayedCriteria.map((item) => {
          const isChecked = checkedIds.includes(item.id);
          const isExpanded = !!expandedItems[item.id];
          return (
            <div
              key={item.id}
              style={{
                borderRadius: '0.75rem',
                background: isChecked
                  ? 'rgba(16, 185, 129, 0.05)'
                  : 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                border: isChecked
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                padding: '0.85rem 1rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    cursor: 'pointer',
                    flex: 1,
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                    style={{
                      marginTop: '0.2rem',
                      width: '18px',
                      height: '18px',
                      accentColor: '#10b981',
                      cursor: 'pointer',
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        color: isChecked ? '#10b981' : 'var(--text-primary)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                      Category: {READINESS_CATEGORY_LABELS[item.category] || item.category} • Weight: {item.weight} pts
                    </div>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: '0.78rem',
                  }}
                  aria-expanded={isExpanded}
                  title="Toggle what to verify guidance"
                >
                  <span>{isExpanded ? 'Hide Info' : 'What to Verify'}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Explanatory Verification Guidance Box (Critical for incomplete items) */}
              {(!isChecked || isExpanded) && (
                <div
                  style={{
                    marginTop: '0.65rem',
                    paddingTop: '0.65rem',
                    borderTop: '1px dashed var(--border-light, rgba(255, 255, 255, 0.08))',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                    <strong style={{ color: 'var(--accent-main)' }}>What to verify:</strong>
                    <span>{item.whatToVerify}</span>
                  </div>
                  {item.commonPitfalls && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', color: '#f59e0b' }}>
                      <strong>Common pitfall:</strong>
                      <span>{item.commonPitfalls}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions: Save Progress, Reset, Last Saved Timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        }}
      >
        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          {lastSaved ? (
            <span>Auto-saved to device at {new Date(lastSaved).toLocaleTimeString()}</span>
          ) : (
            <span>Progress automatically saved locally to your device</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            <RotateCcw size={13} style={{ marginRight: '0.3rem' }} /> Reset
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleManualSave}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            <Save size={13} style={{ marginRight: '0.3rem' }} /> Save Progress
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationReadinessScorecard;
