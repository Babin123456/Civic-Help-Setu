/**
 * src/pages/CatalogueVisualQaWorkspace.jsx
 * Civic service catalogue visual QA workspace (#841).
 *
 * A reviewer-only workspace for responsive service-card layout checks. It renders
 * the production ServiceCard against deterministic SYNTHETIC fixtures at named
 * desktop/tablet/mobile viewports. It never reads or writes production catalogue
 * records and it is not an official government application status.
 *
 * Review progress is private to the reviewer and is stored in this browser only.
 * A saved draft restores confirmed non-sensitive filter and suggestion decisions
 * after a cancel/return, and the reader can discard it at any time.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  LayoutGrid,
  Monitor,
  Save,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNetwork } from '../context/NetworkContext';

import {
  DEFAULT_FILTERS,
  LANGUAGES,
  VIEWPORTS,
  buildDraft,
  buildReviewSnapshot,
  buildVisualQaQuery,
  clearBaseline as clearStoredBaseline,
  clearDraft,
  compareSnapshots,
  flattenScanRows,
  loadBaseline,
  loadDraft,
  parseVisualQaQuery,
  requestServerScan,
  requestSuggestionDecision,
  runVisualQaScan,
  saveBaseline,
  saveDraft,
  VisualQaApiError,
} from '../services/catalogueVisualQaService';
import { SERVICE_CATEGORIES } from '../data/serviceCategories';

import CatalogueCardPreview from '../components/visualQa/CatalogueCardPreview';
import VisualQaControls from '../components/visualQa/VisualQaControls';
import VisualQaSummary from '../components/visualQa/VisualQaSummary';
import VisualQaResultsTable from '../components/visualQa/VisualQaResultsTable';
import SuggestionReviewPanel from '../components/visualQa/SuggestionReviewPanel';
import {
  VisualQaEmptyState,
  VisualQaErrorState,
  VisualQaLoadingState,
  VisualQaSkeleton,
  VisualQaOfflineNotice,
  VisualQaPermissionDenied,
  VisualQaResumedNotice,
  VisualQaServerVerified,
  VisualQaStaleNotice,
} from '../components/visualQa/VisualQaStates';
import '../components/visualQa/visualQa.css';

const CATEGORIES = ['All', ...SERVICE_CATEGORIES];
const VIEWPORT_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };
const EXPLICIT_QUERY_KEYS = [
  'category',
  'cat',
  'language',
  'lang',
  'contentLength',
  'length',
  'seed',
  'page',
  'pageSize',
  'viewport',
  'view',
  'boxes',
];
const STALE_DRAFT_MS = 24 * 60 * 60 * 1000;

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const initialFiltersFromQuery = (params) => {
  const parsed = parseVisualQaQuery(params, { categories: SERVICE_CATEGORIES });
  return {
    ...DEFAULT_FILTERS,
    ...parsed,
    viewportIds: parsed.viewportIds?.length ? parsed.viewportIds : VIEWPORTS.map((viewport) => viewport.id),
  };
};

const buildQueryParams = (filters) => {
  const params = buildVisualQaQuery(filters);
  if (!filters.showBoxes) params.set('boxes', '0');
  return params;
};

const downloadJson = (filename, value) => {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

export default function CatalogueVisualQaWorkspace() {
  const { user, loading: authLoading, getSessionToken, isClerkConfigured } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAuthorized = user?.role === 'admin';
  const storage = getStorage();
  const [mounted] = useState(isAuthorized);
  const [filters, setFilters] = useState(() => initialFiltersFromQuery(searchParams));
  const [decisions, setDecisions] = useState({});
  const [draftConsent, setDraftConsent] = useState(true);
  const [resumedAt, setResumedAt] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [baseline, setBaseline] = useState(() => storage ? loadBaseline(storage) : null);
  const [isScanning, setIsScanning] = useState(false);
  const [serverStatus, setServerStatus] = useState('idle');
  const [serverError, setServerError] = useState(null);
  const [verification, setVerification] = useState(null);
  const [lastExport, setLastExport] = useState(null);
  const [decisionReceipt, setDecisionReceipt] = useState(null);
  const [now] = useState(() => Date.now());
  const scanTimer = useRef(null);

  const { report, scanError } = useMemo(() => {
    try {
      return {
        report: runVisualQaScan({ ...filters, decisions }),
        scanError: null,
      };
    } catch (error) {
      return { report: null, scanError: error };
    }
  }, [filters, decisions]);

  const rows = useMemo(() => (report ? flattenScanRows(report) : []), [report]);
  const reviewerRole = user?.role || 'admin';
  const currentSnapshot = useMemo(() => {
    if (!report) return null;
    try {
      return buildReviewSnapshot(report, {
        decisions,
        reviewerRole,
      });
    } catch {
      return null;
    }
  }, [report, decisions, reviewerRole]);

  const comparison = useMemo(() => {
    if (!baseline || !currentSnapshot) return null;
    return compareSnapshots(baseline, currentSnapshot);
  }, [baseline, currentSnapshot]);

  const baselineStale = baseline
    ? now - Date.parse(baseline.exportedAt || '') > STALE_DRAFT_MS * 7
    : false;
  const draftStale = resumedAt ? now - resumedAt > STALE_DRAFT_MS : false;

  // Resume a saved private review only when the URL does not already ask for a
  // different scan. A deep link always wins over the browser draft.
  useEffect(() => {
    if (!isAuthorized) {
      return;
    }
    const hasExplicitQuery = EXPLICIT_QUERY_KEYS.some((key) => searchParams.has(key));
    if (!hasExplicitQuery) {
      const draft = loadDraft(storage);
      if (draft) {
        // Defer state updates to avoid synchronous setState in effect body
        window.setTimeout(() => {
          setFilters({
            ...DEFAULT_FILTERS,
            ...draft.filters,
            viewportIds: draft.viewportIds,
            showBoxes: draft.showBoxes,
          });
          setDecisions(draft.decisions || {});
          setResumedAt(draft.savedAt);
          setSavedAt(draft.savedAt);
        }, 0);
      }
    }
    // Intentionally run once: the query string at mount is the deep-link intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // Persist confirmed, non-sensitive inputs and decisions in this browser only.
  useEffect(() => {
    if (!isAuthorized || !mounted || !draftConsent) return;
    const draft = buildDraft({
      filters,
      viewportIds: filters.viewportIds,
      showBoxes: filters.showBoxes,
      decisions,
      scanRunId: report?.scanRunId || null,
    });
    const result = saveDraft(storage, draft);
    if (result.ok) {
      // Defer state update to avoid synchronous setState in effect body
      window.setTimeout(() => setSavedAt(draft.savedAt), 0);
    }
    // The storage object is intentionally read once per render; it is not state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, mounted, draftConsent, filters, decisions, report?.scanRunId]);

  useEffect(() => {
    if (!mounted || !isAuthorized) return;
    setSearchParams(buildQueryParams(filters), { replace: true });
  }, [filters, mounted, isAuthorized, setSearchParams]);

  useEffect(
    () => () => {
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
    },
    []
  );

  const handleChange = (patch) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    setServerStatus('idle');
    setVerification(null);
    setServerError(null);
  };

  const handleSaveAndReturn = () => {
    const draft = buildDraft({
      filters,
      viewportIds: filters.viewportIds,
      showBoxes: filters.showBoxes,
      decisions,
      scanRunId: report?.scanRunId || null,
    });
    const result = saveDraft(storage, draft);
    if (!result.ok) {
      toast.error(`The private draft could not be saved (${result.reason}).`);
      return;
    }
    toast.success('Private review draft saved in this browser.');
    navigate('/admin');
  };

  const handleCancelAndReturn = () => {
    // Confirmed non-sensitive inputs are already written by the draft effect, so
    // leaving without an explicit save never loses them. With consent off, the
    // reviewer explicitly opted out of local persistence.
    toast.info(
      draftConsent
        ? 'Returned to Admin. Confirmed non-sensitive inputs remain in this browser; open the workspace again to resume.'
        : 'Returned to Admin. Local draft saving is off, so nothing was stored.'
    );
    navigate('/admin');
  };

  const handleReset = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      viewportIds: VIEWPORTS.map((viewport) => viewport.id),
      showBoxes: true,
    });
    setResumedAt(null);
    setIsScanning(false);
    setSearchParams(new URLSearchParams(), { replace: true });
    toast.info('Filters reset to the deterministic defaults.');
  };

  const handleRunLocalScan = () => {
    setIsScanning(true);
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    const finish = () => {
      setIsScanning(false);
      toast.success('Deterministic local scan completed. No production catalogue data was read.');
    };
    if (typeof window === 'undefined') {
      finish();
      return;
    }
    scanTimer.current = window.setTimeout(finish, 320);
  };

  const handleDraftConsent = (enabled) => {
    setDraftConsent(enabled);
    if (!enabled) {
      clearDraft(storage);
      setResumedAt(null);
      setSavedAt(null);
      toast.info('Local draft saving is off and the saved private draft was deleted.');
    } else {
      toast.info('Confirmed non-sensitive inputs will be kept in this browser so you can resume.');
    }
  };

  const handleDiscardDraft = () => {
    clearDraft(storage);
    setDecisions({});
    setResumedAt(null);
    setSavedAt(null);
    setFilters({
      ...DEFAULT_FILTERS,
      viewportIds: VIEWPORTS.map((viewport) => viewport.id),
      showBoxes: true,
    });
    toast.info('Saved private review draft discarded.');
  };

  const buildAuthHeaders = async () => {
    const headers = {};
    if (typeof getSessionToken === 'function') {
      try {
        const token = await getSessionToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // Fall through to the development-only synthetic reviewer headers.
      }
    }
    if (!headers.Authorization && !isClerkConfigured && user?.role === 'admin') {
      // Local development and automated tests only. The API refuses these headers
      // whenever a Clerk secret is configured or the deployment is production.
      headers['x-user-role'] = 'admin';
      headers['x-user-id'] = 'synthetic-reviewer';
    }
    return headers;
  };

  const handleRunServerScan = async () => {
    if (!report) return;
    if (!isOnline) {
      setServerStatus('offline');
      toast.warning('You are offline. The local deterministic scan is still available.');
      return;
    }
    setServerStatus('loading');
    setServerError(null);
    try {
      const headers = await buildAuthHeaders();
      const data = await requestServerScan(filters, { headers });
      const matchesLocal =
        data?.scanRunId === report.scanRunId &&
        JSON.stringify(data?.totals) === JSON.stringify(report.totals);
      setVerification({
        status: 'ready',
        matchesLocal,
        dataVersion: data?.dataVersion || report.dataVersion,
        componentVersion: data?.componentVersion || report.componentVersion,
        verifiedAt: new Date().toISOString(),
        multiRegion: data?._multiRegion || null,
      });
      setServerStatus('ready');
      toast.success(
        matchesLocal
          ? 'Server scan matches the local deterministic scan.'
          : 'Server scan returned different totals. Treat the difference as a review item.'
      );
    } catch (error) {
      const normalised =
        error instanceof VisualQaApiError
          ? error
          : new VisualQaApiError('ERR_VISUAL_QA_API', error?.message || 'The server scan failed.');
      setServerError(normalised);
      if (normalised.status === 401 || normalised.status === 403) {
        setServerStatus('permission-denied');
        setVerification({ status: 'permission-denied', matchesLocal: false });
      } else {
        setServerStatus('error');
      }
      toast.error(normalised.message);
    }
  };

  const handleExport = () => {
    if (!report || !currentSnapshot) {
      toast.error('There is no valid synthetic scan to export.');
      return;
    }
    const filename = `civic-catalogue-visual-qa-${report.scanRunId}.json`;
    if (!downloadJson(filename, currentSnapshot)) {
      toast.error('This browser could not start the snapshot download.');
      return;
    }
    setLastExport({
      snapshotId: currentSnapshot.snapshotId,
      checksum: currentSnapshot.checksum,
      at: new Date().toISOString(),
    });
    toast.success('Review snapshot downloaded. It contains synthetic fixtures only.');
  };

  const handleSaveBaseline = () => {
    if (!currentSnapshot) {
      toast.error('There is no valid synthetic scan to save as a baseline.');
      return;
    }
    const result = saveBaseline(storage, currentSnapshot);
    if (!result.ok) {
      toast.error(`The baseline could not be saved (${result.reason}).`);
      return;
    }
    setBaseline(currentSnapshot);
    toast.success('Current deterministic snapshot saved as the comparison baseline.');
  };

  const handleClearBaseline = () => {
    clearStoredBaseline(storage);
    setBaseline(null);
    toast.info('Saved screenshot baseline removed from this browser.');
  };

  const handleDecision = async (suggestionId, decision, fixtureId) => {
    setDecisions((previous) => ({ ...previous, [suggestionId]: decision }));
    setServerStatus('idle');
    setVerification(null);
    setServerError(null);
    toast.success(
      decision === 'confirmed'
        ? 'Synthetic fixture text confirmed for this private review draft.'
        : 'Synthetic fixture text rejected for this private review draft.'
    );
    if (!isOnline || !fixtureId) return;
    try {
      const headers = await buildAuthHeaders();
      const receipt = await requestSuggestionDecision(
        { fixtureId, suggestionId, decision },
        { headers }
      );
      setDecisionReceipt(receipt?.audit || null);
    } catch (error) {
      toast.warning(
        `The decision is saved in this browser, but the server receipt was unavailable: ${
          error?.message || 'unknown error'
        }`
      );
    }
  };

  if (authLoading) {
    return (
      <div className="section qa-workspace">
        <div className="container qa-container">
          <VisualQaLoadingState label="Checking reviewer permission and restoring the local draft…" />
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="section qa-workspace">
        <div className="container qa-container">
          <VisualQaPermissionDenied signedIn={Boolean(user)} />
        </div>
      </div>
    );
  }

  const visibleCards = report?.viewports?.[0]?.cards || [];
  const hasEmptyPage = Boolean(report?.pagination.empty);

  return (
    <div className="section qa-workspace">
      <div className="container qa-container">
        <header className="qa-hero">
          <div>
            <span className="qa-eyebrow">
              <ScanSearch size={16} aria-hidden="true" /> Reviewer workspace · Issue #841
            </span>
            <h1>Civic service catalogue visual QA</h1>
            <p>
              Render the production service card against synthetic long-title, multilingual and missing-metadata
              fixtures at named desktop, tablet and mobile viewports. Inspect overflow, compare a saved screenshot
              baseline and export a private review snapshot.
            </p>
            <div className="qa-hero-badges">
              <span className="qa-badge qa-badge--synthetic">
                <ShieldCheck size={14} aria-hidden="true" /> Synthetic fixtures only
              </span>
              <span className="qa-badge qa-badge--private">
                <Info size={14} aria-hidden="true" /> Private review progress, not official status
              </span>
            </div>
          </div>
          <div className="qa-hero-actions">
            <button type="button" className="qa-button" onClick={handleSaveAndReturn}>
              <Save size={15} aria-hidden="true" /> Save draft &amp; return
            </button>
            <button
              type="button"
              className="qa-button qa-button--ghost"
              onClick={handleCancelAndReturn}
              title="Leaves the workspace. Confirmed non-sensitive inputs stay in the private local draft when consent is on."
            >
              Cancel &amp; return
            </button>
            <Link className="qa-button qa-button--primary" to="/services">
              Official service catalogue <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="qa-boundary-note" role="note">
          <strong>Not an official government application status.</strong> This workspace does not read, edit or
          publish the production catalogue. Findings are deterministic review suggestions until a reviewer confirms
          them. An AI-free local generator produces the synthetic fixture text and labels it as a suggestion.
        </div>

        {(!isOnline || serverStatus === 'offline') && <VisualQaOfflineNotice />}

        {resumedAt && (
          <VisualQaResumedNotice savedAt={resumedAt} onDiscard={handleDiscardDraft} />
        )}

        {draftStale && (
          <VisualQaStaleNotice
            savedAt={resumedAt}
            onRefresh={handleRunLocalScan}
            label="Saved review draft"
          />
        )}

        {baselineStale && baseline && (
          <VisualQaStaleNotice
            savedAt={baseline.exportedAt}
            onRefresh={handleClearBaseline}
            label="Screenshot baseline"
          />
        )}

        <VisualQaControls
          filters={filters}
          categories={CATEGORIES}
          languages={LANGUAGES}
          onChange={handleChange}
          onReset={handleReset}
          onRunServerScan={handleRunServerScan}
          onExport={handleExport}
          onSaveBaseline={handleSaveBaseline}
          serverStatus={serverStatus}
          exportDisabled={!report}
          baselineDisabled={!currentSnapshot}
        />

        <div className="qa-controls-footer-note">
          <label className="qa-consent">
            <input
              type="checkbox"
              checked={draftConsent}
              onChange={(event) => handleDraftConsent(event.target.checked)}
            />
            <span>
              Keep confirmed non-sensitive inputs in this browser for up to 7 days so I can resume. No citizen data
              is stored.
            </span>
          </label>
          <span>
            Private draft saved {savedAt ? 'in this browser' : 'when you change a control'} · Scan run{' '}
            <code>{report?.scanRunId || 'unavailable'}</code>
          </span>
          <button type="button" className="qa-link-button" onClick={handleDiscardDraft}>
            Delete local draft and decisions
          </button>
        </div>

        {isScanning && <VisualQaLoadingState />}

        {serverStatus === 'permission-denied' && (
          <VisualQaServerVerified verification={verification} />
        )}

        {serverStatus === 'error' && serverError && (
          <VisualQaErrorState error={serverError} onRetry={handleRunServerScan} />
        )}

        {verification?.status === 'ready' && <VisualQaServerVerified verification={verification} />}

        {decisionReceipt && (
          <div className="qa-receipt" role="status">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Server audit receipt <code>{decisionReceipt.receipt}</code> for{' '}
              {decisionReceipt.action.toLowerCase().replaceAll('_', ' ')}. The reviewer note and identity are not
              stored in the exported snapshot.
            </span>
          </div>
        )}

        {scanError ? (
          <VisualQaErrorState error={scanError} onRetry={handleReset} />
        ) : report ? (
          <>
            <VisualQaSummary report={report} comparison={comparison} />

            <div className="qa-baseline-bar">
              <div>
                <strong>Screenshot baseline:</strong>{' '}
                {baseline
                  ? `saved ${baseline.exportedAt ? new Date(baseline.exportedAt).toLocaleString('en-IN') : 'earlier'} with checksum ${baseline.checksum}.`
                  : 'none saved in this browser yet.'}
              </div>
              {baseline && (
                <button type="button" className="qa-button" onClick={handleClearBaseline}>
                  Clear baseline
                </button>
              )}
              {lastExport && (
                <span className="qa-export-note">
                  Last export <code>{lastExport.snapshotId}</code>
                </span>
              )}
            </div>

            <section className="qa-lanes" aria-labelledby="qa-lanes-heading">
              <div className="qa-section-heading">
                <div>
                  <h2 id="qa-lanes-heading">
                    <LayoutGrid size={18} aria-hidden="true" /> Responsive card previews
                  </h2>
                  <p>
                    Bounding boxes and overflow markers are decorative; every finding is repeated in the text lists
                    below and in the accessible results table. The same filters always produce the same measurements.
                  </p>
                </div>
                <span className="qa-row-count">
                  {filters.viewportIds.length} viewport{filters.viewportIds.length === 1 ? '' : 's'} ·{' '}
                  {filters.contentLength}
                </span>
              </div>

              {isScanning ? (
                <VisualQaSkeleton cards={Math.min(3, filters.viewportIds.length * 2)} />
              ) : hasEmptyPage ? (
                <VisualQaEmptyState
                  onReset={() => handleChange({ page: 1 })}
                  page={report.pagination.page}
                  totalPages={report.pagination.totalPages}
                />
              ) : (
                report.viewports.map((viewport) => {
                  const Icon = VIEWPORT_ICONS[viewport.id] || Monitor;
                  return (
                    <section
                      key={viewport.id}
                      className={`qa-lane qa-lane--${viewport.id}`}
                      aria-labelledby={`qa-lane-${viewport.id}`}
                    >
                      <div className="qa-lane-heading">
                        <h3 id={`qa-lane-${viewport.id}`}>
                          <Icon size={18} aria-hidden="true" /> {viewport.label}{' '}
                          <small>
                            {viewport.width}px · {viewport.columns} column
                            {viewport.columns === 1 ? '' : 's'} · {viewport.cardWidth}px card
                          </small>
                        </h3>
                        <span>
                          {viewport.cards.length} fixture{viewport.cards.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className={`qa-card-grid qa-card-grid--${viewport.id}`}>
                        {viewport.cards.map((card) => (
                          <CatalogueCardPreview
                            key={card.fixtureId}
                            card={card}
                            viewport={viewport}
                            showBoxes={filters.showBoxes}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </section>

            <nav className="qa-pagination" aria-label="Visual QA result pages">
              <button
                type="button"
                className="qa-button"
                onClick={() =>
                  handleChange({
                    page: report.pagination.empty
                      ? report.pagination.totalPages
                      : Math.max(1, report.pagination.page - 1),
                  })
                }
                disabled={!report.pagination.hasPrevious}
              >
                <ChevronLeft size={15} aria-hidden="true" /> Previous
              </button>
              <span>
                {report.pagination.empty ? (
                  <>
                    Page <strong>{report.pagination.page}</strong> is outside 1–
                    <strong>{report.pagination.totalPages}</strong>
                  </>
                ) : (
                  <>
                    Page <strong>{report.pagination.page}</strong> of{' '}
                    <strong>{report.pagination.totalPages}</strong>
                  </>
                )}{' '}
                · {report.pagination.total} synthetic fixtures
              </span>
              <button
                type="button"
                className="qa-button"
                onClick={() => handleChange({ page: Math.min(report.pagination.totalPages, report.pagination.page + 1) })}
                disabled={!report.pagination.hasNext}
              >
                Next <ChevronRight size={15} aria-hidden="true" />
              </button>
            </nav>

            {!hasEmptyPage && (
              <SuggestionReviewPanel
                cards={visibleCards}
                decisions={decisions}
                onDecide={handleDecision}
              />
            )}

            <VisualQaResultsTable
              rows={rows}
              caption={`${rows.length} synthetic fixture / viewport rows at page ${report.pagination.page}. This table is the keyboard-accessible alternative to the visual markers and never depends on hover.`}
            />

            <footer className="qa-workspace-footer">
              <p>
                <Save size={15} aria-hidden="true" /> Export is a browser download only. The snapshot includes the
                scan run, viewport, component and data versions, issue codes, sources and a deterministic checksum.
                It excludes reviewer identity, reviewer notes and all citizen data.
              </p>
              <p>
                <Download size={15} aria-hidden="true" /> Need an official application status? Use the{' '}
                <Link to="/services">service catalogue</Link> and the linked government source. Private review
                progress here never changes an application, approval or entitlement.
              </p>
              <p>
                Data version <code>{report.dataVersion}</code> · Component version{' '}
                <code>{report.componentVersion}</code> · Generator <code>{report.fixtureGeneratorVersion}</code>
              </p>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}
