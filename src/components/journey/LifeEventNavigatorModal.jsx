import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Compass,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  Eye,
  RotateCcw,
  Save,
  FileDown,
  Info,
  MapPin,
  Check,
  Briefcase,
  GraduationCap,
  Home,
  Award,
  HeartHandshake,
} from 'lucide-react';
import {
  getLifeEvents,
  getSupportedRegions,
  buildLifeEventJourney,
  saveUserJourney,
  loadUserJourney,
  resetUserJourney,
  exportJourneySummary,
} from '../../services/lifeEventNavigatorService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { safeHttpUrl } from '../../utils/safeContent';

const EVENT_ICONS = {
  Home: Home,
  GraduationCap: GraduationCap,
  Briefcase: Briefcase,
  Award: Award,
  HeartHandshake: HeartHandshake,
};

const STAGE_LABELS = {
  all: 'All Steps',
  immediate: 'Immediate (15-30 Days)',
  upcoming: 'Upcoming (30-90 Days)',
  optional: 'Optional Benefits',
};

const LifeEventNavigatorModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const allEvents = useMemo(() => getLifeEvents(), []);
  const supportedRegions = useMemo(() => getSupportedRegions(), []);

  const [selectedEventId, setSelectedEventId] = useState(allEvents[0]?.id || 'moving-home');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [activeStageTab, setActiveStageTab] = useState('all');
  const [completedTaskIds, setCompletedTaskIds] = useState([]);
  const [hiddenTaskIds, setHiddenTaskIds] = useState([]);
  const [showHiddenSection, setShowHiddenSection] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Load saved progress on event change
  useEffect(() => {
    if (!selectedEventId) return;
    const saved = loadUserJourney(selectedEventId);
    setCompletedTaskIds(saved.completedTaskIds || []);
    setHiddenTaskIds(saved.hiddenTaskIds || []);
    if (saved.region) setSelectedRegion(saved.region);
  }, [selectedEventId]);

  // Build the processed journey based on selections
  const journeyPlan = useMemo(() => {
    return buildLifeEventJourney(selectedEventId, {
      region: selectedRegion,
      hiddenTaskIds,
    });
  }, [selectedEventId, selectedRegion, hiddenTaskIds]);

  if (!isOpen) return null;

  const currentEvent = allEvents.find((e) => e.id === selectedEventId) || allEvents[0];
  const IconComponent = EVENT_ICONS[currentEvent?.icon] || Compass;

  // Toggle completion
  const handleToggleTask = (taskId) => {
    const nextCompleted = completedTaskIds.includes(taskId)
      ? completedTaskIds.filter((id) => id !== taskId)
      : [...completedTaskIds, taskId];
    setCompletedTaskIds(nextCompleted);
  };

  // Hide task
  const handleHideTask = (taskId) => {
    const nextHidden = [...hiddenTaskIds, taskId];
    setHiddenTaskIds(nextHidden);
    toast.info('Task hidden from roadmap. You can restore it below.');
  };

  // Restore task
  const handleRestoreTask = (taskId) => {
    const nextHidden = hiddenTaskIds.filter((id) => id !== taskId);
    setHiddenTaskIds(nextHidden);
    toast.success('Task restored to roadmap.');
  };

  // Save journey state
  const handleSaveProgress = () => {
    const ok = saveUserJourney(selectedEventId, {
      completedTaskIds,
      hiddenTaskIds,
      region: selectedRegion,
    });
    if (ok) {
      toast.success('Journey progress and preferences saved locally.');
    } else {
      toast.error('Failed to save progress.');
    }
  };

  // Reset journey state
  const handleResetJourney = () => {
    resetUserJourney(selectedEventId);
    setCompletedTaskIds([]);
    setHiddenTaskIds([]);
    toast.info('Journey roadmap reset.');
  };

  // Export summary
  const handleExportSummary = async () => {
    const summary = exportJourneySummary(
      currentEvent,
      { completedTaskIds, hiddenTaskIds },
      selectedRegion
    );
    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(summary);
        setCopiedSummary(true);
        toast.success('Roadmap summary copied to clipboard.');
        setTimeout(() => setCopiedSummary(false), 2500);
      }
    } catch {
      toast.error('Could not copy summary. Please try again.');
    }
  };

  // Filter tasks by active tab
  const displayedTasks =
    activeStageTab === 'all'
      ? journeyPlan.tasks
      : journeyPlan.tasks.filter((t) => t.stage === activeStageTab);

  const completedCount = journeyPlan.tasks.filter((t) => completedTaskIds.includes(t.id)).length;
  const progressPercent =
    journeyPlan.tasks.length > 0
      ? Math.round((completedCount / journeyPlan.tasks.length) * 100)
      : 0;

  return (
    <div
      className="journey-planner-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="life-event-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main)',
              }}
            >
              <IconComponent size={22} />
            </div>
            <div>
              <h2
                id="life-event-title"
                style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}
              >
                Civic Life-Event Navigator
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Guided roadmap connecting related public-service steps after major life transitions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '0.5rem',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '1.5rem 1.75rem', flex: 1 }}>
          {/* Life Event & Region Pickers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <label
                htmlFor="life-event-select"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}
              >
                Select Life Event:
              </label>
              <select
                id="life-event-select"
                className="input-field"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.6rem' }}
              >
                {allEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="region-select"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}
              >
                <MapPin size={15} color="var(--accent-main)" />
                <span>State or Region Portability:</span>
              </label>
              <select
                id="region-select"
                className="input-field"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.6rem' }}
              >
                {supportedRegions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name} {!region.isVerified ? '(Unverified Rules)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Legal Scope Disclaimer (Mandatory by criteria) */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
            }}
          >
            <Info size={17} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Scope Notice:</strong> Civic Help Setu provides an educational roadmap and connects you to
              official public services. We do not submit applications or change government records on your behalf.
            </span>
          </div>

          {/* Regional Disclosure Warning (Mandatory by criteria) */}
          {journeyPlan.regionalDisclosure && !journeyPlan.regionalDisclosure.isVerified && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: '0.75rem',
                fontSize: '0.82rem',
                color: '#eab308',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
              }}
            >
              <ShieldAlert size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>{journeyPlan.regionalDisclosure.message}</strong>
                <div style={{ marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                  {journeyPlan.regionalDisclosure.note}
                </div>
              </div>
            </div>
          )}

          {/* Progress Meter */}
          <div
            style={{
              background: 'var(--glass-bg)',
              padding: '1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                Roadmap Progress: {completedCount} of {journeyPlan.tasks.length} tasks completed
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-main)' }}>
                {progressPercent}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '99px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-main), var(--success))',
                  borderRadius: '99px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Stage Tabs (Immediate, Upcoming, Optional) */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid var(--border-main)',
              marginBottom: '1.25rem',
              overflowX: 'auto',
              paddingBottom: '0.25rem',
            }}
          >
            {['all', 'immediate', 'upcoming', 'optional'].map((tab) => {
              const count =
                tab === 'all'
                  ? journeyPlan.tasks.length
                  : journeyPlan.groups[tab]?.length || 0;
              const isActive = activeStageTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveStageTab(tab)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    border: 'none',
                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: isActive ? 'var(--accent-main)' : 'var(--text-secondary)',
                    fontWeight: isActive ? '700' : '500',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{STAGE_LABELS[tab]}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '99px',
                      background: isActive ? 'var(--accent-main)' : 'var(--border-light)',
                      color: isActive ? '#000' : 'var(--text-secondary)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Task List */}
          {displayedTasks.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: 'var(--text-tertiary)',
                background: 'var(--glass-bg)',
                borderRadius: '0.75rem',
                border: '1px dashed var(--border-light)',
              }}
            >
              No tasks found in this category.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {displayedTasks.map((task) => {
                const isCompleted = completedTaskIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    style={{
                      background: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'var(--glass-bg)',
                      border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light)'}`,
                      borderRadius: '0.85rem',
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Top Row: Checkbox, Title, Stage, Hide button */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task.id)}
                          aria-label={`Mark "${task.title}" as ${isCompleted ? 'incomplete' : 'completed'}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.1rem',
                            color: isCompleted ? 'var(--success)' : 'var(--text-tertiary)',
                            marginTop: '2px',
                          }}
                        >
                          {isCompleted ? <CheckCircle2 size={20} /> : <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid var(--border-main)' }} />}
                        </button>
                        <div>
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '0.98rem',
                              color: isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '99px',
                                background:
                                  task.stage === 'immediate'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : task.stage === 'upcoming'
                                    ? 'rgba(56, 189, 248, 0.15)'
                                    : 'rgba(168, 85, 247, 0.15)',
                                color:
                                  task.stage === 'immediate'
                                    ? '#ef4444'
                                    : task.stage === 'upcoming'
                                    ? 'var(--accent-main)'
                                    : '#a855f7',
                                fontWeight: '600',
                              }}
                            >
                              {task.stage.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {task.timeframe}
                            </span>
                            {task.serviceId && (
                              <Link
                                to={`/services/${task.serviceId}`}
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--accent-main)',
                                  textDecoration: 'none',
                                  fontWeight: '600',
                                }}
                              >
                                View Service Guide →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Hide Task Button */}
                      <button
                        type="button"
                        onClick={() => handleHideTask(task.id)}
                        title="Hide irrelevant task for my situation"
                        aria-label={`Hide task ${task.title}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          padding: '0.3rem',
                          borderRadius: '0.35rem',
                        }}
                      >
                        <EyeOff size={16} />
                      </button>
                    </div>

                    {/* Rationale: Why it appears */}
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        borderLeft: '3px solid var(--accent-main)',
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>Why this appears: </strong>
                      {task.rationale}
                    </div>

                    {/* Official Verified Source */}
                    {task.officialSource && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                        <ShieldCheck size={14} color="var(--success)" />
                        <span style={{ color: 'var(--text-tertiary)' }}>Verified Source:</span>
                        <a
                          href={safeHttpUrl(task.officialSource.url) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--accent-main)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'underline',
                          }}
                        >
                          {task.officialSource.name}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hidden Tasks Management Section */}
          {journeyPlan.hiddenCount > 0 && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px dashed var(--border-light)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowHiddenSection(!showHiddenSection)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {showHiddenSection ? <Eye size={15} /> : <EyeOff size={15} />}
                <span>
                  {showHiddenSection ? 'Hide' : 'Show'} {journeyPlan.hiddenCount} hidden task
                  {journeyPlan.hiddenCount > 1 ? 's' : ''}
                </span>
              </button>

              {showHiddenSection && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {journeyPlan.hiddenTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{task.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestoreTask(task.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={handleResetJourney}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <RotateCcw size={15} />
            <span>Reset Roadmap</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleExportSummary}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.5rem 0.9rem',
              }}
            >
              {copiedSummary ? <Check size={15} color="var(--success)" /> : <FileDown size={15} />}
              <span>{copiedSummary ? 'Copied!' : 'Export Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveProgress}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.5rem 1.1rem',
              }}
            >
              <Save size={15} />
              <span>Save Journey</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LifeEventNavigatorModal;
