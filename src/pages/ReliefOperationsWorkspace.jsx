import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';
import ReliefOperationsHeader from '../components/reliefOperations/ReliefOperationsHeader';
import ReliefNeedReportForm from '../components/reliefOperations/ReliefNeedReportForm';
import ReliefAllocationModal from '../components/reliefOperations/ReliefAllocationModal';
import ReliefDeliveryModal from '../components/reliefOperations/ReliefDeliveryModal';
import ReliefDispatchModal from '../components/reliefOperations/ReliefDispatchModal';
import {
  ReliefAuditPanel,
  ReliefAllocationsPanel,
  ReliefForecastPanel,
  ReliefInventoryPanel,
  ReliefNeedsPanel,
  ReliefOverviewPanel,
  ReliefPartnersPanel,
  ReliefPublicPanel,
} from '../components/reliefOperations/ReliefOperationsPanels';
import {
  ReliefEmptyState,
  ReliefErrorState,
  ReliefOfflineBanner,
  ReliefPermissionDenied,
  ReliefSkeleton,
  ReliefStaleNotice,
} from '../components/reliefOperations/ReliefOperationsStates';
import {
  addStock,
  cancelAllocation,
  confirmDelivery,
  decideAllocation,
  dispatchAllocation,
  getLatestForecastRun,
  getPublicReliefStatus,
  getReliefAuditTrail,
  getReliefMetrics,
  getUnmetNeedsSummary,
  listAllocations,
  listDistributionSites,
  listIncidents,
  listNeedReports,
  listPartners,
  listResources,
  listStockMovements,
  proposeAllocation,
  quarantineResource,
  recordRecommendationDecision,
  reviewNeedReport,
  runReliefForecast,
  submitNeedReport,
  trackNeedByToken,
} from '../services/reliefOperationsService';
import {
  canRelief,
  isReliefStaff,
  resolveReliefScope,
} from '../services/reliefOperationsAccessControl';
import {
  RELIEF_ERROR_CODES,
  RELIEF_ERROR_GUIDANCE,
  RELIEF_ROLES,
} from '../services/reliefOperationsConstants';

const JURISDICTIONS = Object.freeze([
  { id: 'all', name: 'All wards (unrestricted admin scope)' },
  { id: 'WARD-150', name: 'Ward 150 — Bellandur' },
  { id: 'WARD-042', name: 'Ward 42 — Indiranagar' },
  { id: 'WARD-174', name: 'Ward 174 — HSR Layout' },
]);

const REPORT_JURISDICTIONS = JURISDICTIONS.filter((jurisdiction) => jurisdiction.id !== 'all');

const PERSPECTIVES = Object.freeze([
  {
    key: 'public',
    role: RELIEF_ROLES.PUBLIC,
    label: 'Public visitor',
    actor: null,
    defaultJurisdiction: 'all',
    jurisdictionIds: JURISDICTIONS.map((jurisdiction) => jurisdiction.id),
  },
  {
    key: 'citizen',
    role: RELIEF_ROLES.CITIZEN,
    label: 'Citizen reporter',
    actor: {
      id: 'demo-citizen-1',
      role: 'citizen',
      reliefRole: RELIEF_ROLES.CITIZEN,
      jurisdictionId: 'WARD-150',
    },
    defaultJurisdiction: 'WARD-150',
    jurisdictionIds: JURISDICTIONS.map((jurisdiction) => jurisdiction.id),
  },
  {
    key: 'partner',
    role: RELIEF_ROLES.PARTNER,
    label: 'Verified relief partner',
    actor: {
      id: 'demo-partner-1',
      role: 'partner',
      reliefRole: RELIEF_ROLES.PARTNER,
      partnerId: 'PARTNER-001',
      jurisdictionId: 'WARD-150',
    },
    defaultJurisdiction: 'WARD-150',
    jurisdictionIds: JURISDICTIONS.map((jurisdiction) => jurisdiction.id),
  },
  {
    key: 'operator',
    role: RELIEF_ROLES.OPERATOR,
    label: 'Relief operations operator',
    actor: {
      id: 'demo-operator-1',
      role: 'operator',
      reliefRole: RELIEF_ROLES.OPERATOR,
      jurisdictionId: 'WARD-150',
    },
    defaultJurisdiction: 'WARD-150',
    jurisdictionIds: ['WARD-150'],
  },
  {
    key: 'reviewer',
    role: RELIEF_ROLES.REVIEWER,
    label: 'Allocation reviewer',
    actor: {
      id: 'demo-reviewer-1',
      role: 'reviewer',
      reliefRole: RELIEF_ROLES.REVIEWER,
      jurisdictionId: 'WARD-150',
    },
    defaultJurisdiction: 'WARD-150',
    jurisdictionIds: ['WARD-150'],
  },
  {
    key: 'admin',
    role: RELIEF_ROLES.ADMIN,
    label: 'Relief administrator',
    actor: {
      id: 'demo-admin-1',
      role: 'admin',
      reliefRole: RELIEF_ROLES.ADMIN,
    },
    defaultJurisdiction: 'all',
    jurisdictionIds: JURISDICTIONS.map((jurisdiction) => jurisdiction.id),
  },
]);

