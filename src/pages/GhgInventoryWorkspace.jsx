import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  History,
  Leaf,
  ListChecks,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';
import GhgInventoryHeader from '../components/ghgInventory/GhgInventoryHeader';
import GhgInventoryDashboard from '../components/ghgInventory/GhgInventoryDashboard';
import GhgSubmissionForm from '../components/ghgInventory/GhgSubmissionForm';
import GhgSubmissionReview from '../components/ghgInventory/GhgSubmissionReview';
import GhgPeriodComparison from '../components/ghgInventory/GhgPeriodComparison';
import GhgMethodologyPanel from '../components/ghgInventory/GhgMethodologyPanel';
import GhgRecommendationsPanel from '../components/ghgInventory/GhgRecommendationsPanel';
import GhgPublicView from '../components/ghgInventory/GhgPublicView';
import GhgAuditPanel from '../components/ghgInventory/GhgAuditPanel';
import {
  GhgErrorState,
  GhgInventorySkeleton,
  GhgOfflineBanner,
  GhgPermissionDenied,
  GhgStaleNotice,
} from '../components/ghgInventory/GhgInventoryStates';
import {
  GHG_ROLES,
  PERIOD_STATUS,
} from '../services/ghgInventoryConstants.js';
import {
  createSubmission,
  decideRecommendation,
  exportInventory,
  exportInventoryCsv,
  generateRecommendations,
  getInventoryMetadata,
  getInventorySummary,
  getPeriodComparison,
  getPublicInventorySummary,
  getSubmissionDetail,
  listAuditEvents,
  listCalculationRuns,
  listEmissionSources,
  listFactorCatalog,
  listJurisdictions,
  listRecommendations,
  listReportingPeriods,
  listSubmissions,
  resetInventoryToEmpty,
  reviewSubmission,
  runPeriodCalculation,
  submitSubmission,
  toUserMessage,
  updateSubmission,
} from '../services/ghgInventoryService.js';
import { PUBLIC_METHODOLOGY_NOTE } from '../services/ghgInventoryConstants.js';

const STAFF_ROLES = [GHG_ROLES.OPERATOR, GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN];
const PUBLIC_PERIOD_STATUSES = [
  PERIOD_STATUS.APPROVED,
  PERIOD_STATUS.LOCKED,
  PERIOD_STATUS.ARCHIVED,
];

const makeIdempotencyKey = (prefix) => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const downloadText = (filename, text, mimeType) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return false;
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
};

const TABS = [
  { id: 'overview', label: 'Overview', Icon: Leaf, staffOnly: true },
  { id: 'submissions', label: 'Department submissions', Icon: ClipboardList, staffOnly: true },
  { id: 'comparison', label: 'Period comparison', Icon: TrendingUp, staffOnly: true },
  { id: 'methodology', label: 'Methodology & factors', Icon: BookOpen, staffOnly: true },
  { id: 'estimates', label: 'Estimates', Icon: Calculator, staffOnly: true, reviewerOnly: true },
  { id: 'audit', label: 'Audit trail', Icon: History, staffOnly: true, reviewerOnly: true },
  { id: 'public', label: 'Public view', Icon: Users, staffOnly: false },
];

