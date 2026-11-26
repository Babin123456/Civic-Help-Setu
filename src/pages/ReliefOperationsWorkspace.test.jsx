import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'page-test-user', role: 'operator', username: 'Page Test Operator' },
    loading: false,
  }),
}));

import ReliefOperationsWorkspace from './ReliefOperationsWorkspace';
import ReliefOperationsHeader from '../components/reliefOperations/ReliefOperationsHeader';
import ReliefNeedReportForm from '../components/reliefOperations/ReliefNeedReportForm';
import ReliefAllocationModal from '../components/reliefOperations/ReliefAllocationModal';
import ReliefDispatchModal from '../components/reliefOperations/ReliefDispatchModal';
import ReliefDeliveryModal from '../components/reliefOperations/ReliefDeliveryModal';
import {
  ReliefAllocationsPanel,
  ReliefAuditPanel,
  ReliefForecastPanel,
  ReliefInventoryPanel,
  ReliefNeedsPanel,
  ReliefOverviewPanel,
  ReliefPartnersPanel,
  ReliefPublicPanel,
} from '../components/reliefOperations/ReliefOperationsPanels';
import {
  ReliefConfidenceBadge,
  ReliefEmptyState,
  ReliefErrorState,
  ReliefOfflineBanner,
  ReliefPermissionDenied,
  ReliefPriorityBadge,
  ReliefSkeleton,
  ReliefStaleNotice,
  ReliefStatusBadge,
} from '../components/reliefOperations/ReliefOperationsStates';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import {
  SEED_RELIEF_ALLOCATIONS,
  SEED_RELIEF_INCIDENTS,
  SEED_RELIEF_NEEDS,
  SEED_RELIEF_PARTNERS,
  SEED_RELIEF_RESOURCES,
  SEED_RELIEF_SITES,
} from '../data/reliefOperationsSeed';
import { rollbackReliefStorage, __resetReliefMemoryStorage } from '../services/reliefOperationsMigrations';
import {
  getPublicReliefStatus,
  listAllocations,
  listNeedReports,
  listResources,
  getReliefAuditTrail,
  reviewNeedReport,
} from '../services/reliefOperationsService';
import { runNeedsForecast, summarizeUnmetNeeds } from '../services/reliefForecastEngine';
import { setCurrentActor } from '../services/accessControl';

const operator = {
  id: 'operator-page-1',
  role: 'operator',
  reliefRole: 'operator',
  jurisdictionId: 'WARD-150',
};

const baseProps = {
  metrics: {
    openNeeds: 7,
    peopleAffected: 430,
    pendingApprovals: 1,
    activeIncidents: 2,
    reservedUnits: 40,
    staleNeeds: 1,
  },
  activeTab: 'overview',
  onTabChange: () => {},
  roleKey: 'operator',
  onRoleChange: () => {},
  perspectives: [{ key: 'operator', role: 'operator', label: 'Relief operations operator' }],
  jurisdictionId: 'WARD-150',
  onJurisdictionChange: () => {},
  jurisdictions: [{ id: 'WARD-150', name: 'Ward 150 — Bellandur' }],
  onRefresh: () => {},
  lastRefreshed: '2026-11-19T08:00:00.000Z',
  statusMessage: 'Ready.',
};

const mockPage = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: 1,
  ...extra,
});

