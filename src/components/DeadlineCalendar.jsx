import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  FileText,
  ExternalLink,
  Copy,
  Print,
  ArrowLeftRight,
  Loader2,
  Error,
  Shield,
  Mail,
  Folder,
} from 'lucide-react';
import {
  ACTION_TYPES,
  CONFIRMATION_STATES,
  exportConfirmedDatesToIcs,
  getReadableList,
} from '../../services/dateCandidateService';
import { useUser } from '@clerk/clerk-react';
import { requirePermission } from '../../services/accessControl';

const LANE_COLORS = {
  [ACTION_TYPES.RESPONSE]: 'rgba(37, 99, 235, 0.15)', // blue-500
  [ACTION_TYPES.HEARING]: 'rgba(16, 185, 129, 0.15)', // green-500
  [ACTION_TYPES.PAYMENT]: 'rgba(239, 68, 68, 0.15)', // red-500
  [ACTION_TYPES.APPEAL]: 'rgba(168, 85, 247, 0.15)', // violet-500
};

const LANE_LABELS = {
  [ACTION_TYPES.RESPONSE]: 'Response',
  [ACTION_TYPES.HEARING]: 'Hearing',
  [ACTION_TYPES.PAYMENT]: 'Payment',
  [ACTION_TYPES.APPEAL]: 'Appeal',
};

const LANE_ORDER = [ACTION_TYPES.RESPONSE, ACTION_TYPES.HEARING, ACTION_TYPES.PAYMENT, ACTION_TYPES.APPEAL];

const ACTION_ICONS = {
  [ACTION_TYPES.RESPONSE]: FileText,
  [ACTION_TYPES.HEARING]: Calendar,
  [ACTION_TYPES.PAYMENT]: Clock,
  [ACTION_TYPES.APPEAL]: AlertCircle,
};

function getLaneClass(actionType) {
  return LANE_COLORS[actionType] ? `lane-${actionType}` : '';
}

function getConfirmationBadgeClass confirmationState) {
  switch (confirmationState) {
    case CONFIRMATION_STATES.CONFIRMED:
      return 'confirmed';
    case CONFIRMATION_STATES.REJECTED:
      return 'rejected';
    default:
      return 'pending';
  }
}

function getConfirmationLabel(confirmationState) {
  switch (confirmationState) {
    case CONFIRMATION_STATES.CONFIRMED:
      return 'Confirmed';
    case CONFIRMATION_STATES.REJECTED:
      return 'Rejected';
    default:
      return 'Pending';
  }
}

function getConfirmationColor(confirmationState) {
  switch (confirmationState) {
    case CONFIRMATION_STATES.CONFIRMED:
      return '#16a34a'; // green-600
    case CONFIRMATION_STATES.REJECTED:
      return '#ef4444'; // red-600
    default:
      return '#f59e0b'; // amber-500
  }
}

