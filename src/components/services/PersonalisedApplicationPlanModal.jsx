import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Mail,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import {
  generatePersonalisedPlan,
  buildPlanPrintHtml,
  APPLICATION_MODES,
  STEP_TYPES,
} from '../../services/personalisedApplicationPlanService';

export default function PersonalisedApplicationPlanModal({
  isOpen,
  onClose,
  service,
}) {
  const [mode, setMode] = useState(APPLICATION_MODES.ONLINE_SELF);
  const [hasDocumentsReady, setHasDocumentsReady] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [checklistState, setChecklistState] = useState({});

  const plan = useMemo(() => {
    if (!service) return null;
    return generatePersonalisedPlan(service, {
      mode,
      hasDocumentsReady,
      isUrgent,
    });
  }, [service, mode, hasDocumentsReady, isUrgent]);

  if (!isOpen || !service || !plan) return null;

  const handleToggleCheck = (itemId) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmailPlan = () => {
    const subject = encodeURIComponent(`Application Plan: ${plan.serviceTitle}`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is your personalized application plan for ${plan.serviceTitle} from Civic Help Setu:\n\n` +
        plan.steps.map((s) => `Step ${s.order}: ${s.title}\nGuidance: ${s.guidance}\n`).join('\n')
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--card-bg)',
          borderRadius: '0.75rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              AI Personalised Application Plan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Guardrail Disclaimer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.55rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#059669',
            fontSize: '0.825rem',
            marginBottom: '1.25rem',
          }}
        >
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Grounded in Official Catalogue Records:</strong> All fees, criteria, and document steps are drawn directly from verified government guidelines.
            Missing official parameters are explicitly reported rather than guessed.
          </span>
        </div>

        {/* Situational Inputs Form */}
        <div
          style={{
            background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-color)',
            padding: '1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Personalise For Your Current Situation:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Filing Channel
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value={APPLICATION_MODES.ONLINE_SELF}>Online Self-Application</option>
                <option value={APPLICATION_MODES.CSC_COUNTER}>Assisted via CSC / Cyber Cafe</option>
                <option value={APPLICATION_MODES.OFFICE_DIRECT}>Direct Physical Office Visit</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasDocumentsReady}
                  onChange={(e) => setHasDocumentsReady(e.target.checked)}
                />
                I already have primary documents ready
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                />
                Urgent / expedited timeline required
              </label>
            </div>
          </div>
        </div>

        {/* Steps Roadmap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
          {plan.steps.map((step) => {
            const isOfficial = step.type === STEP_TYPES.OFFICIAL_REQUIREMENT;
            const isLimitation = step.type === STEP_TYPES.MISSING_DATA_ADVISORY;

            return (
              <div
                key={step.id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.55rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '50%',
                        background: isOfficial ? '#10b981' : isLimitation ? '#f59e0b' : '#3b82f6',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                      }}
                    >
                      {step.order}
                    </span>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {step.title}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.25rem',
                      background: isOfficial
                        ? 'rgba(16, 185, 129, 0.1)'
                        : isLimitation
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                      color: isOfficial ? '#059669' : isLimitation ? '#d97706' : '#2563eb',
                    }}
                  >
                    {isOfficial ? 'OFFICIAL REQUIREMENT' : isLimitation ? 'CATALOGUE LIMITATION' : 'AI GUIDANCE'}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {step.guidance}
                </p>

                {step.officialStatement && (
                  <div
                    style={{
                      fontSize: '0.775rem',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.35rem',
                      borderLeft: '3px solid var(--accent-main)',
                    }}
                  >
                    <strong>Catalogue Record:</strong> {step.officialStatement}
                    {step.sourceUrl && (
                      <a
                        href={step.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ marginLeft: '0.5rem', color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        Official Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Checklist sub-items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {step.checklist.map((item) => {
                    const isChecked = checklistState[item.id] !== undefined ? checklistState[item.id] : item.checked;
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.825rem',
                          color: isChecked ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCheck(item.id)}
                        />
                        {item.text}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.825rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <Printer className="w-3.5 h-3.5" /> Print Plan
            </button>

            <button
              type="button"
              onClick={handleEmailPlan}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.825rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <Mail className="w-3.5 h-3.5" /> Email Plan
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '0.4rem',
              background: 'var(--accent-main)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