export default function GhgInventoryWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();

  const [activeRole, setActiveRole] = useState(() =>
    user?.role === 'admin' ? GHG_ROLES.ADMIN : GHG_ROLES.OPERATOR
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [publicPeriodLabel, setPublicPeriodLabel] = useState(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const isStaff = STAFF_ROLES.includes(activeRole);
  const isReviewer = [GHG_ROLES.REVIEWER, GHG_ROLES.ADMIN].includes(activeRole);
  const isAdmin = activeRole === GHG_ROLES.ADMIN;

  const actor = useMemo(
    () => ({
      id: user?.id || 'usr_ghg_demo',
      username: user?.username || user?.name || (isStaff ? 'MunicipalInventoryUser' : 'PublicVisitor'),
      role: activeRole === GHG_ROLES.ADMIN ? 'admin' : activeRole,
      ghgRole: activeRole,
      jurisdictionId: 'WARD-042',
    }),
    [user, activeRole, isStaff]
  );

  const notify = useCallback(
    (type, title, message) => {
      toast({ type, title, message });
      setAnnouncement(`${title}. ${message}`);
    },
    [toast]
  );

  const refresh = useCallback(() => {
    setRefreshTick((current) => current + 1);
    setIsRefreshing(true);
  }, []);

  useEffect(() => {
    if (!isRefreshing) return undefined;
    const timer = setTimeout(() => setIsRefreshing(false), 180);
    return () => clearTimeout(timer);
  }, [isRefreshing, refreshTick]);

  const jurisdictions = useMemo(() => listJurisdictions(), []);

  // Staff reads. Public/citizen roles never call a staff-scoped reader.
  const staffState = useMemo(() => {
    if (!isStaff || refreshTick < 0) {
      return { periods: [], period: null, summary: null, error: null, submissions: [], comparison: null, runs: [], recommendations: [], audit: null, factors: null, sources: [], metadata: null };
    }
    try {
      const periods = listReportingPeriods(actor);
      const period =
        periods.find((item) => item.id === selectedPeriodId) || periods[0] || null;
      const summary = period ? getInventorySummary(period.id, actor) : null;
      const submissions = period
        ? listSubmissions({ periodId: period.id, page: 1, pageSize: 100 }, actor).items
        : [];
      const sorted = periods.slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      const index = period ? sorted.findIndex((item) => item.id === period.id) : -1;
      const previous = index >= 0 ? sorted[index + 1] : null;
      const comparison =
        period && previous
          ? getPeriodComparison(
              { periodId: period.id, comparisonPeriodId: previous.id },
              actor
            )
          : null;
      const runs = period ? listCalculationRuns(period.id, actor) : [];
      const recommendations = isReviewer
        ? listRecommendations({ periodId: period?.id || 'all', page: 1, pageSize: 50 }, actor).items
        : [];
      const audit = isReviewer ? listAuditEvents({ page: 1, pageSize: 50 }, actor) : null;
      const sources = period
        ? listEmissionSources({ jurisdictionId: period.jurisdictionId, page: 1, pageSize: 100 }, actor)
            .items
        : [];
      const factors = listFactorCatalog(actor);
      const metadata = getInventoryMetadata();
      return { periods, period, summary, error: null, submissions, comparison, runs, recommendations, audit, factors, sources, metadata };
    } catch (error) {
      return {
        periods: [],
        period: null,
        summary: null,
        error,
        submissions: [],
        comparison: null,
        runs: [],
        recommendations: [],
        audit: null,
        factors: null,
        sources: [],
        metadata: null,
      };
    }
  }, [isStaff, isReviewer, actor, selectedPeriodId, refreshTick]);

  const selectedSubmission = useMemo(() => {
    if (!isStaff || !selectedSubmissionId || refreshTick < 0) return null;
    try {
      return getSubmissionDetail(selectedSubmissionId, actor);
    } catch {
      return null;
    }
  }, [isStaff, selectedSubmissionId, actor, refreshTick]);

  const effectiveSubmissionId =
    selectedSubmission?.id ||
    (staffState.submissions.length > 0 ? staffState.submissions[0].id : null);
  const submissionDetail = useMemo(() => {
    if (!isStaff || !effectiveSubmissionId || refreshTick < 0) return null;
    if (selectedSubmission?.id === effectiveSubmissionId) return selectedSubmission;
    try {
      return getSubmissionDetail(effectiveSubmissionId, actor);
    } catch {
      return null;
    }
  }, [isStaff, effectiveSubmissionId, selectedSubmission, actor, refreshTick]);

  // The public projection is used by every role and never exposes internal identifiers.
  const publicState = useMemo(() => {
    if (refreshTick < 0) return { data: null, error: null };
    try {
      const initial = getPublicInventorySummary({
        jurisdictionId: actor.jurisdictionId,
      });
      let data = initial;
      if (publicPeriodLabel) {
        const match = (initial.periods || []).find((item) => item.label === publicPeriodLabel);
        if (match?.id) {
          data = getPublicInventorySummary({
            periodId: match.id,
            jurisdictionId: actor.jurisdictionId,
          });
        }
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [actor.jurisdictionId, publicPeriodLabel, refreshTick]);

  const publicPeriods = publicState.data?.periods || [];
  const publicData = publicState.data;

  const jurisdictionLabel = useMemo(() => {
    const id = staffState.period?.jurisdictionId || actor.jurisdictionId;
    const found = jurisdictions.find((item) => item.id === id);
    return found ? `${found.name} · ${found.authority}` : id;
  }, [jurisdictions, staffState.period, actor.jurisdictionId]);

  const availableTabs = TABS.filter((tab) => {
    if (!isStaff && tab.staffOnly) return false;
    if (tab.reviewerOnly && !isReviewer) return false;
    return true;
  });
  const currentTab = availableTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : availableTabs[0]?.id || 'public';

  const canCreateSubmission =
    isStaff &&
    [GHG_ROLES.OPERATOR, GHG_ROLES.ADMIN].includes(activeRole) &&
    staffState.period &&
    [PERIOD_STATUS.OPEN, PERIOD_STATUS.DRAFT].includes(staffState.period.status);

  const canRunCalculation =
    isStaff &&
    Boolean(staffState.period) &&
    (staffState.summary?.lines?.length || 0) > 0;

  const canExport =
    isStaff &&
    Boolean(staffState.period) &&
    PUBLIC_PERIOD_STATUSES.includes(staffState.period.status) &&
    (staffState.summary?.lines?.length || 0) > 0;

  const canGenerateEstimates = isReviewer && Boolean(staffState.period);

  const runAction = async (label, action, successTitle, successMessage) => {
    if (busyAction) return null;
    setBusyAction(label);
    try {
      const result = await action();
      if (successMessage !== null) {
        notify(
          'success',
          successTitle,
          successMessage || (typeof result === 'string' ? result : 'The inventory has been updated.')
        );
      }
      return result;
    } catch (error) {
      notify('error', `${successTitle} failed`, toUserMessage(error));
      return null;
    } finally {
      setBusyAction(null);
      refresh();
    }
  };

  const handleSaveSubmission = async (payload) => {
    const editing = editingSubmission;
    const result = await runAction(
      'save-submission',
      () =>
        Promise.resolve(
          editing
            ? updateSubmission(editing.id, payload, actor)
            : createSubmission(
                { ...payload, idempotencyKey: payload.idempotencyKey || makeIdempotencyKey('ghg-sub') },
                actor
              )
        ),
      editing ? 'Submission updated' : 'Submission saved'
    );
    if (result) {
      setShowSubmissionForm(false);
      setEditingSubmission(null);
      if (result.id) setSelectedSubmissionId(result.id);
      setActiveTab('submissions');
    }
  };

  const handleSubmitSubmission = async (detail) => {
    const result = await runAction(
      'submit-submission',
      () => Promise.resolve(submitSubmission(detail.id, actor)),
      'Submission sent for review'
    );
    if (result?.id) setSelectedSubmissionId(result.id);
  };

  const handleReviewAction = async (action, reason) => {
    if (!submissionDetail) return;
    const result = await runAction(
      `review-${action}`,
      () => Promise.resolve(reviewSubmission(submissionDetail.id, action, { reason }, actor)),
      'Review decision recorded'
    );
    if (result?.id) setSelectedSubmissionId(result.id);
  };

  const handleRunCalculation = async () => {
    if (!staffState.period) return;
    const result = await runAction(
      'calculate',
      () =>
        Promise.resolve(
          runPeriodCalculation(
            {
              periodId: staffState.period.id,
              idempotencyKey: makeIdempotencyKey('ghg-run'),
              reason: 'Calculation requested from the inventory workspace.',
            },
            actor
          )
        ),
      'Calculation completed'
    );
    if (result?.id) setSelectedRunId(result.id);
  };

  const handleGenerateEstimates = async () => {
    if (!staffState.period) return;
    const result = await runAction(
      'estimate',
      () => Promise.resolve(generateRecommendations({ periodId: staffState.period.id }, actor)),
      'Estimates generated',
      null
    );
    if (result?.created?.length) {
      notify(
        'success',
        'Estimates awaiting review',
        `${result.created.length} labelled estimate(s) were generated. A reviewer must accept, edit or reject each one.`
      );
    } else if (result) {
      notify('success', 'Estimates generated', result.message || 'No new estimates were needed.');
    }
  };

  const handleExport = async (format) => {
    if (!staffState.period) return;
    const result = await runAction(
      'export',
      () => Promise.resolve(exportInventory(staffState.period.id, actor)),
      'Inventory export ready',
      null
    );
    if (!result) return;
    const base = `ghg-inventory-${staffState.period.label.replaceAll(/[^a-zA-Z0-9]+/g, '-')}`;
    if (format === 'csv') {
      const csv = exportInventoryCsv(result);
      if (downloadText(`${base}.csv`, csv, 'text/csv')) {
        notify('success', 'CSV download started', 'The source-linked CSV contains the same approved lines.');
      } else {
        notify('error', 'CSV export unavailable', 'This browser does not support file downloads.');
      }
    } else if (downloadText(`${base}.json`, JSON.stringify(result, null, 2), 'application/json')) {
      notify('success', 'JSON download started', 'The export includes factor versions, warnings and a content digest.');
    } else {
      notify('error', 'Export unavailable', 'This browser does not support file downloads.');
    }
  };

  const handleDecideRecommendation = async (id, action, payload) => {
    const result = await runAction(
      `recommendation-${action}`,
      () => Promise.resolve(decideRecommendation(id, action, payload, actor)),
      action === 'reject' ? 'Estimate rejected' : 'Estimate decision saved'
    );
    if (result?.message) notify('success', 'Estimate decision saved', result.message);
  };

  const handleReset = async () => {
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(
            'Reset the local inventory to an empty state? Seeded demonstration data will be removed from this browser.'
          );
    if (!confirmed) return;
    await runAction(
      'reset',
      () => Promise.resolve(resetInventoryToEmpty(actor)),
      'Inventory reset'
    );
  };

  const handleTabKeyDown = (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = availableTabs.findIndex((tab) => tab.id === currentTab);
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % availableTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + availableTabs.length) % availableTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = availableTabs.length - 1;
    setActiveTab(availableTabs[nextIndex].id);
    document.getElementById(`ghg-tab-${availableTabs[nextIndex].id}`)?.focus();
  };

  const error = staffState.error;
  const permissionDenied =
    error?.code === 'GHG_PERMISSION_DENIED' || error?.code === 'GHG_UNAUTHENTICATED';

  return (
    <div className="section" style={{ minHeight: '85vh', padding: '1.5rem 0' }}>
      <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1rem' }}>
        <span className="sr-only" aria-live="polite">{announcement}</span>

        {!isOnline && <GhgOfflineBanner />}

        <GhgInventoryHeader
          periods={staffState.periods}
          selectedPeriodId={staffState.period?.id || ''}
          onPeriodChange={(id) => {
            setSelectedPeriodId(id);
            setSelectedLine(null);
            setSelectedRunId(null);
            setShowSubmissionForm(false);
            setEditingSubmission(null);
          }}
          activeRole={activeRole}
          onRoleChange={(role) => {
            setActiveRole(role);
            setSelectedPeriodId(null);
            setSelectedSubmissionId(null);
            setSelectedLine(null);
            setShowSubmissionForm(false);
            setEditingSubmission(null);
          }}
          canCreateSubmission={canCreateSubmission}
          onCreateSubmission={() => {
            setEditingSubmission(null);
            setShowSubmissionForm(true);
          }}
          canRunCalculation={canRunCalculation}
          onRunCalculation={handleRunCalculation}
          canExport={canExport}
          onExport={() => handleExport('json')}
          onExportCsv={() => handleExport('csv')}
          canGenerateEstimates={canGenerateEstimates}
          onGenerateEstimates={handleGenerateEstimates}
          jurisdictionLabel={jurisdictionLabel}
        />

        {!isStaff && (
          <div
            role="note"
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.6rem',
              fontSize: '0.85rem',
            }}
          >
            You are viewing the public transparency projection. Internal ids, department notes,
            reviewer names and source documents are not available in this perspective.
          </div>
        )}

        {isStaff && staffState.summary?.isStale && (
          <GhgStaleNotice
            lastCalculatedAt={staffState.summary.calculation?.executedAt}
            reason={staffState.summary.staleReason}
            onRecalculate={canRunCalculation ? handleRunCalculation : null}
            canRecalculate={canRunCalculation}
          />
        )}

        {permissionDenied ? (
          <GhgPermissionDenied role={activeRole} message={error?.message} />
        ) : staffState.error ? (
          <GhgErrorState
            message={toUserMessage(staffState.error)}
            code={staffState.error.code}
            onRetry={refresh}
          />
        ) : null}

        {isStaff && !staffState.error && (
          <div role="tablist" aria-label="Greenhouse-gas inventory sections" onKeyDown={handleTabKeyDown} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', borderBottom: '2px solid var(--border-main)', marginBottom: '1.25rem' }}>
            {availableTabs.map((tab) => {
              const selected = currentTab === tab.id;
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  id={`ghg-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`ghg-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '0.6rem 0.9rem',
                    fontSize: '0.85rem',
                    fontWeight: selected ? 700 : 500,
                    color: selected ? 'var(--accent-main)' : 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    borderBottom: selected ? '2px solid var(--accent-main)' : '2px solid transparent',
                    marginBottom: '-2px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Icon size={14} aria-hidden="true" /> {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {!isStaff && (
          <div role="tablist" aria-label="Greenhouse-gas inventory sections" style={{ display: 'flex', gap: '0.35rem', borderBottom: '2px solid var(--border-main)', marginBottom: '1.25rem' }}>
            <button
              type="button"
              role="tab"
              aria-selected
              aria-controls="ghg-panel-public"
              id="ghg-tab-public"
              style={{
                padding: '0.6rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--accent-main)',
                background: 'none',
                border: 'none',
                borderBottom: '2px solid var(--accent-main)',
                marginBottom: '-2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Users size={14} aria-hidden="true" /> Public view
            </button>
          </div>
        )}

        {isRefreshing ? (
          <GhgInventorySkeleton count={3} />
        ) : (
          <div
            id={`ghg-panel-${currentTab}`}
            role="tabpanel"
            aria-labelledby={`ghg-tab-${currentTab}`}
            tabIndex={0}
            style={{ outlineOffset: 4 }}
          >
            {currentTab === 'overview' && (
              <>
                {staffState.summary ? (
                  <GhgInventoryDashboard
                    summary={staffState.summary}
                    onInspectFormula={(line) => {
                      setSelectedLine(line);
                      setActiveTab('methodology');
                    }}
                  />
                ) : (
                  <GhgPermissionDenied
                    role={activeRole}
                    message="No reporting period is in scope for this account. Ask an administrator to assign a jurisdiction and open a period."
                  />
                )}
                <p style={{ margin: '1rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {PUBLIC_METHODOLOGY_NOTE}
                </p>
              </>
            )}

            {currentTab === 'submissions' && (
              <>
                {showSubmissionForm && staffState.period && (
                  <GhgSubmissionForm
                    sources={staffState.sources}
                    factors={staffState.factors?.factors || []}
                    period={staffState.period}
                    jurisdictionId={staffState.period.jurisdictionId}
                    onSubmit={handleSaveSubmission}
                    onCancel={() => {
                      setShowSubmissionForm(false);
                      setEditingSubmission(null);
                    }}
                    initialSubmission={editingSubmission}
                  />
                )}
                <GhgSubmissionReview
                  submissions={staffState.submissions}
                  detail={submissionDetail}
                  selectedId={submissionDetail?.id || null}
                  onSelect={setSelectedSubmissionId}
                  onAction={handleReviewAction}
                  actionBusy={Boolean(busyAction)}
                  canReview={isReviewer}
                  canOperate={isStaff && [GHG_ROLES.OPERATOR, GHG_ROLES.ADMIN].includes(activeRole)}
                  onEditSubmission={(detail) => {
                    setEditingSubmission(detail);
                    setShowSubmissionForm(true);
                  }}
                  onSubmitSubmission={handleSubmitSubmission}
                />
              </>
            )}

            {currentTab === 'comparison' && (
              <GhgPeriodComparison comparison={staffState.comparison} />
            )}

            {currentTab === 'methodology' && (
              <GhgMethodologyPanel
                line={selectedLine}
                metadata={staffState.metadata}
                factorCatalog={staffState.factors}
                runs={staffState.runs}
                selectedRunId={selectedRunId}
                onSelectRun={setSelectedRunId}
              />
            )}

            {currentTab === 'estimates' && isReviewer && (
              <GhgRecommendationsPanel
                recommendations={staffState.recommendations}
                onDecide={handleDecideRecommendation}
                busy={Boolean(busyAction)}
                canDecide={isReviewer}
              />
            )}

            {currentTab === 'audit' && isReviewer && (
              <GhgAuditPanel
                events={staffState.audit?.items || []}
                total={staffState.audit?.total || 0}
              />
            )}

            {currentTab === 'public' && (
              <GhgPublicView
                publicData={publicData}
                periods={publicPeriods}
                selectedPeriodLabel={
                  publicPeriodLabel || publicData?.summary?.periodLabel || publicPeriods[0]?.label || ''
                }
                onSelectPeriod={(label) => setPublicPeriodLabel(label)}
                jurisdictionName={
                  publicData?.summary?.jurisdictionName || jurisdictionLabel
                }
              />
            )}
          </div>
        )}

        {isAdmin && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={refresh} disabled={Boolean(busyAction)} style={{ fontSize: '0.8rem' }}>
              <RefreshCw size={14} aria-hidden="true" /> Refresh inventory
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={Boolean(busyAction)} style={{ fontSize: '0.8rem' }}>
              Reset local inventory
            </button>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              <FileSpreadsheet size={12} aria-hidden="true" /> Administrator maintenance actions are
              audited. Reset removes the seeded demonstration bundle from this browser only.
            </span>
          </div>
        )}

        <div style={{ marginTop: '1rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          <ListChecks size={12} aria-hidden="true" /> Role, jurisdiction and record-state rules are
          enforced by the inventory service, not by hidden buttons. Every write is validated on the
          trusted boundary and recorded in the audit trail.
        </div>
      </div>
    </div>
  );
}