export default function DeadlineCalendar({
  noticeId,
  onMilestoneOpen,
  onExportIcs,
  onPrintList,
  onClose,
}) {
  const { user, isLoaded } = useUser();
  const [candidates, setCandidates] = useState([]);
  const [laneCandidates, setLaneCandidates] = useState({});
  const [state, setState] = useState('idle'); // idle, loading, error, empty, stale-data, permission-denied
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [view, setView] = useState('timeline'); // timeline, monthly
  const calendarRef = useRef(null);

  useEffect(() => {
    if (!noticeId) {
      setState('empty');
      return;
    }

    // Check permissions
    if (user && !isLoaded) {
      setState('permission-denied');
      return;
    }

    // If user is not loaded yet, wait
    if (!isLoaded) {
      setState('loading');
      const checkAuth = setInterval(() => {
        if (isLoaded) {
          clearInterval(checkAuth);
          loadCandidates();
        }
      }, 100);
      return;
    }

    loadCandidates();
  }, [noticeId, isLoaded, user]);

  const loadCandidates = async () => {
    setState('loading');
    try {
      const allCandidates = await import(/* webpackChunkName: "dateCandidateService" */ './dateCandidateService');
      const candidatesData = allCandidates.getDateCandidates();
      let filtered = candidatesData.filter((c) => c.noticeId === noticeId || (!noticeId && c.noticeId));

      // If we have noticeId, we need to fetch candidates specific to this notice
      // In a real implementation, this would query from server with proper filtering
      // For now, use all candidates and filter client-side
      if (noticeId) {
        filtered = filtered.filter((c) => c.noticeId === noticeId);
      }

      if (filtered.length === 0) {
        setState('empty');
        setCandidates([]);
        setLaneCandidates({});
        return;
      }

      // Calculate dependencies
      const withDeps = allCandidates.calculateDependencies(filtered);

      setCandidates(withDeps);

      // Organize by lane
      const lanes = {};
      LANE_ORDER.forEach((actionType) => {
        lanes[actionType] = withDeps.filter(
          (c) => c.actionType === actionType && c.normalizedDate
        );
      });
      setLaneCandidates(lanes);

      // Update state based on content
      const hasConfirmed = withDeps.some(
        (c) => c.confirmationState === CONFIRMATION_STATES.CONFIRMED
      );
      setState(hasConfirmed ? 'idle' : 'empty');
    } catch (err) {
      console.error('Error loading date candidates:', err);
      setError(err);
      setState('error');
    }
  };

  const handleConfirm = async (candidateId, customStorage = null) => {
    try {
      await import(/* webpackChunkName: "dateCandidateService" */ './dateCandidateService');
      const result = await import('./dateCandidateService').then((mod) =>
        mod.updateCandidateConfirmation(candidateId, CONFIRMATION_STATES.CONFIRMED, customStorage)
      );
      loadCandidates();
    } catch (err) {
      console.error('Error confirming candidate:', err);
    }
  };

  const handleReject = async (candidateId, customStorage = null) => {
    try {
      await import('./dateCandidateService').then((mod) =>
        mod.updateCandidateConfirmation(candidateId, CONFIRMATION_STATES.REJECTED, customStorage)
      );
      loadCandidates();
    } catch (err) {
      console.error('Error rejecting candidate:', err);
    }
  };

  const handleOpenSource = (candidate) => {
    if (onMilestoneOpen) {
      onMilestoneOpen(candidate.sourceAnchor);
    }
  };

  const handleExportIcs = () => {
    const icsContent = exportConfirmedDatesToIcs(candidates);
    if (icsContent && onExportIcs) {
      onExportIcs(icsContent);
    }
  };

  const handlePrintList = () => {
    if (onPrintList) {
      onPrintList();
    }
  };

  // Render state-specific UIs
  if (!isLoaded && !user) {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          padding: '2rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          color: '#ef4444',
          margin: '2rem auto',
          maxWidth: '400px',
        }}
      >
        <Shield size={20} color="#ef4444" style={{ marginRight: '0.5rem' }} />
        Permission denied. Please sign in to view deadline calendars.
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          margin: '2rem auto',
          maxWidth: '400px',
        }}
      >
        <Loader2 size={48} className='mx-auto mb-3' />
        <p>Loading deadline calendar...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          padding: '2rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          color: '#ef4444',
          margin: '2rem auto',
          maxWidth: '400px',
        }}
      >
        <Error size={24} color="#ef4444" style={{ marginRight: '0.5rem' }} />
        <p>Error loading deadline calendar: {error.message || 'Unknown error'}</p>
        <button
          onClick={() => loadCandidates()}
          style={{
            marginTop: '0.5rem',
            marginBottom: '0.5rem',
            padding: '0.5rem 1rem',
            border: '1px solid var(--accent-main)',
            background: 'transparent',
            color: 'var(--accent-main)',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.5rem',
          background: 'var(--bg-secondary)',
          margin: '2rem auto',
          maxWidth: '400px',
        }}
      >
        <Calendar size={48} style={{ opacity: 0.5, margin: '0 auto 0.75rem' }} />
        <p style={{ margin: '0.5rem 0', fontWeight: '600' }}>No deadlines found</p>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          This notice has no extracted date candidates. The AI may not have found
          explicit deadlines, or this notice type does not include statutory milestones.
        </p>
        <button
          onClick={() => loadCandidates()}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            border: '1px solid var(--accent-main)',
            background: 'transparent',
            color: 'var(--accent-main)',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (state === 'permission-denied') {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          padding: '2rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          color: '#ef4444',
          margin: '2rem auto',
          maxWidth: '400px',
        }}
      >
        <Shield size={20} color="#ef4444" style={{ marginRight: '0.5rem' }} />
        <p>Permission denied. You do not have access to view deadline calendars.</p>
      </div>
    );
  }

  // Main content - render calendar view
  const candidatesByLane = laneCandidates;

  return (
    <div
      style={{
        padding: '1rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          Deadline Calendar
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={view}
            onChange={(e) => setView(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              minWidth: '120px',
            }}
          >
            <option value="timeline">Timeline View</option>
            <option value="monthly">Monthly Calendar</option>
          </select>
          <button
            onClick={handleExportIcs}
            disabled={!hasConfirmedCandidates()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--accent-main)',
              background: 'transparent',
              color: 'var(--accent-main)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {hasConfirmedCandidates() ? 'Export ICS' : 'No confirmed dates'}
          </button>
          <button
            onClick={handlePrintList}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-main)',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Print List
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-main)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </header>

      {!hasConfirmedCandidates() && state !== 'empty' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(254, 226, 88, 0.1)',
            border: '1px solid #fcd34d',
            borderRadius: '0.375rem',
            color: '#d97706',
            fontSize: '0.875rem',
          }}
        >
          <Calendar size={16} style={{ marginRight: '0.25rem' }} />
          No confirmed deadlines yet. Confirm each milestone to enable export and print.
        </div>
      )}

      {/* Timeline View */}
      {view === 'timeline' && renderTimelineView(candidatesByLane)}

      {/* Monthly Calendar View */}
      {view === 'monthly' && renderMonthlyView(candidatesByLane)}
    </div>
  );
}

