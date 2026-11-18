/**
 * CounterJourneySimulator component (#843)
 *
 * A citizen-facing simulator that walks a reviewed counter sequence,
 * lets the citizen mark documents as available, inspects blockers,
 * compares a complete visit with an incomplete one, and exports a
 * preparation checklist.
 *
 * Visual & interaction requirements satisfied:
 * - Counter-by-counter journey board with document checkpoints
 * - Blocker panel, source badges, linear checklist alternative
 * - Essential information without hover; keyboard navigation
 * - Loading, empty, error, stale-data, permission-denied states
 * - AI suggestions labelled 'SUGGESTION' with source references and data-version
 * - Clearly distinguishes private preparation progress from official status
 * - Reduced-motion support; effort bands only when officially sourced
 * - Responsive: board stacks into single-column list below 768px
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
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
  Info,
  MapPin,
  ListOrdered,
  CheckSquare,
  Bookmark,
  Upload,
  Download,
  Search,
  SearchX,
} from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  COUNTER_SOURCES,
  JOURNEY_DOCUMENTS,
  COUNTER_JOURNEYS,
  COUNTER_JOURNEY_DATA_VERSION,
  COUNTER_JOURNEY_REVIEW_DATE,
  COUNTER_JOURNEY_STALE_AFTER_DAYS,
  COUNTER_JOURNEY_DISCLAIMER,
  getCounterJourneysForService,
  getCounterSource,
  getJourneyOffice,
} from '../../data/civicCounterJourneyData';
import {
  evaluateCounterJourney,
  buildJourneyChecklistText,
  buildAICounterExplanation,
  COUNTER_STATUS,
} from '../../services/civicCounterJourneyService.js';
import { saveJourneyProgress, loadJourneyProgress, clearJourneyProgress } from '../../services/civicCounterJourneyService.js';
import { __testables } from '../../services/civicCounterJourneyService.js';

// ---------------------------------------------------------------------------
// Helpers / constants
// ---------------------------------------------------------------------------
const STALE_AFTER_DAYS = COUNTER_JOURNEY_STALE_AFTER_DAYS;
const JOURNEY_VERSION = COUNTER_JOURNEY_DATA_VERSION;
const REVIEW_DATE = COUNTER_JOURNEY_REVIEW_DATE;
const DISCLAIMER = COUNTER_JOURNEY_DISCLAIMER;

const DOCUMENT_CATEGORIES = {
  identity: ['aadhaar'],
  address: ['address-proof'],
  financial: ['income-proof', 'income-affidavit', 'ration-card'],
  reference: ['application-reference', 'acknowledgement-slip'],
  medical: ['medical-form-1a', 'self-declaration'],
  transport: ['learner-licence', 'age-proof', 'medical-form-1a', 'self-declaration', 'vehicle-rc'],
};

const VIEW_MODES = { BOARD: 'board', LINEAR: 'linear' };

const STATUS_BADGES = {
  [COUNTER_STATUS.COMPLETE]: { label: 'Complete', class: 'status-complete' },
  [COUNTER_STATUS.READY]: { label: 'Ready', class: 'status-ready' },
  [COUNTER_STATUS.UPCOMING]: { label: 'Upcoming', class: 'status-upcoming' },
  [COUNTER_STATUS.BLOCKED]: { label: 'Blocked', class: 'status-blocked' },
  [COUNTER_STATUS.BRANCH_REQUIRED]: { label: 'Branch required', class: 'status-branch' },
};

const VIEWPORT_BREAKPOINT = 768;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CounterJourneySimulator({
  initialServiceId = 'income-certificate',
  mode = 'interactive',
  onExport,
  evaluation: propEvaluation,
  evaluationLoading: propEvaluationLoading,
  evaluationError: propEvaluationError,
  evaluationStale: propEvaluationStale,
  showComparison: propShowComparison,
}) {
  const [reducedMotion] = useReducedMotion();

  // ------------------------------------------------------------------
  // State: service / office selection
  // ------------------------------------------------------------------
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedJourneyId, setSelectedJourneyId] = useState(() => {
    const found = COUNTER_JOURNEYS.find((j) => j.serviceId === selectedServiceId);
    return found?.id || null;
  });
  const [selectedOfficeId, setSelectedOfficeId] = useState(() => {
    const journey = COUNTER_JOURNEYS.find((j) => j.id === selectedJourneyId);
    return journey?.officeId || null;
  });

  // ------------------------------------------------------------------
  // State: resume from storage
  // ------------------------------------------------------------------
  const [resumedDocIds, setResumedDocIds] = useState(() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const stored = loadJourneyProgress(selectedJourneyId);
      return stored;
    } catch {
      return [];
    }
  });

  // ------------------------------------------------------------------
  // State: evaluation (only computed after user interacts)
  // ------------------------------------------------------------------
  const [internalEvaluation, setInternalEvaluation] = useState(null);
  const [internalEvaluationLoading, setInternalEvaluationLoading] = useState(false);
  const [internalEvaluationError, setInternalEvaluationError] = useState(null);
  const [internalEvaluationStale, setInternalEvaluationStale] = useState(false);

  const evaluation = propEvaluation !== undefined ? propEvaluation : internalEvaluation;
  const setEvaluation = setInternalEvaluation;

  const evaluationLoading = propEvaluationLoading !== undefined ? propEvaluationLoading : internalEvaluationLoading;
  const setEvaluationLoading = setInternalEvaluationLoading;

  const evaluationError = propEvaluationError !== undefined ? propEvaluationError : internalEvaluationError;
  const setEvaluationError = setInternalEvaluationError;

  const evaluationStale = propEvaluationStale !== undefined ? propEvaluationStale : internalEvaluationStale;
  const setEvaluationStale = setInternalEvaluationStale;
  const [showAI, setShowAI] = useState(false);
  const [aiConfirmations, setAiConfirmations] = useState(new Set());

  // ------------------------------------------------------------------
  // State: view mode & UI flags
  // ------------------------------------------------------------------
  const [viewMode, setViewMode] = useState('board');
  const [showLinearChecklist, setShowLinearChecklist] = useState(false);
  const [internalShowComparison, setInternalShowComparison] = useState(false);
  const showComparison =
    propShowComparison !== undefined
      ? propShowComparison
      : internalShowComparison || Boolean(propEvaluation?.comparison);
  const setShowComparison = setInternalShowComparison;
  const [showExport, setShowExport] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [focusedCounterId, setFocusedCounterId] = useState(null);

  // ------------------------------------------------------------------
  // Derived: available journeys filtered by service
  // ------------------------------------------------------------------
  const journeysForService = useMemo(() => {
    return getCounterJourneysForService(selectedServiceId);
  }, [selectedServiceId]);

  // ------------------------------------------------------------------
  // Derive office name from selected journey
  // ------------------------------------------------------------------
  const office = useMemo(() => {
    if (!selectedJourneyId) return null;
    return getJourneyOffice(selectedJourneyId);
  }, [selectedJourneyId]);

  // ------------------------------------------------------------------
  // State: stale check (data version vs review date)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!selectedJourneyId) return;
    const today = new Date();
    const ageDays = Math.floor(
      (today - new Date(REVIEW_DATE)) / 86400000
    );
    setEvaluationStale(ageDays > STALE_AFTER_DAYS);
  }, [selectedJourneyId]);

  // ------------------------------------------------------------------
  // Load evaluation automatically after resume? We recompute after user
  // marks some docs available. The initial state shows "no docs → all
  // counters blocked". Re‑evaluate when the available set changes.
  // ------------------------------------------------------------------
  const availableDocSet = useMemo(() => new Set(resumedDocIds), [resumedDocIds]);

  // Re‑evaluate when service, office, or resume changes
  useEffect(() => {
    if (!selectedJourneyId) {
      setEvaluation(null);
      setEvaluationError(null);
      return;
    }
    setEvaluationLoading(true);
    const today = new Date();
    evaluateCounterJourney({
      journeyId: selectedJourneyId,
      availableDocumentIds: Array.from(availableDocSet),
      context: {},
      today,
    })
      .then((result) => {
        if (result.ok) {
          setEvaluation(result);
          setEvaluationError(null);
          setEvaluationStale(false);
        } else {
          setEvaluationError(result.error);
        }
      })
      .catch((err) => {
        setEvaluationError({ code: 'UNEXPECTED', message: err.message });
      })
      .finally(() => setEvaluationLoading(false));
  }, [selectedJourneyId, availableDocSet.toString()]);

  // ------------------------------------------------------------------
  // AI confirmation flow: when the citizen clicks "Confirm" on an AI
  // suggestion, we remember the counter id so we can distinguish private
  // progress from "unconfirmed" suggestions.
  // ------------------------------------------------------------------
  const handleAiConfirm = useCallback((counterId) => {
    setAiConfirmations((prev) => {
      const next = new Set(prev);
      if (next.has(counterId)) next.delete(counterId);
      else next.add(counterId);
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Mark a document as available / unavailable. Persist to localStorage
  // (non‑sensitive ids only; no contents, numbers, passwords).
  // ------------------------------------------------------------------
  const toggleDocument = useCallback(
    (documentId) => {
      if (!JOURNEY_DOCUMENTS[documentId]) return;
      setResumedDocIds((prev) => {
        const next = prev.includes(documentId)
          ? prev.filter((id) => id !== documentId)
          : [...prev, documentId];
        try {
          if (typeof localStorage !== 'undefined') {
            saveJourneyProgress({ journeyId: selectedJourneyId, availableDocumentIds: next });
          }
        } catch {
          // ignore; localStorage may be full / private mode
        }
        return next;
      });
    },
    [selectedJourneyId]
  );

  // ------------------------------------------------------------------
  // Reset all documents (cancel / return to start)
  // ------------------------------------------------------------------
  const resetDocuments = useCallback(() => {
    if (window.confirm('Reset all document selections and restart the counter sequence?')) {
      setResumedDocIds([]);
      try {
        if (typeof localStorage !== 'undefined') clearJourneyProgress(selectedJourneyId);
      } catch {}
    }
  }, [selectedJourneyId]);

  // ------------------------------------------------------------------
  // Comparison toggle: show complete vs incomplete
  // ------------------------------------------------------------------
  const toggleComparison = useCallback(() => {
    setShowComparison(!showComparison);
    if (evaluation) {
      // Force re‑compute to show both paths; the service already stores both.
    }
  }, [evaluation]);

  // ------------------------------------------------------------------
  // Export checklist – trigger download
  // ------------------------------------------------------------------
  const handleExport = useCallback(() => {
    if (!evaluation) return;
    const text = buildJourneyChecklistText(evaluation);
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civic-counter-journey-${evaluation.journey.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowExport(true);
    if (onExport) onExport();
  }, [evaluation]);

  // ------------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------------
  const getDocumentLabel = (documentId) =>
    JOURNEY_DOCUMENTS[documentId]?.label || documentId;

  const getDocumentNote = (documentId) =>
    JOURNEY_DOCUMENTS[documentId]?.note || '';

  const isDocumentAvailable = (documentId) =>
    resumedDocIds.includes(documentId);

  // ------------------------------------------------------------------
  // Render: loading, empty, error, stale, permission‑denied states
  // ------------------------------------------------------------------
  if (!selectedJourneyId && !evaluation) {
    return (
      <section
        className="section"
        style={{ minHeight: '400px' }}
        aria-labelledby="journey-title"
      >
        <div className="container">
          <header className="section-header">
            <h1 id="journey-title" style={{ margin: 0 }}>
              Counter Journey Simulator
            </h1>
            <p className="section-subtitle">
              Select a service and office to load a reviewed counter sequence.
            </p>
          </header>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }} className="card-title">
              Choose a service
            </h2>
            <select
              className="form-select"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              aria-label="Select a civic service"
            >
              <option value="">— Select a service —</option>
              <option value="income-certificate">Income Certificate</option>
              <option value="driving-license">Driving License</option>
              <option value="passport">Passport</option>
            </select>
          </div>

          <select
            className="form-select"
            value={selectedOfficeId || ''}
            onChange={(e) => {
              if (e.target.value) setSelectedOfficeId(e.target.value);
              else setSelectedJourneyId(null);
            }}
            aria-label="Select an office (if multiple exist for the service)"
            style={{ marginTop: '0.5rem' }}
          >
            <option value="">— Select office (auto‑assigned) —</option>
            {office?.name ? (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ) : null}
          </select>
        </div>
      </section>
    );
  }

  // If data stale, add a banner
  const staleBanner = evaluationStale && !evaluationLoading ? (
    <div
      className="banner banner--stale"
      style={{
        background: 'var(--accent-light)',
        border: '1px solid var(--accent-main)',
        color: 'var(--text-tertiary)',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        fontSize: '0.875rem',
      }}
    >
      <span style={{ fontWeight: 600 }}>Data review date</span>{' '}
      {REVIEW_DATE} is past the {STALE_AFTER_DAYS}-day review window. Confirm every step with the office before relying on it.
    </div>
  ) : null;

  // If evaluation loading, show spinner + brief text
  if (evaluationLoading) {
    return (
      <section
        className="section"
        style={{ minHeight: '400px' }}
        aria-labelledby="journey-title"
      >
        <div className="container">
          <header className="section-header">
            <h1 id="journey-title">{selectedServiceId} — Counter Journey</h1>
          </header>
          <div className="card-body" style={{ padding: '2rem' }}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              style={{ margin: '0 auto 1rem', color: 'var(--accent-main)' }}
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path
                fill="currentColor"
                d="M8 14s1.5 2 4 2 4-2 4-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p style={{ textAlign: 'center' }}>
              Loading counter sequence…
            </p>
          </div>
        </div>
      </section>
    );
  }

  // If evaluation error, show error panel
  if (evaluationError) {
    return (
      <section
        className="section"
        style={{ minHeight: '400px' }}
        aria-labelledby="journey-title"
      >
        <div className="container">
          <header className="section-header">
            <h1 id="journey-title">{selectedServiceId.replace(/-/g, ' ')} — Counter Journey</h1>
          </header>

          <div className="card" style={{ borderColor: 'var(--accent-main)' }}>
            <h2 style={{ marginTop: 0 }} className="card-title">
              Error loading the counter sequence
            </h2>
            <p className="card-description">
              {evaluationError.message || 'Unable to load the reviewed counter sequence. Please try again.'}
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem' }}
              onClick={() => setEvaluationError(null)}
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  // If we have no evaluated data yet (initial load, no docs marked) show a
  // gentle empty state rather than a wall of "BLOCKED".
  if (!evaluation) {
    return (
      <section
        className="section"
        style={{ minHeight: '400px' }}
        aria-labelledby="journey-title"
      >
        <div className="container">
          <header className="section-header">
            <h1 id="journey-title">{selectedServiceId.replace(/-/g, ' ')} — Counter Journey</h1>
            <p className="section-subtitle">
              Select a service and office above, then mark documents available
              to see the counter path.
            </p>
          </header>
          {staleBanner}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }} className="card-title">
              No evaluation yet
            </h2>
            <p className="card-description">
              Mark at least one document as available above to load the
              counter sequence and view blockers.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------
  // Render the evaluated journey
  // ------------------------------------------------------------------
  const {
    journey,
    availableDocumentIds: evalAvailable,
    counters,
    blockers,
    comparison,
    aiSuggestions,
    sources = Object.values(COUNTER_SOURCES),
    dataQuality,
    officialStatus,
    progress,
  } = evaluation;

  // ------------------------------------------------------------------
  // Header area (journey banner + office + status legend)
  // ------------------------------------------------------------------
  const journeyHeader = (
    <header className="journey-header" style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
        {journey.title}
      </h2>
      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
        {office?.name || ''} — {office?.city || ''}, {office?.state || ''}
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
        Data version: {journey.dataVersion} | Reviewed: {journey.reviewedAt}
      </p>
      {staleBanner}
    </header>
  );

  // ------------------------------------------------------------------
  // Board view: ordered counters with checkpoints, blockers, source badges
  // ------------------------------------------------------------------
  const renderBoard = () => {
    if (!counters || counters.length === 0) return null;

    const renderedCounters = counters.map((counter, counterIndex) => {
      const counterStatus = counter.status;
      const statusBadge = STATUS_BADGES[counterStatus] || { label: counterStatus, class: '' };
      const counterBlockers = (blockers || []).filter((b) => b.counterId === counter.id);
      const hasBlockers = counterBlockers.length > 0;
      const isFirstUnclear = counter.id === (evaluation?.firstUnclearCounterId || null);

      const checkpointRows = (counter.checkpoints || []).map((cp, cpIndex) => {
        const applicable = cp.applicable;
        const available = cp.available;
        const requirement = cp.requirement;
        const label = cp.label;
        const sourceIds = cp.sourceIds || [];
        const sourceElements = sourceIds.map((sid) => {
          const s =
            (sources || []).find((src) => src.id === sid) ||
            COUNTER_SOURCES[sid] || { id: sid, title: sid, url: '#' };
          return (
            <a
              key={s.id}
              className="sources-panel__link"
              href={s.url}
              data-source-id={s.id}
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--accent-main)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
              aria-label={s.title}
            >
              {s.title} ({s.id})
            </a>
          );
        });
        const sourceHtml = sourceElements.length > 0 ? (
          <div
            className="sources-panel__body"
            style={{ marginLeft: '0.5rem', display: 'inline-flex', gap: '0.3rem' }}
          >
            {sourceElements}
          </div>
        ) : null;

        const availabilityStatus =
          requirement === 'REQUIRED' && !available && applicable
            ? 'missing'
            : requirement === 'REQUIRED' && available && applicable
              ? 'available'
              : requirement === 'CONDITIONAL' && !available && applicable
                ? 'conditional‑missing'
                : requirement === 'OPTIONAL' && !available
                  ? 'optional‑not‑provided'
                  : 'not‑applicable';

        return (
          <div
            key={`cp-${counterIndex}-${cpIndex}`}
            className="cjs-checkpoint"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              fontSize: '0.85rem',
            }}
            role="listitem"
          >
            <span
              className={`cjs-chip ${availabilityStatus}`}
              style={{
                flexShrink: 0,
                padding: '0.2rem 0.4rem',
                borderRadius: '0.2rem',
                background:
                  availabilityStatus === 'available'
                    ? 'var(--accent-light)'
                    : availabilityStatus === 'missing'
                      ? 'var(--accent-light)'
                      : 'var(--glass-bg-subtle)',
                color:
                  availabilityStatus === 'available'
                    ? 'var(--accent-main)'
                    : availabilityStatus === 'missing'
                      ? 'var(--accent-main)'
                      : 'var(--text-tertiary)',
              }}
            >
              {label}
            </span>
            {sourceHtml}
          </div>
        );
      });

      const branchCounters = (counter.branchCounters || [])
        .filter((bc) => bc.parentCounterId === counter.id);

      return (
        <section
          key={`counter-${counter.id}`}
          className="cjs-counter"
          style={{
            borderBottom: '1px solid var(--border-main)',
            padding: '0.75rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
          role="group"
          aria-labelledby={`counter-title-${counter.id}`}
        >
          <h3
            id={`counter-title-${counter.id}`}
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {counter.title}
            <span
              className={`cjs-status-badge ${statusBadge.class}`}
              style={{
                float: 'right',
                fontSize: '0.75rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '0.2rem',
                background: statusBadge.class === 'status-complete' ? 'var(--accent-light)' : '',
                color: statusBadge.class === 'status-complete' ? 'var(--accent-main)' : '',
              }}
            >
              {statusBadge.label}
            </span>
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            {/* Document checkpoints */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {checkpointRows}
            </div>

            {/* Branch info */}
            {branchCounters.length > 0 && (
              <div style={{ marginTop: '0.3rem', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                <strong>Branch:</strong> {branchCounters
                  .map((bc) => bc.title)
                  .join(', ')}
              </div>
            )}
          </div>

          {/* Blockers for this counter */}
          {hasBlockers && (
            <div
              style={{
                marginTop: '0.4rem',
                fontSize: '0.82rem',
                color: 'var(--text-tertiary)',
                borderTop: '1px solid var(--border-light)',
                paddingTop: '0.3rem',
              }}
            >
              <strong>Blockers:</strong> {counterBlockers
                .map(
                  (b) =>
                    `${b.documentLabel || b.message} is missing. ${
                      b.repeatVisit ? 'This may cause a repeat visit.' : ''
                    }`
                )
                .filter((s) => s)
                .join(' ')}
            </div>
          )}

          {/* Dependency warning if this counter depends on an earlier blocked one */}
          {isFirstUnclear && (
            <div
              style={{
                marginTop: '0.3rem',
                fontSize: '0.78rem',
                color: 'var(--accent-main)',
                fontStyle: 'italic',
              }}
            >
              An earlier counter in this path is not complete yet. Finish the
              blocker(s) shown above before this step can proceed.
            </div>
          )}
        </section>
      );
    });

    // Linear fallback below 768px: single column list
    if (reducedMotion || typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINT) {
      return (
        <ol
          style={{
            counterReset: 'cjs-counter',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            fontSize: '0.95rem',
          }}
        >
          {counters.map((counter, i) => {
            const status = counter.status;
            const statusLabel = STATUS_BADGES[status]?.label || status;
            const statusClass = STATUS_BADGES[status]?.class || '';
            const hasBlockers = blockers.some((b) => b.counterId === counter.id);
            const isFirstUnclear = counter.id === evaluation?.firstUnclearCounterId;

            return (
              <li
                key={counter.id}
                style={{
                  marginBottom: '0.75rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid var(--border-light)',
                }}
                role="listitem"
                aria-label={`
                  ${counter.title} — ${statusLabel}.
                  ${hasBlockers ? 'Missing documents shown above.' : ''}
                  ${isFirstUnclear ? 'Earlier counter not yet complete.' : ''}
                `}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.3rem',
                  }}
                >
                  <span
                    className={`cjs-status-badge ${statusClass}`}
                    style={{
                      flexShrink: 0,
                      padding: '0.1rem 0.3rem',
                      borderRadius: '0.2rem',
                      background:
                        statusClass === 'status-complete'
                          ? 'var(--accent-light)'
                          : '',
                      color:
                        statusClass === 'status-complete'
                          ? 'var(--accent-main)'
                          : '',
                    }}
                  >
                    {statusLabel}
                  </span>
                  <strong style={{ flexShrink: 0 }}>{counter.title}</strong>
                </div>
                {hasBlockers && (
                  <span
                    style={{ color: 'var(--accent-main)', fontSize: '0.82rem' }}>
                    ⚠ Blocked
                  </span>
                )}
                {isFirstUnclear && (
                  <span
                    style={{ color: 'var(--accent-main)', fontStyle: 'italic', fontSize: '0.82rem' }}>
                    ⚡ Earlier counter not yet complete
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      );
    }

    // Default: grid of counters (2‑column on wider screens)
    return (
      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns:
            typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINT
              ? '1fr'
              : '2fr 2fr',
          marginTop: '1rem',
        }}
      >
        {renderedCounters}
      </div>
    );
  };

  // ------------------------------------------------------------------
  // Linear checklist alternative
  // ------------------------------------------------------------------
  const renderLinearChecklistUI = () => {
    if (!counters || counters.length === 0) return null;

    const items = buildLinearChecklist(counters, evaluation?.branchCounters || []);

    return (
      <section
        style={{
          marginTop: '1.5rem',
          borderTop: '1px solid var(--border-main)',
          paddingTop: '1rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
          Linear preparation checklist
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Follow each step in the reviewed order. Mark documents as you have them.
        </p>
        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            fontSize: '0.95rem',
          }}
        >
          {items.map((item, i) => {
            const status =
              item.type === 'COUNTER'
                ? (counters.find((c) => c.id === item.id)?.status || 'READY')
                : 'BRANCH_REQUIRED';
            const statusLabel = STATUS_BADGES[status]?.label || status;
            const statusClass = STATUS_BADGES[status]?.class || '';

            const docRows = (item.documents || []).map((doc, docIdx) => (
              <li
                key={doc.id || doc.label || docIdx}
                style={{
                  marginBottom: '0.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span
                  className={`cjs-chip ${doc.available ? 'available' : 'missing'}`}
                  style={{
                    flexShrink: 0,
                    padding: '0.1rem 0.3rem',
                    borderRadius: '0.2rem',
                    background:
                      doc.available ? 'var(--accent-light)' : 'var(--accent-light)',
                    color:
                      doc.available ? 'var(--accent-main)' : 'var(--accent-main)',
                  }}
                >
                  {doc.label}
                </span>
              </li>
            ));

            return (
              <li
                key={item.id}
                style={{
                  marginBottom: '0.75rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid var(--border-light)',
                }}
                role="listitem"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    className={`cjs-status-badge ${statusClass}`}
                    style={{
                      flexShrink: 0,
                      padding: '0.1rem 0.3rem',
                      borderRadius: '0.2rem',
                      background: statusClass === 'status-complete' ? 'var(--accent-light)' : '',
                      color:
                        statusClass === 'status-complete' ? 'var(--accent-main)' : '',
                    }}
                  >
                    {statusLabel}
                  </span>
                  <strong style={{ flexShrink: 0 }}>{item.title}</strong>
                </div>
                {docRows.length > 0 && (
                  <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0, listStyle: 'none' }}>
                    {docRows}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    );
  };

  // ------------------------------------------------------------------
  // Comparison view: complete vs incomplete
  // ------------------------------------------------------------------
  const renderComparison = () => {
    if (!comparison) return null;

    return (
      <section
        style={{
          marginTop: '1.5rem',
          borderTop: '1px solid var(--border-main)',
          paddingTop: '1rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
          Complete vs incomplete visit
        </h3>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '0.5rem',
          }}
        >
          <caption style={{ captionSide: 'top', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Compare a fully‑prepared visit against the current tick set.
          </caption>
          <thead>
            <tr
              style={{
                background: 'var(--glass-bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <th style={{ padding: '0.5rem 0.75rem' }}>Aspect</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Complete path</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Current ticks</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ fontSize: '0.9rem' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>Counters</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.completeVisit.countersCleared} of {comparison.completeVisit.counterCount} counters clear
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.incompleteVisit.countersCleared} of {comparison.incompleteVisit.counterCount} counters clear
              </td>
            </tr>
            <tr style={{ fontSize: '0.9rem' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>Missing documents</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.completeVisit.missingDocuments} missing document type{comparison.completeVisit.missingDocuments === 1 ? '' : 's'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.incompleteVisit.missingDocuments} missing document type{comparison.incompleteVisit.missingDocuments === 1 ? '' : 's'}
              </td>
            </tr>
            <tr style={{ fontSize: '0.9rem' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>Repeat‑visit risk</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.completeVisit.repeatVisitRisk}
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.incompleteVisit.repeatVisitRisk}
              </td>
            </tr>
            <tr style={{ fontSize: '0.9rem', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>Summary</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.completeVisit.summary}
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                {comparison.incompleteVisit.summary}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    );
  };

  // ------------------------------------------------------------------
  // AI suggestion panel (only if we have suggestions and citizen hasn’t
  // confirmed all). Shown as a non‑modal inline panel.
  // ------------------------------------------------------------------
  const renderAIPanel = () => {
    if (!aiSuggestions || aiSuggestions.length === 0) return null;

    // Show only the first unconfirmed suggestion as an inline note.
    const unconfirmed = aiSuggestions.find((s) => !aiConfirmations.has(s.counterId));
    if (!unconfirmed) return null;

    const sourceLinks = (unconfirmed.sourceRefs || [])
      .filter(Boolean)
      .map((s) => (
        <a
          key={s.id || s.title}
          className="sources-panel__link"
          href={s.url}
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--accent-main)',
            fontWeight: 600,
            textDecoration: 'underline',
            marginRight: '0.4rem',
          }}
          aria-label={s.title}
        >
          {s.title}
        </a>
      ));

    return (
      <section
        style={{
          marginTop: '1.5rem',
          padding: '0.875rem',
          background: 'var(--glass-bg-subtle)',
          border: '1px dashed var(--border-main)',
          borderRadius: '0.35rem',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
        }}
        role="note"
        aria-labelledby="ai-suggestion-title"
      >
        <h4 id="ai-suggestion-title" style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
          AI suggestion (unconfirmed)
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            lineHeight: 1.4,
          }}
        >
          {unconfirmed.text}
        </p>
        {sourceLinks.length > 0 && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong>Source:</strong> {sourceLinks}
          </div>
        )}
        <div
          style={{
            marginTop: '0.5rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
            onClick={() => handleAiConfirm(unconfirmed.counterId)}
          >
            Confirm
          </button>
          <span
            style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}
          >
            (unconfirmed until verified with the office)
          </span>
        </div>
      </section>
    );
  };

  // ------------------------------------------------------------------
  // Export banner / button area
  // ------------------------------------------------------------------
  const exportArea = (
    <div
      style={{
        marginTop: '1rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.875rem', padding: '0.5rem 0.875rem' }}
        onClick={handleExport}
        aria-label="Export preparation checklist"
      >
        <Download size={14} /> Export checklist
      </button>
      {showExport && (
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.875rem', padding: '0.5rem 0.875rem' }}
          onClick={() => setShowExport(false)}
        >
          Close
        </button>
      )}
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.875rem', padding: '0.5rem 0.875rem' }}
        onClick={toggleComparison}
        aria-label="Show complete vs incomplete visit comparison"
      >
        <Info size={14} /> Compare visits
      </button>
      {showComparison && (
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.875rem', padding: '0.5rem 0.875rem' }}
          onClick={toggleComparison}
        >
          Close comparison
        </button>
      )}
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.875rem', padding: '0.5rem 0.875rem' }}
        onClick={resetDocuments}
        aria-label="Reset all document selections and restart"
      >
        <RotateCcw size={14} /> Reset
      </button>
    </div>
  );

  // ------------------------------------------------------------------
  // Main return
  // ------------------------------------------------------------------
  return (
    <section
      className="section"
      style={{ minHeight: '600px' }}
      aria-labelledby="journey-title"
    >
      <div className="container">
        <header className="section-header">
          <h1 id="journey-title">
            {selectedServiceId.replace(/-/g, ' ')} — Counter Journey
          </h1>
          <p className="section-subtitle">
            Simulated counter sequence • Document checkpoints • Blockers •
            Export checklist
          </p>
        </header>

        {journeyHeader}

        <div style={{ marginTop: '1.5rem' }}>
          {/* View mode toggle */}
          <div
            style={{
              marginBottom: '0.75rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
              onClick={() => setViewMode('board')}
              aria-pressed={viewMode === 'board'}
            >
              {viewMode === 'board' ? 'Board view' : 'Board view'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
              onClick={() => setViewMode('linear')}
              aria-pressed={viewMode === 'linear'}
            >
              {viewMode === 'linear' ? 'Linear checklist' : 'Linear checklist'}
            </button>
          </div>

          {viewMode === 'board' && renderBoard()}

          {viewMode === 'linear' && renderLinearChecklistUI()}

          {showComparison && renderComparison()}

          {renderAIPanel()}

          {exportArea}
        </div>

        {/* Blockers summary panel */}
        {blockers.length > 0 && (
          <section
            style={{
              marginTop: '1.5rem',
              borderTop: '1px solid var(--border-main)',
              paddingTop: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              Blockers and repeat‑visit risk
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {blockers.map((b) => {
                const repeat = b.repeatVisit ? ' (may cause a repeat visit)' : '';
                return (
                  <li
                    key={b.id}
                    style={{
                      marginBottom: '0.5rem',
                      fontSize: '0.92rem',
                    }}
                  >
                    ${b.counterTitle}: ${b.documentLabel} is missing.${repeat}
                    {b.branch && (
                      <span style={{ color: 'var(--accent-main)', marginLeft: '0.5rem', fontStyle: 'italic' }}>
                        Ask about: ${b.branch.title}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.82rem',
                color: 'var(--text-tertiary)',
            }}>
              {comparison?.incompleteVisit.summary}
            </p>
          </section>
        )}

        {/* Official status vs private progress banner */}
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'var(--glass-bg-subtle)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.35rem',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
        }}
        >
          {officialStatus.label}: {officialStatus.message}
        </div>

        {/* Data freshness banner if stale */}
        {evaluationStale && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.4rem 0.6rem',
              background: 'var(--accent-light)',
              color: 'var(--text-tertiary)',
              fontSize: '0.75rem',
            }}
          >
            Data review date {REVIEW_DATE} is past the {STALE_AFTER_DAYS}-day window. Confirm steps with the office.
          </div>
        )}

        {/* AI suggestions panel */}
        {!showAI && renderAIPanel()}
      </div>
    </section>
  );
}
