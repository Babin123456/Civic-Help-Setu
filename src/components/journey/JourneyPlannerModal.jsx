import { useState, useMemo } from 'react';
import {
  X,
  Compass,
  CheckCircle2,
  Lock,
  Clock,
  FileText,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { CIVIC_JOURNEY_TEMPLATES } from '../../data/civicJourneyTemplates.js';
import {
  computeJourneyProgress,
  saveJourneyProgress,
  loadJourneyProgress,
  resetJourneyProgress,
} from '../../services/journeyDependencyEngine.js';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * JourneyPlannerModal Component (#79)
 * Multi-service application journey planner converting interdependent service prerequisites
 * into a topologically ordered, trackable checklist.
 */
const JourneyPlannerModal = ({ isOpen, onClose }) => {
  const [selectedJourneyId, setSelectedJourneyId] = useState(
    CIVIC_JOURNEY_TEMPLATES[0].id
  );

  const selectedTemplate = useMemo(() => {
    return (
      CIVIC_JOURNEY_TEMPLATES.find((j) => j.id === selectedJourneyId) ||
      CIVIC_JOURNEY_TEMPLATES[0]
    );
  }, [selectedJourneyId]);

  // Load persisted progress state
  const [completedTaskIds, setCompletedTaskIds] = useState(() =>
    loadJourneyProgress(selectedJourneyId)
  );

  // When journey changes, load its progress
  const handleSelectJourney = (journeyId) => {
    setSelectedJourneyId(journeyId);
    setCompletedTaskIds(loadJourneyProgress(journeyId));
  };

  // Toggle completion of a task
  const handleToggleTask = (taskId, isCurrentlyCompleted, isLocked) => {
    if (isLocked && !isCurrentlyCompleted) return;

    let updated;
    if (isCurrentlyCompleted) {
      updated = completedTaskIds.filter((id) => id !== taskId);
    } else {
      updated = [...completedTaskIds, taskId];
    }

    setCompletedTaskIds(updated);
    saveJourneyProgress(selectedJourneyId, updated);
  };

  // Reset current journey progress
  const handleReset = () => {
    resetJourneyProgress(selectedJourneyId);
    setCompletedTaskIds([]);
  };

  // Compute topological order and actionable status
  const progress = useMemo(() => {
    return computeJourneyProgress(selectedTemplate, completedTaskIds);
  }, [selectedTemplate, completedTaskIds]);

  if (!isOpen) return null;

  return (
    <div
      className="journey-planner-overlay animate-fade-in"
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
        className="journey-planner-modal"
        style={{
          background: 'var(--bg-main, #0a0a0a)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
          borderRadius: '1.25rem',
          maxWidth: '920px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
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
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.6rem',
                background: 'var(--accent-light, rgba(56, 189, 248, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <Compass size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                Multi-Service Application Journey Planner
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Directed prerequisite graph resolving optimal task ordering for complex civic applications
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Journey Planner"
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

        {/* Template Picker Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
            overflowX: 'auto',
          }}
        >
          {CIVIC_JOURNEY_TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === selectedJourneyId;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleSelectJourney(tmpl.id)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${
                    isSelected ? 'var(--accent-main, #38bdf8)' : 'transparent'
                  }`,
                  background: isSelected
                    ? 'rgba(56, 189, 248, 0.15)'
                    : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? 'var(--accent-main, #38bdf8)' : 'var(--text-secondary, #cbd5e1)',
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tmpl.icon}</span>
                <span>{tmpl.title}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Progress Overview Card */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '0.875rem',
              background: 'var(--glass-bg, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-main, rgba(255, 255, 255, 0.12))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: '800' }}>
                  {selectedTemplate.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', maxWidth: '600px' }}>
                  {selectedTemplate.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    borderRadius: '0.375rem',
                    color: 'var(--text-secondary, #cbd5e1)',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset Journey</span>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  flex: 1,
                  height: '0.625rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress.percentComplete}%`,
                    height: '100%',
                    background:
                      progress.percentComplete === 100
                        ? '#4ade80'
                        : 'var(--accent-main, #38bdf8)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: progress.percentComplete === 100 ? '#4ade80' : 'var(--accent-main, #38bdf8)', minWidth: '45px' }}>
                {progress.percentComplete}%
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
              <span>
                Completed: <strong>{progress.completedCount} / {progress.totalTasks}</strong> tasks
              </span>
              <span>
                Estimated Time Remaining: <strong>{progress.estimatedRemainingDays} days</strong>
              </span>
            </div>
          </div>

          {/* Ordered Task Timeline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} color="var(--accent-main, #38bdf8)" />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Prerequisite-Ordered Action Plan
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {progress.orderedTasks.map((task, idx) => {
                const isCompleted = task.status === 'completed';
                const isActionable = task.status === 'actionable';
                const isLocked = task.status === 'locked';

                return (
                  <div
                    key={task.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: `1px solid ${
                        isCompleted
                          ? 'rgba(34, 197, 94, 0.3)'
                          : isActionable
                          ? 'var(--accent-main, #38bdf8)'
                          : 'rgba(255, 255, 255, 0.08)'
                      }`,
                      background: isCompleted
                        ? 'rgba(34, 197, 94, 0.04)'
                        : isActionable
                        ? 'rgba(56, 189, 248, 0.05)'
                        : 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                    }}
                  >
                    {/* Top Row: Sequence #, Title, Action Button */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                        <div
                          style={{
                            width: '1.75rem',
                            height: '1.75rem',
                            borderRadius: '50%',
                            background: isCompleted
                              ? '#22c55e'
                              : isActionable
                              ? 'var(--accent-main, #38bdf8)'
                              : 'rgba(255, 255, 255, 0.1)',
                            color: isCompleted || isActionable ? '#000000' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        >
                          {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h4
                              style={{
                                margin: 0,
                                fontSize: '1rem',
                                fontWeight: '700',
                                color: isCompleted
                                  ? '#86efac'
                                  : isLocked
                                  ? 'var(--text-secondary, #94a3b8)'
                                  : 'var(--text-primary, #ffffff)',
                                textDecoration: isCompleted ? 'line-through' : 'none',
                              }}
                            >
                              {task.title}
                            </h4>
                            {isActionable && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: '800',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  color: 'var(--accent-main, #38bdf8)',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                }}
                              >
                                Ready to Complete
                              </span>
                            )}
                            {isLocked && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-muted, #94a3b8)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <Lock size={10} /> Locked (Pending Prereqs)
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                            {task.guidance}
                          </p>
                        </div>
                      </div>

                      {/* Complete / Undo Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id, isCompleted, isLocked)}
                        disabled={isLocked && !isCompleted}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: isCompleted
                            ? '1px solid rgba(34, 197, 94, 0.4)'
                            : isActionable
                            ? '1px solid var(--accent-main, #38bdf8)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          background: isCompleted
                            ? 'rgba(34, 197, 94, 0.15)'
                            : isActionable
                            ? 'var(--accent-main, #38bdf8)'
                            : 'transparent',
                          color: isCompleted
                            ? '#4ade80'
                            : isActionable
                            ? '#000000'
                            : 'var(--text-muted, #64748b)',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: isLocked && !isCompleted ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>Done (Undo)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} />
                            <span>Mark Complete</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Unmet Prerequisites Warning if locked */}
                    {isLocked && task.unmetPrerequisites.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.75rem',
                          color: '#fbbf24',
                          background: 'rgba(234, 179, 8, 0.08)',
                          padding: '0.35rem 0.6rem',
                          borderRadius: '0.375rem',
                        }}
                      >
                        <AlertTriangle size={13} />
                        <span>
                          Prerequisites required first:{' '}
                          <strong>{task.unmetPrerequisites.join(', ')}</strong>
                        </span>
                      </div>
                    )}

                    {/* Prerequisite Documents Needed */}
                    {task.documentsNeeded && task.documentsNeeded.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-tertiary, #94a3b8)', fontWeight: '600' }}>
                          Documents required:
                        </span>
                        {task.documentsNeeded.map((doc, dIdx) => (
                          <span
                            key={dIdx}
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '0.25rem',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-secondary, #cbd5e1)',
                            }}
                          >
                            {doc}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer: Official Link & Estimated Duration */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', paddingTop: '0.25rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} />
                        <span>Est: ~{task.estimatedDays} days</span>
                      </span>

                      {task.officialSource?.url && (
                        <a
                          href={safeHttpUrl(task.officialSource.url) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: 'var(--accent-hover, #7dd3fc)',
                            textDecoration: 'none',
                            fontWeight: '600',
                          }}
                        >
                          <ShieldCheck size={12} color="#4ade80" />
                          <span>{task.officialSource.name}</span>
                          <ExternalLink size={10} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JourneyPlannerModal;