describe('ReliefOperationsWorkspace & Component Suite (#747)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
    __resetReliefMemoryStorage();
    rollbackReliefStorage();
    setCurrentActor(operator);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCurrentActor(null);
  });

  const renderWorkspace = () =>
    renderToStaticMarkup(
      <MemoryRouter>
        <NetworkProvider>
          <ToastProvider>
            <ReliefOperationsWorkspace />
          </ToastProvider>
        </NetworkProvider>
      </MemoryRouter>
    );

  it('renders the named workspace, role perspective, jurisdiction scope and KPI metrics', () => {
    const html = renderWorkspace();

    expect(html).toContain('Disaster Relief Needs &amp; Resource Allocation');
    expect(html).toContain('Viewing as');
    expect(html).toContain('Jurisdiction');
    expect(html).toContain('Open need reports');
    expect(html).toContain('People affected');
    expect(html).toContain('Awaiting approval');
    expect(html).toContain('Active incidents');
    expect(html).toContain('Operational scope: WARD-150');
    expect(html).toContain('append-only audit trail');
  });

  it('renders the seeded operational overview, unmet needs tables and incidents', () => {
    const html = renderWorkspace();

    expect(html).toContain('Unmet needs by category');
    expect(html).toContain('Drinking water');
    expect(html).toContain('Demand by locality');
    expect(html).toContain('Bellandur');
    expect(html).toContain('Bellandur Flood Relief Operation');
    expect(html).toContain('Flood relief is active in Bellandur');
  });

  it('renders accessible tabs with a current-section indicator', () => {
    const html = renderToStaticMarkup(<ReliefOperationsHeader {...baseProps} />);
    expect(html).toContain('aria-label="Relief operations sections"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Need reports');
    expect(html).toContain('Forecast &amp; recommendations');
    expect(html).toContain('Allocations &amp; deliveries');
  });

  it('hides sections the current perspective is not allowed to open', () => {
    const html = renderToStaticMarkup(
      <ReliefOperationsHeader {...baseProps} roleKey="public" visibleTabs={['public']} />
    );
    expect(html).toContain('Public status');
    expect(html).not.toContain('Forecast &amp; recommendations');
    expect(html).not.toContain('Allocations &amp; deliveries');
    expect(html).not.toContain('Audit trail');
  });

  it('renders forecast recommendations with confidence, evidence, freshness and human approval', () => {
    const run = runNeedsForecast(SEED_RELIEF_NEEDS, {
      now: Date.parse(SEED_RELIEF_NEEDS[0].updatedAt) + 60 * 60 * 1000,
      windowDays: 7,
    });

    const html = renderToStaticMarkup(
      <ReliefForecastPanel
        run={run}
        onRun={() => {}}
        canRun
        canPropose
        onOpenAllocation={() => {}}
        onRejectRecommendation={() => {}}
        stale={false}
      />
    );

    expect(html).toContain('Needs forecast &amp; allocation recommendations');
    expect(html).toContain('Ruleset version');
    expect(html).toContain(run.rulesetVersion);
    expect(html).toContain('Feature window');
    expect(html).toContain('Evidence &amp; explanation');
    expect(html).toContain('Human approval required');
    expect(html).toContain('Recommendations as an accessible table');
    expect(html).toContain('Medicine &amp; medical supplies');
    expect(html).toContain('does not triage');
  });

  it('renders need reports with review actions and an audited rejection form', () => {
    const page = listNeedReports({ pageSize: 20 }, operator);

    const html = renderToStaticMarkup(
      <ReliefNeedsPanel
        needsPage={page}
        filters={{ status: 'all' }}
        onFilterChange={() => {}}
        onReview={() => {}}
        canVerify
      />
    );

    expect(html).toContain('Need reports');
    expect(html).toContain('TRK-RLF-100001');
    expect(html).toContain('Verify');
    expect(html).toContain('Reject');
    expect(html).toContain('Page 1 of');
  });

  it('renders the allocation queue with transactional status and permitted actions', () => {
    const page = listAllocations({ pageSize: 20 }, operator);

    const html = renderToStaticMarkup(
      <ReliefAllocationsPanel
        allocationsPage={page}
        actorId="someone-else"
        onApprove={() => {}}
        onReject={() => {}}
        onDispatch={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        canApprove
        canDispatch
        canConfirm
      />
    );

    expect(html).toContain('Allocation queue &amp; delivery tracking');
    expect(html).toContain('Approve &amp; reserve');
    expect(html).toContain('Awaiting human approval');
  });

  it('renders inventory, stock movements, sites and partner verification tables', () => {
    const resourcesPage = listResources({ pageSize: 20 }, operator);

    const html = renderToStaticMarkup(
      <ReliefInventoryPanel
        resourcesPage={resourcesPage}
        sites={SEED_RELIEF_SITES}
        movementsPage={mockPage([])}
        partners={SEED_RELIEF_PARTNERS}
        canManage
        onAddStock={() => {}}
        onQuarantine={() => {}}
      />
    );

    expect(html).toContain('Resource inventory');
    expect(html).toContain('Unreserved stock');
    expect(html).toContain('Receive stock');
    expect(html).toContain('Write off or quarantine stock');
    expect(html).toContain('Distribution sites');
    expect(html).toContain('Relief partner verification');
  });

  it('renders the public aggregate projection without internal or personal fields', () => {
    const publicStatus = getPublicReliefStatus({ jurisdictionId: 'WARD-150' });

    const html = renderToStaticMarkup(
      <ReliefPublicPanel publicStatus={publicStatus} onTrack={() => {}} />
    );

    expect(html).toContain('Public relief status');
    expect(html).toContain('Fields that are published');
    expect(html).toContain('Track a need report');
    expect(html).toContain('do not replace emergency instructions');
    expect(html).not.toContain('NEED-0001');
    expect(JSON.stringify(publicStatus)).not.toContain('TRK-RLF-100001');
    expect(JSON.stringify(publicStatus)).not.toContain('anon-7f2');
    expect(JSON.stringify(publicStatus)).not.toContain('Community hall coordinator');
  });

  it('renders the append-only audit trail with actor, reason and change columns', () => {
    reviewNeedReport('NEED-0008', { decision: 'verify', privateNote: 'Field team confirmed the request.' }, operator);
    const auditPage = getReliefAuditTrail({ pageSize: 20 }, {
      id: 'reviewer-page-1',
      role: 'reviewer',
      reliefRole: 'reviewer',
      jurisdictionId: 'WARD-150',
    });

    const html = renderToStaticMarkup(<ReliefAuditPanel auditPage={auditPage} />);

    expect(html).toContain('Append-only audit trail');
    expect(html).toContain('Actor');
    expect(html).toContain('Reason');
    expect(html).toContain('Change');
  });

  it('renders partner verification records for administrators', () => {
    const html = renderToStaticMarkup(<ReliefPartnersPanel partners={SEED_RELIEF_PARTNERS} />);
    expect(html).toContain('Partner verification records');
    expect(html).toContain('Verified relief partner');
  });

  it('renders the allocation modal with recommendation evidence and quantity override help', () => {
    const run = runNeedsForecast(SEED_RELIEF_NEEDS, {
      now: Date.parse(SEED_RELIEF_NEEDS[0].updatedAt) + 60 * 60 * 1000,
      windowDays: 7,
    });
    const recommendation = run.recommendations.find((item) => item.category === 'water');

    const html = renderToStaticMarkup(
      <ReliefAllocationModal
        recommendation={recommendation}
        needs={SEED_RELIEF_NEEDS}
        resources={SEED_RELIEF_RESOURCES.map((resource) => ({
          ...resource,
          availableQuantity: Math.max(
            0,
            resource.quantityOnHand - (resource.quantityReserved || 0)
          ),
        }))}
        sites={SEED_RELIEF_SITES}
        onClose={() => {}}
        onSubmit={() => {}}
        onReject={() => {}}
      />
    );

    expect(html).toContain('Create allocation proposal');
    expect(html).toContain('Automated recommendation');
    expect(html).toContain('Recommended quantity');
    expect(html).toContain('operator override');
    expect(html).toContain('Submit for reviewer approval');
  });

  it('renders dispatch and delivery confirmation dialogs', () => {
    const allocation = listAllocations({ pageSize: 20 }, operator).items[0];

    const dispatchHtml = renderToStaticMarkup(
      <ReliefDispatchModal allocation={allocation} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(dispatchHtml).toContain('Dispatch reserved stock');
    expect(dispatchHtml).toContain('Delivery team');
    expect(dispatchHtml).toContain('Dispatch allocation');

    const deliveryHtml = renderToStaticMarkup(
      <ReliefDeliveryModal allocation={allocation} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(deliveryHtml).toContain('Confirm distribution');
    expect(deliveryHtml).toContain('Delivered quantity');
    expect(deliveryHtml).toContain('Received by (role only)');
    expect(deliveryHtml).toContain('Record confirmed distribution');
  });

  it('renders the need report form with privacy guidance and accessible error wiring', () => {
    const html = renderToStaticMarkup(
      <ReliefNeedReportForm onSubmit={() => {}} defaultJurisdiction="WARD-150" />
    );

    expect(html).toContain('Report a relief need');
    expect(html).toContain('never asks for names, phone numbers');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('What is needed?');
    expect(html).toContain('Submit need report');
  });

  it('renders overview, empty, error, permission, offline, stale and skeleton states', () => {
    const html = renderToStaticMarkup(
      <ReliefOperationsHeader {...baseProps} metrics={null} statusMessage="" />
    );
    expect(html).not.toContain('Open need reports');

    const overviewHtml = renderToStaticMarkup(
      <ReliefOverviewPanel
        metrics={baseProps.metrics}
        unmetNeeds={{ summary: summarizeUnmetNeeds([]), needs: [] }}
        incidents={SEED_RELIEF_INCIDENTS}
      />
    );
    expect(overviewHtml).toContain('No unmet needs recorded');

    expect(renderToStaticMarkup(<ReliefEmptyState title="No rows" message="Nothing here." />)).toContain(
      'Nothing here.'
    );
    expect(
      renderToStaticMarkup(<ReliefErrorState error="Network unavailable" onRetry={() => {}} />)
    ).toContain('Retry');
    expect(
      renderToStaticMarkup(<ReliefPermissionDenied requiredCapability="reviewer approval" />)
    ).toContain('Access restricted');
    expect(renderToStaticMarkup(<ReliefOfflineBanner />)).toContain('Offline mode');
    expect(
      renderToStaticMarkup(<ReliefStaleNotice lastRefreshed="2026-11-19T08:00:00Z" onRefresh={() => {}} />)
    ).toContain('Data freshness');
    expect(renderToStaticMarkup(<ReliefSkeleton count={2} />)).toContain('relief-skeleton-grid');
  });

  it('renders non-colour-only status, priority and confidence badges with text labels', () => {
    expect(renderToStaticMarkup(<ReliefPriorityBadge tier="critical" score={88} />)).toContain('Critical');
    expect(renderToStaticMarkup(<ReliefConfidenceBadge confidence="low" />)).toContain('Low confidence');
    expect(
      renderToStaticMarkup(<ReliefStatusBadge status="pending_approval" type="allocation" />)
    ).toContain('Awaiting human approval');
    expect(renderToStaticMarkup(<ReliefStatusBadge status="verified" />)).toContain('Verified by operator');
    expect(renderToStaticMarkup(<ReliefStatusBadge status="expired" type="resource" />)).toContain(
      'Expired / unfit'
    );
  });

  it('keeps seeded allocation fixtures consistent with the service projection', () => {
    expect(SEED_RELIEF_ALLOCATIONS.length).toBeGreaterThan(0);
    const page = listAllocations({}, operator);
    expect(page.items.length).toBe(SEED_RELIEF_ALLOCATIONS.length);
    expect(page.items[0].statusLabel).toBeDefined();
  });
});