/**
 * Renders the timeline view with action dependency lanes.
 */
function renderTimelineView(laneCandidates) {
  if (!laneCandidates || Object.keys(laneCandidates).length === 0) {
    return renderEmptyState('No date candidates found for selected view.');
  }

  return (
    <div style={{ flex: 1, minHeight: '400px' }}>
      {LANE_ORDER.map((actionType) => {
        const laneCandidates = laneCandidates[actionType] || [];
        const laneLabel = LANE_LABELS[actionType];
        const laneColor = getLaneClass(actionType);

        if (laneCandidates.length === 0) {
          return null;
        }

        return (
          <div
            key={actionType}
            style={{
              border: `1px solid ${LANE_COLORS[actionType]}`,
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              background: LANE_COLORS[actionType],
              overflow: 'hidden',
            }}
          >
            {/* Lane Header */}
            <div
              style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <ACTION_ICONS[actionType] size={16} color={getLaneColor(actionType)} />
                <span>{laneLabel}</span>
                {laneCandidates.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {laneCandidates.length} milestone{s: laneCandidates.length !== 1}
                  </span>
                )}
              </span>
              <small
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {getConfirmationLabel(CONFIRMATION_STATES.PENDING)}
              </small>
            </div>

            {/* Lane Content - milestones */}
            <div
              style={{
                padding: '0.5rem',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {laneCandidates.map((c, i) => {
                const isConfirmed = c.confirmationState === CONFIRMATION_STATES.CONFIRMED;
                const isRejected = c.confirmationState === CONFIRMATION_STATES.REJECTED;
                const confirmationClass = getConfirmationBadgeClass(c.confirmationState);
                const confirmationColor = getConfirmationColor(c.confirmationState);
                const dateDisplay = c.normalizedDate ? new Date(c.normalizedDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }) : 'Invalid date';

                return (
                  <div
                    key={c.id}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: '0.375rem',
                      marginBottom: '0.4rem',
                      background: isConfirmed
                        ? 'rgba(22, 163, 74, 0.1)'
                        : isRejected
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'rgba(254, 226, 88, 0.03)',
                      border: isConfirmed
                        ? '1px solid #86efac'
                        : isRejected
                        ? '1px solid #f87171'
                        : '1px solid #fcd34d',
                      transition: 'background 0.2s, border-color 0.2s',
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenSource(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenSource(c);
                      }
                      if (e.key === 'c' || e.key === 'C') {
                        e.preventDefault();
                        if (isConfirmed) handleReject(c.id);
                        else handleConfirm(c.id);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Action type icon and label */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.2rem',
                      }}
                    >
                      <ACTION_ICONS[c.actionType] size={14} color={confirmationColor} />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: confirmationColor,
                        }}
                      >
                        {LANE_LABELS[c.actionType]}
                      </span>
                    </div>

                    {/* Date and confirmation state */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.2rem',
                        fontSize: '0.82rem',
                      }}
                    >
                      <Calendar size={12} color={confirmationColor} style={{ flexShrink: 0 }} />
                      <span>{dateDisplay}</span>
                    </div>

                    {/* Source anchor - truncated */}
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        minHeight: 2.8,
                      }}
                    >
                      {c.sourceAnchor || 'No source anchor'}
                    </div>

                    {/* Confirmation/R rejection state badge */}
                    <span
                      style={{
                        marginLeft: 'auto',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '0.2rem',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: confirmationColor,
                        background: confirmationStateToBg(c.confirmationState),
                      }}
                    >
                      {getConfirmationLabel(c.confirmationState)}
                    </span>

                    {/* Dependency indicators */}
                    {c.dependsOn && c.dependsOn.length > 0 && (
                      <div
                        style={{
                          marginTop: '0.2rem',
                          fontSize: '0.65rem',
                          color: 'var(--text-tertiary)',
                          lineHeight: 1.3,
                        }}
                      >
                        {c.dependsOn.map((depId) => {
                          const depCandidate = laneCandidates[depId]
                            ? Object.values(laneCandidates).flat().find((c) => c.id === depId)
                            : null;
                          if (depCandidate) {
                            return (
                              <span key={depId} style={{ marginRight: '0.4rem' }}>
                                ⇅
                              </span>
                            );
                          }
                          return null;
                        })}
                        {c.dependencyNotes && c.dependencyNotes.length > 0 && (
                          <span>{c.dependencyNotes.join(', ')}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add confirmation action area if all are pending */}
              {!laneCandidates.some((c) => c.confirmationState === CONFIRMATION_STATES.CONFIRMED) &&
                !laneCandidates.some((c) => c.confirmationState === CONFIRMATION_STATES.REJECTED) && (
                <div
                  style={{
                    padding: '0.5rem 0.8rem',
                    borderTop: '1px dashed var(--border-main)',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.75rem',
                  }}
                >
                  Click on a milestone to confirm or reject it. Use <kbd>C</kbd> key as shortcut.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders the monthly calendar view.
 */
function renderMonthlyView(laneCandidates) {
  const allConfirmed = [];
  const allPending = [];

  LANE_ORDER.forEach((actionType) => {
    (laneCandidates[actionType] || []).forEach((c) => {
      if (c.normalizedDate) {
        if (c.confirmationState === CONFIRMATION_STATES.CONFIRMED) {
          allConfirmed.push(c);
        } else {
          allPending.push(c);
        }
      }
    });
  });

  if (allConfirmed.length === 0 && allPending.length === 0) {
    return renderEmptyState('No date candidates with valid dates for monthly view.');
  }

  // Get all unique months from candidates
  const months = new Set();
  [...allConfirmed, ...allPending].forEach((c) => {
    if (c.normalizedDate) {
      months.add(c.normalizedDate.slice(0, 7)); // YYYY-MM
    }
  });

  // Sort months chronologically
  const sortedMonths = Array.from(months).sort();

  return (
    <div style={{ flex: 1, minHeight: '400px' }}>
      {sortedMonths.map((monthYear) => {
        const [year, month] = monthYear.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, 1));
        const monthName = date.toLocaleString('en-US', { month: 'long' });
        const monthNum = month;

        const confirmedInMonth = allConfirmed.filter(
          (c) => c.normalizedDate.slice(0, 7) === monthYear
        );
        const pendingInMonth = allPending.filter(
          (c) => c.normalizedDate.slice(0, 7) === monthYear
        );

        return (
          <div
            key={monthYear}
            style={{
              border: '1px solid var(--border-main)',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              background: 'var(--bg-secondary)',
            }}
          >
            {/* Month Header */}
            <div
              style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {monthName} {year}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                {confirmedInMonth.length} confirmed•{pendingInMonth.length} pending
              </span>
            </div>

            {/* Calendar grid */}
            <div style={{ padding: '0.5rem' }}>
              {/* Day names */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '0.2rem',
                  marginBottom: '0.2rem',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-tertiary)',
                }}
              >
                ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <span key={d} style={{ textAlign: 'center' }}>{d}</span>
                ))
              </div>

              {/* Days container */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '2px',
                  background: 'var(--border-main)',
                  borderRadius: '4px',
                  padding: '4px',
                }}
              >
                {/* Generate 42 cells (6 weeks × 7 days) */}
                {Array.from({ length: 42 }).map((_, dayIndex) => {
                  const dayOfWeek = dayIndex % 7;
                  const monthDay = Math.floor(dayIndex / 7) + 1;
                  const isCurrentMonth =
                    dayIndex % 7 < 3 ? // rough heuristic for visual
                    false : true;

                  const isInMonth = isCurrentMonth
                    ? monthIndex >= 1 && monthIndex <= 31
                    : true;

                  const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(
                    monthDay,
                  ).padStart(2, '0')}`;

                  // Find candidates for this date
                  const dateConfirmed = confirmedInMonth.filter(
                    (c) => c.normalizedDate === dateStr
                  );
                  const datePending = pendingInMonth.filter(
                    (c) => c.normalizedDate === dateStr
                  );

                  const hasCandidates = dateConfirmed.length > 0 || datePending.length > 0;
                  const confirmedCount = dateConfirmed.length;
                  const pendingCount = datePending.length;

                  // Determine background color
                  let bgColor = 'var(--bg-tertiary)';
                  let textColor = 'var(--text-primary)';
                  let borderColor = 'var(--border-main)';

                  if (hasCandidates) {
                    if (confirmedCount > 0 && pendingCount > 0) {
                      bgColor = 'rgba(254, 226, 88, 0.3)';
                      borderColor = '#fcd34d';
                      textColor = '#d97706';
                    } else if (confirmedCount > 0) {
                      bgColor = 'rgba(22, 163, 74, 0.2)';
                      borderColor = '#86efac';
                      textColor = '#16a34a';
                    } else if (pendingCount > 0) {
                      bgColor = 'rgba(37, 99, 235, 0.15)';
                      borderColor = '#3b82f6';
                      textColor = '#2563eb';
                    }
                  }

                  return (
                    <div
                      key={dayIndex}
                      style={{
                        height: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: textColor,
                        fontSize: isCurrentMonth && isInMonth ? '0.7rem' : '0.5rem',
                        borderRadius: '4px',
                        margin: '1px',
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      onClick={() => {
                        // Navigate to date detail or handle click
                        setSelectedDate(dateStr);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedDate(dateStr);
                        }
                      }}
                    >
                      {isCurrentMonth && isInMonth
                        ? (
                          <>
                            <span
                              style={{
                                opacity: monthDay > 0 ? 1 : 0.3,
                                fontWeight: monthDay > 0 ? 600 : 400,
                              }}
                            >
                              {monthDay > 0 ? monthDay : ''}
                            </span>
                            {confirmedCount > 0 && (
                              <span
                                style={{
                                  marginLeft: '0.1rem',
                                  fontSize: '0.55rem',
                                  color: '#16a34a',
                                }}
                              >
                                ✓{confirmedCount}
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span
                                style={{
                                  marginLeft: '0.1rem',
                                  fontSize: '0.55rem',
                                  color: '#3b82f6',
                                }}
                              >
                                •{pendingCount}
                              </span>
                            )}
                          </>
                        )
                        : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div
              style={{
                padding: '0.5rem 1rem',
                borderTop: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                fontSize: '0.65rem',
                color: 'var(--text-tertiary)',
              }}
            >
              <span style={{ color: '#16a34a', marginRight: '0.3rem' }}>✓ Confirmed</span>
              <span style={{ color: '#3b82f6', marginRight: '0.3rem' }}>• Pending</span>
              <span style={{ color: '#fcd34d', marginRight: '0.3rem' }}> Both</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders empty state message.
 */
function renderEmptyState(message) {
  return (
    <div
      style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        minHeight: '200px',
        border: '1px solid var(--border-main)',
        borderRadius: '0.5rem',
        background: 'var(--bg-secondary)',
        margin: '1rem auto',
      }}
    >
      <Calendar size={48} style={{ opacity: 0.5, margin: '0 auto 0.75rem' }} />
      <p style={{ margin: '0.5rem 0', fontWeight: 600 }}>{message}</p>
    </div>
  );
}

/**
 * Checks if there are any confirmed candidates.
 */
function hasConfirmedCandidates() {
  return candidates.some(
    (c) => c.confirmationState === CONFIRMATION_STATES.CONFIRMED
  );
}

/**
 * Converts confirmation state to background color class.
 */
function confirmationStateToBg(confirmationState) {
  switch (confirmationState) {
    case CONFIRMATION_STATES.CONFIRMED:
      return '#16a34a';
    case CONFIRMATION_STATES.REJECTED:
      return '#ef4444';
    default:
      return '#f59e0b';
  }
}