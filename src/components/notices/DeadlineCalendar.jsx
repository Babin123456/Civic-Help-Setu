import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Download,
  ExternalLink,
  Pencil,
  Printer,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { getNotices, getNoticesForService } from '../../services/noticeDigestService';
import { safeHttpUrl } from '../../utils/safeContent';
import {
  ACTION_LABELS,
  CONFIRMATION_STATES,
  LANE_LABELS,
  LANE_ORDER,
  calculateDateDependencies,
  confirmDateCandidate,
  exportICal,
  formatDisplayDate,
  getNoticeDeadlines,
  rejectDateCandidate,
  resetDateCandidate,
  updateDateCandidate,
} from '../../services/dateCandidateService';

const STATE_LABEL = {
  [CONFIRMATION_STATES.PENDING]: 'Suggested',
  [CONFIRMATION_STATES.CONFIRMED]: 'Confirmed by you',
  [CONFIRMATION_STATES.REJECTED]: 'Dismissed',
};

const STATE_STYLE = {
  [CONFIRMATION_STATES.PENDING]: {
    border: '1px solid rgba(56, 189, 248, 0.35)',
    background: 'rgba(56, 189, 248, 0.06)',
    chipColor: '#3b82f6',
    chipBackground: 'rgba(56, 189, 248, 0.15)',
  },
  [CONFIRMATION_STATES.CONFIRMED]: {
    border: '1px solid rgba(34, 197, 94, 0.35)',
    background: 'rgba(34, 197, 94, 0.06)',
    chipColor: '#22c55e',
    chipBackground: 'rgba(34, 197, 94, 0.15)',
  },
  [CONFIRMATION_STATES.REJECTED]: {
    border: '1px solid rgba(239, 68, 68, 0.35)',
    background: 'rgba(239, 68, 68, 0.06)',
    chipColor: '#ef4444',
    chipBackground: 'rgba(239, 68, 68, 0.15)',
  },
};

const laneColor = {
  response: 'var(--accent-main, #2563eb)',
  hearing: '#0ea5e9',
  payment: '#8b5cf6',
  appeal: '#ef4444',
};

const groupByState = (deadlines) => ({
  pending: deadlines.filter((d) => d.confirmationState === CONFIRMATION_STATES.PENDING),
  confirmed: deadlines.filter((d) => d.confirmationState === CONFIRMATION_STATES.CONFIRMED),
  rejected: deadlines.filter((d) => d.confirmationState === CONFIRMATION_STATES.REJECTED),
});

const groupByLane = (deadlines) => {
  const lanes = { response: [], hearing: [], payment: [], appeal: [] };
  deadlines.forEach((deadline) => {
    const lane = deadline.lane || 'response';
    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push(deadline);
  });
  Object.keys(lanes).forEach((lane) => {
    lanes[lane].sort((a, b) => a.normalizedDate.localeCompare(b.normalizedDate));
  });
  return lanes;
};

const parseMonth = (dateOnly) => {
  const [year, month] = dateOnly.split('-').map(Number);
  return { year, month: month - 1 };
};