const TAB_CAPABILITIES = Object.freeze({
  overview: 'need.read',
  needs: 'need.read',
  forecast: 'allocation.read',
  allocations: 'allocation.read',
  inventory: 'inventory.read',
  public: null,
  audit: 'audit.read',
});

const INITIAL_NEED_FILTERS = Object.freeze({ status: 'all', page: 1, pageSize: 20 });
const INITIAL_ALLOCATION_FILTERS = Object.freeze({ status: 'all', page: 1, pageSize: 20 });
const INITIAL_PAGE_FILTERS = Object.freeze({ page: 1, pageSize: 20 });

const errorCode = (error) => error?.code || RELIEF_ERROR_CODES.TRANSACTION_FAILED;
const guidanceFor = (error) =>
  RELIEF_ERROR_GUIDANCE[errorCode(error)] || error?.message || 'The action could not be completed.';

export default function ReliefOperationsWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();

  const defaultPerspective = useMemo(() => {
    const role = user?.reliefRole || user?.role;
    if (['admin', 'reviewer', 'operator', 'partner', 'citizen'].includes(role)) return role;
    return 'public';
  }, [user]);

  const [roleKey, setRoleKey] = useState(defaultPerspective);
  const perspective =
    PERSPECTIVES.find((item) => item.key === roleKey) || PERSPECTIVES[0];
  const [jurisdictionId, setJurisdictionId] = useState(perspective.defaultJurisdiction);
  const [activeTab, setActiveTab] = useState(() =>
    canRelief('need.read', perspective.actor) ? 'overview' : 'public'
  );
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date().toISOString());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [needFilters, setNeedFilters] = useState(INITIAL_NEED_FILTERS);
  const allocationFilters = INITIAL_ALLOCATION_FILTERS;
  const resourceFilters = INITIAL_PAGE_FILTERS;
  const movementFilters = INITIAL_PAGE_FILTERS;
  const auditFilters = INITIAL_PAGE_FILTERS;

  const [forecastRun, setForecastRun] = useState(null);
  const [allocationRecommendation, setAllocationRecommendation] = useState(null);
  const [dispatchTarget, setDispatchTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const activeActor = perspective.actor;
  const staff = isReliefStaff(activeActor);

  const visibleTabs = useMemo(
    () =>
      Object.keys(TAB_CAPABILITIES).filter((tab) => {
        const capability = TAB_CAPABILITIES[tab];
        if (!capability) return true;
        return canRelief(capability, activeActor);
      }),
    [activeActor]
  );

  const effectiveTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0];

  const jurisdictionsForPerspective = useMemo(
    () => JURISDICTIONS.filter((item) => perspective.jurisdictionIds.includes(item.id)),
    [perspective]
  );

  const refresh = useCallback(() => {
    setIsLoading(true);
    setLastRefreshed(new Date().toISOString());
    setRefreshTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!isLoading) return undefined;
    const timer = setTimeout(() => setIsLoading(false), 180);
    return () => clearTimeout(timer);
  }, [isLoading, refreshTick]);

  const handleRoleChange = (nextKey) => {
    const nextPerspective = PERSPECTIVES.find((item) => item.key === nextKey) || PERSPECTIVES[0];
    setRoleKey(nextKey);
    setJurisdictionId(nextPerspective.defaultJurisdiction);
    setActiveTab(canRelief('need.read', nextPerspective.actor) ? 'overview' : 'public');
    setForecastRun(null);
    setAllocationRecommendation(null);
    setDispatchTarget(null);
    setConfirmTarget(null);
    setStatusMessage(`Viewing the relief workspace as ${nextPerspective.label}.`);
  };

  const handleJurisdictionChange = (nextJurisdiction) => {
    setJurisdictionId(nextJurisdiction);
    setForecastRun(null);
    setStatusMessage(
      nextJurisdiction === 'all'
        ? 'Showing all jurisdictions in your scope.'
        : `Showing jurisdiction ${nextJurisdiction}.`
    );
  };

  const loaded = useMemo(() => {
    // Reading the refresh tick invalidates this memo after any mutation.
    void refreshTick;
    const requestedJurisdiction = jurisdictionId === 'all' ? null : jurisdictionId;
    try {
      const incidents = listIncidents({ jurisdictionId }, activeActor);
      const publicStatus = getPublicReliefStatus({
        jurisdictionId: requestedJurisdiction,
      });

      if (!staff) {
        return {
          errors: [],
          incidents,
          publicStatus,
          metrics: null,
          unmetNeeds: null,
          needsPage: null,
          allocationsPage: null,
          resourcesPage: null,
          movementsPage: null,
          sites: [],
          partners: [],
          auditPage: null,
          latestForecastRun: null,
        };
      }

      const unmetNeeds = getUnmetNeedsSummary({ jurisdictionId }, activeActor);
      const needsPage = listNeedReports({ ...needFilters, jurisdictionId }, activeActor);
      const allocationsPage = listAllocations({ ...allocationFilters, jurisdictionId }, activeActor);
      const resourcesPage = listResources({ ...resourceFilters, jurisdictionId }, activeActor);
      const sites = listDistributionSites({ jurisdictionId }, activeActor);
      const movementsPage = listStockMovements({ ...movementFilters, jurisdictionId }, activeActor);
      const metrics = getReliefMetrics({ jurisdictionId }, activeActor);

      const canReadAudit = canRelief('audit.read', activeActor);
      const auditPage = canReadAudit
        ? getReliefAuditTrail({ ...auditFilters, jurisdictionId }, activeActor)
        : null;
      const partners = canReadAudit ? listPartners({ jurisdictionId }, activeActor) : [];
      const latestForecastRun = getLatestForecastRun({ jurisdictionId }, activeActor);

      return {
        errors: [],
        incidents,
        publicStatus,
        metrics,
        unmetNeeds,
        needsPage,
        allocationsPage,
        resourcesPage,
        movementsPage,
        sites,
        partners,
        auditPage,
        latestForecastRun,
      };
    } catch (error) {
      return { errors: [error], incidents: [], publicStatus: null };
    }
  }, [
    activeActor,
    staff,
    jurisdictionId,
    refreshTick,
    needFilters,
    allocationFilters,
    resourceFilters,
    movementFilters,
    auditFilters,
  ]);

  const loadFailure = loaded.errors[0] || null;
  const displayRun = forecastRun || loaded.latestForecastRun || null;
  const unmetNeeds = loaded.unmetNeeds || { summary: { byCategory: [], byLocality: [] }, needs: [] };
  const actorId = activeActor?.id || null;
  const scope = resolveReliefScope(activeActor);

  const runAction = useCallback(
    (action, successMessage) => {
      try {
        const result = action();
        setStatusMessage(successMessage);
        toast({ type: 'success', title: 'Saved', message: successMessage });
        refresh();
        return result;
      } catch (error) {
        const message = guidanceFor(error);
        setStatusMessage(message);
        toast({ type: 'error', title: 'Action not completed', message });
        throw error;
      }
    },
    [refresh, toast]
  );

  const handleReviewNeed = (needId, payload) =>
    runAction(
      () => reviewNeedReport(needId, payload, activeActor),
      payload.decision === 'reject'
        ? 'Need report rejected with an audited reason.'
        : 'Need report review saved.'
    );

  const handleApproveAllocation = (allocationId, reason) =>
    runAction(
      () => decideAllocation(allocationId, { decision: 'approve', reason }, activeActor),
      'Allocation approved and stock reserved transactionally.'
    );

  const handleRejectAllocation = (allocationId, reason) =>
    runAction(
      () => decideAllocation(allocationId, { decision: 'reject', reason }, activeActor),
      'Allocation proposal rejected with an audited reason.'
    );

  const handleCancelAllocation = (allocationId, reason) =>
    runAction(
      () => cancelAllocation(allocationId, { reason }, activeActor),
      'Allocation cancelled and any reservation released.'
    );

  const handleDispatchConfirm = (allocationId, payload) => {
    const result = runAction(
      () => dispatchAllocation(allocationId, payload, activeActor),
      'Delivery team dispatched; the reservation remains linked to the stock ledger.'
    );
    setDispatchTarget(null);
    return result;
  };

  const handleConfirmDelivery = (quantity, payload) => {
    if (!confirmTarget) return null;
    const result = runAction(
      () => confirmDelivery(confirmTarget.id, payload, activeActor),
      'Distribution confirmed; stock issued and the linked need updated.'
    );
    setConfirmTarget(null);
    return result;
  };

  const handleAddStock = (resourceId, payload) =>
    runAction(
      () => addStock(resourceId, payload, activeActor),
      'Stock receipt recorded.'
    );

  const handleQuarantine = (resourceId, payload) =>
    runAction(
      () => quarantineResource(resourceId, payload, activeActor),
      'Stock written off with an audited reason.'
    );

  const handleRunForecast = () => {
    try {
      const run = runAction(
        () =>
          runReliefForecast(
            {
              jurisdictionId,
              windowDays: 7,
            },
            activeActor
          ),
        'Needs forecast completed and stored with its ruleset version and feature window.'
      );
      setForecastRun(run);
    } catch {
      // runAction already surfaced the toast and status message; keep the page mounted.
    }
  };

  const handleRecommendationDecision = (payload) =>
    runAction(
      () => recordRecommendationDecision(payload, activeActor),
      `Recommendation ${payload.decision}.`
    );

  const handleCreateProposal = (input) => {
    const proposal = runAction(
      () => proposeAllocation(input, activeActor),
      'Allocation proposal created and queued for an independent reviewer.'
    );
    setAllocationRecommendation(null);
    return proposal;
  };

  const handleSubmitNeed = (input) =>
    runAction(
      () =>
        submitNeedReport(input, activeActor, {
          clientId: activeActor?.id || 'web-anonymous',
        }),
      'Relief need submitted. Keep the tracking token to check its status.'
    );

  const handleTrackNeed = (token) => trackNeedByToken(token);

  const renderTab = () => {
    if (isLoading) return <ReliefSkeleton count={3} />;

    if (loadFailure) {
      if (loadFailure.code === RELIEF_ERROR_CODES.PERMISSION_DENIED) {
        return (
          <ReliefPermissionDenied requiredCapability="operational relief data access for this jurisdiction" />
        );
      }
      return <ReliefErrorState error={loadFailure} errorCode={errorCode(loadFailure)} onRetry={refresh} />;
    }

    switch (effectiveTab) {
      case 'overview':
        if (!loaded.metrics) {
          return <ReliefPermissionDenied requiredCapability="relief operator access" />;
        }
        return (
          <ReliefOverviewPanel
            metrics={loaded.metrics}
            unmetNeeds={unmetNeeds}
            incidents={loaded.incidents}
          />
        );

      case 'needs':
        if (!loaded.needsPage) {
          return <ReliefPermissionDenied requiredCapability="need report access" />;
        }
        return (
          <ReliefNeedsPanel
            needsPage={loaded.needsPage}
            filters={needFilters}
            onFilterChange={(next) => setNeedFilters({ ...next, page: 1 })}
            onReview={handleReviewNeed}
            canVerify={canRelief('need.verify', activeActor)}
          />
        );

      case 'forecast':
        return (
          <ReliefForecastPanel
            run={displayRun}
            onRun={handleRunForecast}
            canRun={canRelief('forecast.run', activeActor)}
            canPropose={canRelief('allocation.propose', activeActor)}
            onOpenAllocation={setAllocationRecommendation}
            onRejectRecommendation={handleRecommendationDecision}
            stale={Boolean(displayRun?.dataFreshness?.isStale)}
          />
        );

      case 'allocations':
        if (!loaded.allocationsPage) {
          return <ReliefPermissionDenied requiredCapability="allocation queue access" />;
        }
        return (
          <ReliefAllocationsPanel
            allocationsPage={loaded.allocationsPage}
            actorId={actorId}
            onApprove={handleApproveAllocation}
            onReject={handleRejectAllocation}
            onDispatch={setDispatchTarget}
            onConfirm={setConfirmTarget}
            onCancel={handleCancelAllocation}
            canApprove={canRelief('allocation.approve', activeActor)}
            canDispatch={canRelief('allocation.dispatch', activeActor)}
            canConfirm={canRelief('delivery.confirm', activeActor)}
          />
        );

      case 'inventory':
        if (!loaded.resourcesPage) {
          return <ReliefPermissionDenied requiredCapability="inventory access" />;
        }
        return (
          <ReliefInventoryPanel
            resourcesPage={loaded.resourcesPage}
            sites={loaded.sites}
            movementsPage={loaded.movementsPage}
            partners={loaded.partners}
            canManage={canRelief('inventory.manage', activeActor)}
            onAddStock={handleAddStock}
            onQuarantine={handleQuarantine}
          />
        );

      case 'public':
        if (!loaded.publicStatus) return <ReliefSkeleton count={2} />;
        return (
          <div className="relief-panel-stack">
            <ReliefPublicPanel publicStatus={loaded.publicStatus} onTrack={handleTrackNeed} />
            <ReliefNeedReportForm
              onSubmit={handleSubmitNeed}
              defaultJurisdiction={jurisdictionId === 'all' ? 'WARD-150' : jurisdictionId}
              jurisdictions={REPORT_JURISDICTIONS.filter((item) =>
                perspective.jurisdictionIds.includes(item.id)
              )}
            />
          </div>
        );

      case 'audit':
        if (!loaded.auditPage) {
          return <ReliefPermissionDenied requiredCapability="audit trail access" />;
        }
        return (
          <div className="relief-panel-stack">
            <ReliefAuditPanel auditPage={loaded.auditPage} />
            {canRelief('partner.verify', activeActor) && (
              <ReliefPartnersPanel partners={loaded.partners} />
            )}
          </div>
        );

      default:
        return <ReliefEmptyState title="Nothing selected" message="Choose a section above." />;
    }
  };

  return (
    <div className="section relief-workspace">
      <div className="container relief-container">
        {!isOnline && <ReliefOfflineBanner />}
        <ReliefStaleNotice
          lastRefreshed={lastRefreshed}
          onRefresh={refresh}
          staleReason="Allocation decisions should be based on the most recent field verification."
        />

        <ReliefOperationsHeader
          metrics={loaded.metrics}
          activeTab={effectiveTab}
          onTabChange={setActiveTab}
          roleKey={roleKey}
          onRoleChange={handleRoleChange}
          perspectives={PERSPECTIVES}
          jurisdictionId={jurisdictionId}
          onJurisdictionChange={handleJurisdictionChange}
          jurisdictions={jurisdictionsForPerspective}
          onRefresh={refresh}
          lastRefreshed={lastRefreshed}
          statusMessage={statusMessage}
          visibleTabs={visibleTabs}
        />

        <p className="relief-help relief-scope-note">
          {staff
            ? `Operational scope: ${scope.length ? scope.join(', ') : 'all jurisdictions'}. Your capability set is enforced by the service boundary, not just by this interface.`
            : 'You are viewing public aggregate information and may submit a need report. Operational records are not available for this perspective.'}
        </p>

        <main aria-label="Relief operations content">{renderTab()}</main>

        {allocationRecommendation && (
          <ReliefAllocationModal
            recommendation={allocationRecommendation}
            needs={unmetNeeds.needs}
            resources={loaded.resourcesPage?.items || []}
            sites={loaded.sites || []}
            onClose={() => setAllocationRecommendation(null)}
            onSubmit={handleCreateProposal}
            onReject={handleRecommendationDecision}
          />
        )}

        {dispatchTarget && (
          <ReliefDispatchModal
            allocation={dispatchTarget}
            onClose={() => setDispatchTarget(null)}
            onConfirm={handleDispatchConfirm}
          />
        )}

        {confirmTarget && (
          <ReliefDeliveryModal
            allocation={confirmTarget}
            onClose={() => setConfirmTarget(null)}
            onConfirm={handleConfirmDelivery}
          />
        )}
      </div>
    </div>
  );
}