const buildMonths = (deadlines, now = new Date()) => {
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const dates = deadlines.map((d) => d.normalizedDate).filter(Boolean);
  const sorted = [today, ...dates].sort();
  const start = parseMonth(sorted[0]);
  const end = parseMonth(sorted[sorted.length - 1]);

  const months = [];
  let year = start.year;
  let month = start.month;
  while ((year < end.year || (year === end.year && month <= end.month)) && months.length < 12) {
    months.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DeadlineCalendar = ({
  noticeId,
  serviceId,
  notice: noticeProp,
  storage,
  defaultView = 'timeline',
  loading = false,
  error = null,
  onClose,
  className = '',
}) => {
  const [version, setVersion] = useState(0);
  const [mountedAt] = useState(() => Date.now());
  const [activeNoticeId, setActiveNoticeId] = useState(null);
  const [view, setView] = useState(defaultView);
  const [status, setStatus] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [expandedSourceId, setExpandedSourceId] = useState(null);

  const notices = useMemo(() => {
    if (noticeProp) return [noticeProp];
    if (noticeId) {
      const found = getNotices(storage).find((entry) => entry.id === noticeId);
      return found ? [found] : [];
    }
    if (serviceId) return getNoticesForService(serviceId, storage);
    return [];
    // `version` intentionally re-reads storage after a citizen action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeProp, noticeId, serviceId, storage, version]);

  const activeNotice = notices.find((entry) => entry.id === activeNoticeId) || notices[0] || null;

  const deadlines = useMemo(
    () => (activeNotice ? getNoticeDeadlines(activeNotice, { storage }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeNotice, storage, version]
  );

  const states = useMemo(() => groupByState(deadlines), [deadlines]);
  const lanes = useMemo(() => groupByLane(deadlines), [deadlines]);
  const dependencies = useMemo(() => calculateDateDependencies(deadlines), [deadlines]);

  const runAction = (operation, successMessage) => {
    try {
      operation();
      setVersion((value) => value + 1);
      setStatus({ type: 'success', message: successMessage });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Could not update this deadline.' });
    }
  };

  const beginEdit = (deadline) => {
    setEditingId(deadline.id);
    setEditDate(deadline.normalizedDate);
    setEditNote(deadline.note || '');
    setStatus(null);
  };

  const saveEdit = (deadlineId) => {
    runAction(
      () => updateDateCandidate(deadlineId, { normalizedDate: editDate, note: editNote }, storage),
      'Deadline updated and confirmed.'
    );
    setEditingId(null);
  };

  const toggleSource = (deadline) => {
    const url = safeHttpUrl(deadline.sourceAnchor?.url);
    if (url && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setExpandedSourceId((current) => (current === deadline.id ? null : deadline.id));
  };

  const handleExport = () => {
    if (!activeNotice) return;
    const ical = exportICal(activeNotice, storage);
    if (!ical) {
      setStatus({ type: 'error', message: 'Confirm at least one deadline before exporting.' });
      return;
    }

    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deadlines-${activeNotice.id}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    setStatus({ type: 'success', message: 'Exported confirmed deadlines to your calendar.' });
  };

  if (loading) {
    return (
      <section
        className={`section container ${className}`.trim()}
        aria-busy="true"
        aria-live="polite"
        style={{ padding: '2rem 1.5rem' }}
      >
        <div className="glass-panel" style={{ padding: '1.5rem', maxWidth: '560px' }}>
          <CalendarIcon size={24} aria-hidden="true" />
          <p style={{ margin: '0.75rem 0 0', color: 'var(--text-secondary)' }}>
            Loading public notice deadlines...
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`section container ${className}`.trim()} role="alert" style={{ padding: '2rem 1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', maxWidth: '560px', borderLeft: '4px solid #ef4444' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>Deadline calendar unavailable</h2>
          <p style={{ marginBottom: 0, color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </section>
    );
  }

  // Services without a linked public notice simply do not show a calendar.
  if (!activeNotice) return null;

  const nothingToShow = deadlines.length === 0;
  const reviewedAtMs = activeNotice.reviewedAtDate
    ? new Date(activeNotice.reviewedAtDate).getTime()
    : null;
  const isStale =
    reviewedAtMs !== null &&
    !Number.isNaN(reviewedAtMs) &&
    mountedAt - reviewedAtMs > 365 * 24 * 60 * 60 * 1000;

  return (
    <section
      className={`section container ${className}`.trim()}
      aria-labelledby="notice-deadline-heading"
      style={{ padding: '2rem 1.5rem' }}
    >
      <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <CalendarIcon size={20} color="var(--accent-main)" aria-hidden="true" />
              <h2 id="notice-deadline-heading" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>
                Public notice deadline calendar
              </h2>
            </div>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {activeNotice.title}
            </p>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
              AI-suggested dates are labelled as suggestions. Only dates you confirm are treated as
              deadlines. Always verify against the official gazette.
            </p>
            {safeHttpUrl(activeNotice.sourceUrl) ? (
              <a
                href={safeHttpUrl(activeNotice.sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}
              >
                <ExternalLink size={12} aria-hidden="true" /> Official source
              </a>
            ) : null}
            {activeNotice.reviewedAtDate ? (
              <p style={{ margin: '0.35rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                Notice data reviewed {formatDisplayDate(activeNotice.reviewedAtDate)}
                {activeNotice.reviewedBy ? ` by ${activeNotice.reviewedBy}` : ''}.
              </p>
            ) : null}
            {isStale ? (
              <p style={{ margin: '0.35rem 0 0', color: '#b45309', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={11} aria-hidden="true" /> This notice was last reviewed over a year ago. Verify the official source before relying on these dates.
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleExport} aria-label="Export confirmed deadlines to iCalendar">
              <Download size={14} aria-hidden="true" /> Export iCal
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()} aria-label="Print deadline list">
              <Printer size={14} aria-hidden="true" /> Print
            </button>
            {onClose ? (
              <button type="button" className="btn btn-secondary" onClick={onClose} aria-label="Close deadline calendar">
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        {notices.length > 1 ? (
          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="notice-deadline-selector" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '0.25rem' }}>
              Choose a linked notice
            </label>
            <select
              id="notice-deadline-selector"
              value={activeNotice.id}
              onChange={(event) => {
                setActiveNoticeId(event.target.value);
                setEditingId(null);
                setStatus(null);
              }}
              className="input"
              style={{ maxWidth: '420px', width: '100%' }}
            >
              {notices.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {status ? (
          <p
            role={status.type === 'error' ? 'alert' : 'status'}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.4rem',
              fontSize: '0.82rem',
              color: status.type === 'error' ? '#ef4444' : '#22c55e',
              background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            }}
          >
            {status.message}
          </p>
        ) : null}

        {nothingToShow ? (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--glass-bg)', borderRadius: '0.5rem' }}>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>No deadlines can be derived yet</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              This notice has no official publication date in the catalogue, so no relative deadlines
              were calculated. Check the official source for dates.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }} role="group" aria-label="Deadline views">
              {[
                ['timeline', 'Timeline'],
                ['calendar', 'Monthly calendar'],
                ['list', 'List'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="btn btn-secondary"
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  style={
                    view === id
                      ? { background: 'var(--accent-main)', color: '#fff', border: '1px solid var(--accent-main)' }
                      : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {states.pending.length > 0 ? (
                <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: '#3b82f6', background: 'rgba(56, 189, 248, 0.15)' }}>
                  {states.pending.length} need your review
                </span>
              ) : null}
              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)' }}>
                {states.confirmed.length} confirmed
              </span>
              {states.rejected.length > 0 ? (
                <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)' }}>
                  {states.rejected.length} dismissed
                </span>
              ) : null}
            </div>

            {view === 'timeline' ? (
              <TimelineView
                lanes={lanes}
                dependencies={dependencies}
                deadlines={deadlines}
                editingId={editingId}
                editDate={editDate}
                editNote={editNote}
                expandedSourceId={expandedSourceId}
                onBeginEdit={beginEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                onEditDate={setEditDate}
                onEditNote={setEditNote}
                onToggleSource={toggleSource}
                onConfirm={(id) => runAction(() => confirmDateCandidate(id, storage), 'Deadline confirmed.')}
                onDismiss={(id) => runAction(() => rejectDateCandidate(id, storage), 'Deadline dismissed.')}
                onReset={(id) => runAction(() => resetDateCandidate(id, storage), 'Reverted to the suggested date.')}
              />
            ) : null}

            {view === 'calendar' ? (
              <MonthlyView deadlines={deadlines} onToggleSource={toggleSource} />
            ) : null}

            {view === 'list' ? (
              <ListView
                deadlines={deadlines}
                editingId={editingId}
                editDate={editDate}
                editNote={editNote}
                onBeginEdit={beginEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                onEditDate={setEditDate}
                onEditNote={setEditNote}
                onToggleSource={toggleSource}
                onConfirm={(id) => runAction(() => confirmDateCandidate(id, storage), 'Deadline confirmed.')}
                onDismiss={(id) => runAction(() => rejectDateCandidate(id, storage), 'Deadline dismissed.')}
                onReset={(id) => runAction(() => resetDateCandidate(id, storage), 'Reverted to the suggested date.')}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};

const SourceButton = ({ deadline, expanded, onToggle }) => (
  <div style={{ marginTop: '0.35rem' }}>
    <button
      type="button"
      onClick={() => onToggle(deadline)}
      aria-expanded={expanded}
      aria-label={`Open source for ${ACTION_LABELS[deadline.actionType] || deadline.actionType}`}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: 'var(--accent-main)',
        fontSize: '0.72rem',
        cursor: 'pointer',
        textDecoration: 'underline',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
      }}
    >
      <ExternalLink size={11} aria-hidden="true" /> Source
    </button>
    {expanded ? (
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
        {deadline.sourceAnchor?.passage || deadline.rawText}
      </p>
    ) : null}
  </div>
);

const DeadlineActions = ({ deadline, onConfirm, onDismiss, onReset, onBeginEdit }) => {
  const isPending = deadline.confirmationState === CONFIRMATION_STATES.PENDING;
  const isDismissed = deadline.confirmationState === CONFIRMATION_STATES.REJECTED;
  const isConfirmed = deadline.confirmationState === CONFIRMATION_STATES.CONFIRMED;

  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
      {!isConfirmed ? (
        <button
          type="button"
          onClick={() => onConfirm(deadline.id)}
          aria-label={`Confirm ${ACTION_LABELS[deadline.actionType] || deadline.actionType} on ${formatDisplayDate(deadline.normalizedDate)}`}
          style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', background: 'var(--accent-main)', color: '#fff', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
        >
          <CheckCircle2 size={11} aria-hidden="true" /> Confirm
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onBeginEdit(deadline)}
        aria-label={`Edit ${ACTION_LABELS[deadline.actionType] || deadline.actionType}`}
        style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '0.3rem', cursor: 'pointer' }}
      >
        <Pencil size={11} aria-hidden="true" /> Edit
      </button>
      {!isDismissed ? (
        <button
          type="button"
          onClick={() => onDismiss(deadline.id)}
          aria-label={`Dismiss ${ACTION_LABELS[deadline.actionType] || deadline.actionType}`}
          style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.3rem', cursor: 'pointer' }}
        >
          <XCircle size={11} aria-hidden="true" /> Dismiss
        </button>
      ) : null}
      {!isPending ? (
        <button
          type="button"
          onClick={() => onReset(deadline.id)}
          aria-label={`Reset ${ACTION_LABELS[deadline.actionType] || deadline.actionType} to suggested date`}
          style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', borderRadius: '0.3rem', cursor: 'pointer' }}
        >
          <RotateCcw size={11} aria-hidden="true" /> Reset
        </button>
      ) : null}
    </div>
  );
};

const EditForm = ({ deadline, editDate, editNote, onEditDate, onEditNote, onSave, onCancel }) => (
  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--glass-bg)', borderRadius: '0.4rem', border: '1px solid var(--border-light)' }}>
    <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.2rem' }} htmlFor={`edit-date-${deadline.id}`}>
      Date
    </label>
    <input
      id={`edit-date-${deadline.id}`}
      type="date"
      value={editDate}
      onChange={(event) => onEditDate(event.target.value)}
      style={{ width: '100%', padding: '0.3rem', marginBottom: '0.35rem' }}
    />
    <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '0.2rem' }} htmlFor={`edit-note-${deadline.id}`}>
      Note (optional)
    </label>
    <textarea
      id={`edit-note-${deadline.id}`}
      value={editNote}
      onChange={(event) => onEditNote(event.target.value)}
      rows={2}
      maxLength={500}
      style={{ width: '100%', padding: '0.3rem', marginBottom: '0.35rem' }}
    />
    <div style={{ display: 'flex', gap: '0.35rem' }}>
      <button type="button" className="btn btn-primary" onClick={() => onSave(deadline.id)} style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}>
        Save
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}>
        Cancel
      </button>
    </div>
  </div>
);

const DeadlineCard = ({
  deadline,
  editingId,
  editDate,
  editNote,
  expandedSourceId,
  onBeginEdit,
  onSaveEdit,
  onCancelEdit,
  onEditDate,
  onEditNote,
  onToggleSource,
  onConfirm,
  onDismiss,
  onReset,
}) => {
  const style = STATE_STYLE[deadline.confirmationState] || STATE_STYLE[CONFIRMATION_STATES.PENDING];
  const confidence = Math.round((deadline.confidence || 0) * 100);
  const isEditing = editingId === deadline.id;

  return (
    <article
      aria-label={`${ACTION_LABELS[deadline.actionType] || deadline.actionType} on ${formatDisplayDate(deadline.normalizedDate)}`}
      style={{ padding: '0.65rem', borderRadius: '0.5rem', border: style.border, background: style.background }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>
            {ACTION_LABELS[deadline.actionType] || deadline.actionType}
          </h4>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {formatDisplayDate(deadline.normalizedDate)}
          </p>
        </div>
        <span style={{ padding: '0.15rem 0.45rem', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, color: style.chipColor, background: style.chipBackground, whiteSpace: 'nowrap' }}>
          {STATE_LABEL[deadline.confirmationState]}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{confidence}% confidence</span>
        {deadline.isExpired ? (
          <span style={{ fontSize: '0.62rem', color: '#b45309', background: 'rgba(245, 158, 11, 0.15)', padding: '0 0.35rem', borderRadius: '999px' }}>
            Expired
          </span>
        ) : null}
        {deadline.requiresReview ? (
          <span style={{ fontSize: '0.62rem', color: '#b45309', background: 'rgba(245, 158, 11, 0.15)', padding: '0 0.35rem', borderRadius: '999px' }}>
            <AlertTriangle size={9} aria-hidden="true" /> Needs review
          </span>
        ) : null}
        {deadline.isOfficialField ? (
          <span style={{ fontSize: '0.62rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '0 0.35rem', borderRadius: '999px' }}>
            Official field
          </span>
        ) : null}
      </div>

      <p style={{ margin: '0.35rem 0 0', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
        {deadline.calculationRule}
      </p>
      {deadline.note ? (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
          Note: {deadline.note}
        </p>
      ) : null}

      <SourceButton
        deadline={deadline}
        expanded={expandedSourceId === deadline.id}
        onToggle={onToggleSource}
      />

      {isEditing ? (
        <EditForm
          deadline={deadline}
          editDate={editDate}
          editNote={editNote}
          onEditDate={onEditDate}
          onEditNote={onEditNote}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <DeadlineActions
          deadline={deadline}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
          onReset={onReset}
          onBeginEdit={onBeginEdit}
        />
      )}
    </article>
  );
};

const TimelineView = ({
  lanes,
  dependencies,
  deadlines,
  ...cardProps
}) => {
  const dependencyEntries = Object.entries(dependencies).filter(([, deps]) => deps.length > 0);

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {LANE_ORDER.map((lane) => {
        const laneDeadlines = lanes[lane] || [];
        if (laneDeadlines.length === 0) return null;
        return (
          <div key={lane} style={{ marginBottom: '1.25rem', borderTop: `4px solid ${laneColor[lane]}`, borderRadius: '0.5rem', paddingTop: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', color: laneColor[lane] }}>{LANE_LABELS[lane]}</h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{laneDeadlines.length} item(s)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
              {laneDeadlines.map((deadline) => (
                <DeadlineCard key={deadline.id} deadline={deadline} {...cardProps} />
              ))}
            </div>
          </div>
        );
      })}

      {dependencyEntries.length > 0 ? (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem' }}>Dependencies between actions</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {deadlineById(deadlines, dependencyEntries)}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

const deadlineById = (deadlines, dependencyEntries) => {
  const byId = Object.fromEntries(deadlines.map((deadline) => [deadline.id, deadline]));
  return dependencyEntries.map(([candidateId, deps]) => {
    const candidate = byId[candidateId];
    const label = candidate ? ACTION_LABELS[candidate.actionType] || candidate.actionType : candidateId;
    const prerequisites = deps
      .map((dep) => ACTION_LABELS[dep.dependsOnActionType] || dep.dependsOnActionType)
      .join(', ');
    return (
      <li key={candidateId}>
        {label} comes after {prerequisites}.
      </li>
    );
  });
};

const ListView = ({ deadlines, ...cardProps }) => (
  <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
      <caption style={{ textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
        Printable deadline list. All essential information is shown without hover.
      </caption>
      <thead>
        <tr style={{ background: 'var(--bg-main)', color: '#fff' }}>
          <th scope="col" style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
          <th scope="col" style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
          <th scope="col" style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
          <th scope="col" style={{ padding: '0.5rem', textAlign: 'left' }}>Confidence</th>
          <th scope="col" style={{ padding: '0.5rem', textAlign: 'left' }}>Source</th>
          <th scope="col" style={{ padding: '0.5rem', textAlign: 'left' }}>Manage</th>
        </tr>
      </thead>
      <tbody>
        {deadlines.map((deadline) => {
          const style = STATE_STYLE[deadline.confirmationState] || STATE_STYLE.pending;
          return (
            <tr key={deadline.id} style={{ borderBottom: '1px solid var(--border-light)', background: style.background }}>
              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{ACTION_LABELS[deadline.actionType] || deadline.actionType}</td>
              <td style={{ padding: '0.5rem' }}>
                {formatDisplayDate(deadline.normalizedDate)}
                {deadline.isExpired ? <span style={{ marginLeft: '0.35rem', fontSize: '0.65rem', color: '#b45309' }}>(expired)</span> : null}
              </td>
              <td style={{ padding: '0.5rem', color: style.chipColor, fontWeight: 600 }}>
                {STATE_LABEL[deadline.confirmationState]}
                {deadline.requiresReview ? ' · needs review' : ''}
              </td>
              <td style={{ padding: '0.5rem' }}>{Math.round((deadline.confidence || 0) * 100)}%</td>
              <td style={{ padding: '0.5rem', maxWidth: '220px' }}>
                <SourceButton
                  deadline={deadline}
                  expanded={cardProps.expandedSourceId === deadline.id}
                  onToggle={cardProps.onToggleSource}
                />
              </td>
              <td style={{ padding: '0.5rem', minWidth: '180px' }}>
                {cardProps.editingId === deadline.id ? (
                  <EditForm
                    deadline={deadline}
                    editDate={cardProps.editDate}
                    editNote={cardProps.editNote}
                    onEditDate={cardProps.onEditDate}
                    onEditNote={cardProps.onEditNote}
                    onSave={cardProps.onSaveEdit}
                    onCancel={cardProps.onCancelEdit}
                  />
                ) : (
                  <DeadlineActions
                    deadline={deadline}
                    onConfirm={cardProps.onConfirm}
                    onDismiss={cardProps.onDismiss}
                    onReset={cardProps.onReset}
                    onBeginEdit={cardProps.onBeginEdit}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const MonthlyView = ({ deadlines, onToggleSource }) => {
  const months = buildMonths(deadlines);
  const byDate = {};
  deadlines.forEach((deadline) => {
    byDate[deadline.normalizedDate] = byDate[deadline.normalizedDate] || [];
    byDate[deadline.normalizedDate].push(deadline);
  });
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

  return (
    <div style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {months.map(({ year, month }) => {
        const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const cells = [];

        for (let i = 0; i < firstDay; i += 1) cells.push(null);
        for (let day = 1; day <= daysInMonth; day += 1) {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          cells.push({ day, key, items: byDate[key] || [] });
        }

        return (
          <section
            key={`${year}-${month}`}
            aria-label={`${MONTH_NAMES[month]} ${year}`}
            style={{ padding: '0.75rem', background: 'var(--glass-bg)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{MONTH_NAMES[month]} {year}</h3>
            <div role="grid" aria-label={`${MONTH_NAMES[month]} ${year} deadlines`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
                <div key={label} role="columnheader" style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  {label}
                </div>
              ))}
              {cells.map((cell, index) => {
                if (!cell) return <div key={`blank-${index}`} role="gridcell" />;
                const expired = cell.key < todayKey;
                return (
                  <div
                    key={cell.key}
                    role="gridcell"
                    aria-label={`${formatDisplayDate(cell.key)}${cell.items.length ? `, ${cell.items.length} deadline(s)` : ''}`}
                    style={{
                      minHeight: '2.4rem',
                      padding: '0.15rem',
                      borderRadius: '0.25rem',
                      border: cell.key === todayKey ? '1px solid var(--accent-main)' : '1px solid transparent',
                      background: expired ? 'rgba(0,0,0,0.03)' : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: '0.62rem', color: expired ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{cell.day}</div>
                    {cell.items.map((item) => {
                      const style = STATE_STYLE[item.confirmationState] || STATE_STYLE.pending;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onToggleSource(item)}
                          title={`${ACTION_LABELS[item.actionType] || item.actionType}: ${STATE_LABEL[item.confirmationState]}`}
                          style={{
                            display: 'block',
                            width: '100%',
                            marginTop: '1px',
                            padding: '0.1rem 0.15rem',
                            fontSize: '0.55rem',
                            textAlign: 'left',
                            border: 'none',
                            borderRadius: '2px',
                            color: style.chipColor,
                            background: style.chipBackground,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ACTION_LABELS[item.actionType] || item.actionType}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default DeadlineCalendar;
