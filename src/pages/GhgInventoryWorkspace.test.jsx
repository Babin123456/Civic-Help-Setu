import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import GhgInventoryWorkspace from './GhgInventoryWorkspace';
import GhgPublicView from '../components/ghgInventory/GhgPublicView';
import GhgMethodologyPanel from '../components/ghgInventory/GhgMethodologyPanel';
import GhgRecommendationsPanel from '../components/ghgInventory/GhgRecommendationsPanel';
import GhgSubmissionReview from '../components/ghgInventory/GhgSubmissionReview';
import GhgSubmissionForm from '../components/ghgInventory/GhgSubmissionForm';
import GhgPeriodComparison from '../components/ghgInventory/GhgPeriodComparison';
import GhgAuditPanel from '../components/ghgInventory/GhgAuditPanel';
import {
  GhgEmptyState,
  GhgErrorState,
  GhgInventorySkeleton,
  GhgOfflineBanner,
  GhgPermissionDenied,
  GhgStaleNotice,
  GhgStatusBadge,
} from '../components/ghgInventory/GhgInventoryStates';
import { rollbackGhgStorage } from '../services/ghgInventoryMigrations.js';import { setCurrentActor } from '../services/accessControl.js';
import {
  getInventoryMetadata,
  getInventorySummary,
  getPeriodComparison,
  getPublicInventorySummary,
  getSubmissionDetail,
  listAuditEvents,
  listCalculationRuns,
  listEmissionSources,
  listFactorCatalog,
  listRecommendations,
  listSubmissions,
} from '../services/ghgInventoryService.js';

const reviewer = {
  id: 'reviewer-1',
  username: 'ReviewerWard42',
  role: 'staff',
  ghgRole: 'reviewer',
  jurisdictionId: 'WARD-042',
};
const operator = {
  id: 'operator-1',
  username: 'OperatorWard42',
  role: 'staff',
  ghgRole: 'operator',
  jurisdictionId: 'WARD-042',
};

const mockAuthState = { user: null };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));
vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('GhgInventoryWorkspace & component suite (#753)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
    setCurrentActor(reviewer);
    mockAuthState.user = null;
    rollbackGhgStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCurrentActor(null);
  });

  const renderWorkspace = () =>
    renderToStaticMarkup(
      <MemoryRouter>
        <GhgInventoryWorkspace />
      </MemoryRouter>
    );

  it('renders the workspace header, period scope, role perspective and tabs', () => {
    const html = renderWorkspace();

    expect(html).toContain('Local Government Greenhouse-Gas Inventory');
    expect(html).toContain('Municipal climate accountability');
    expect(html).toContain('Reporting period');
    expect(html).toContain('FY 2026-27');
    expect(html).toContain('Role perspective');
    expect(html).toContain('Citizen / public');
    expect(html).toContain('Operator');
    expect(html).toContain('Reviewer');
    expect(html).toContain('Administrator');
    expect(html).toContain('aria-label="Greenhouse-gas inventory sections"');
    expect(html).toContain('Overview');
    expect(html).toContain('Department submissions');
    expect(html).toContain('Period comparison');
    expect(html).toContain('Methodology &amp; factors');
    expect(html).toContain('Public view');
  });

  it('renders the approved overview, stale-calculation notice and operator actions', () => {
    const html = renderWorkspace();

    expect(html).toContain('Inventory overview');
    expect(html).toContain('Approved emissions');
    expect(html).toContain('296.7 tCO2e');
    expect(html).toContain('Measured data');
    expect(html).toContain('Labelled estimates');
    expect(html).toContain('Excluded values');
    expect(html).toContain('Data quality &amp; completeness');
    expect(html).toContain('active source(s) have no approved activity value');
    expect(html).toContain('Calculation warnings');
    expect(html).toContain('Stale calculation.');
    expect(html).toContain('Run calculation');
    expect(html).toContain('New submission');
    // An open period cannot be exported until it is approved.
    expect(html).not.toContain('Export inventory');
    expect(html).toContain('Source-linked activity');
    expect(html).toContain('Indiranagar Public Library');
    expect(html).toContain('Inspect formula');
  });

  it('renders the public projection with aggregate fields and no internal identifiers', () => {
    const publicData = getPublicInventorySummary();
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GhgPublicView
          publicData={publicData}
          periods={publicData.periods}
          selectedPeriodLabel="FY 2025-26"
          onSelectPeriod={() => {}}
          jurisdictionName="Ward 42 — Indiranagar"
        />
      </MemoryRouter>
    );

    expect(html).toContain('Public transparency view');
    expect(html).toContain('Approved total');
    expect(html).toContain('5,790.14 tCO2e');
    expect(html).toContain('Approved emissions by category');
    expect(html).toContain('Waste operations');
    expect(html).toContain('accessible alternative to a chart');
    expect(html).toContain('What is published.');
    expect(html).not.toMatch(/SUB-|ACT-|SRC-|EFV-/);
    expect(html).not.toContain('reviewer.ward42');
    expect(html).not.toContain('landfill-gate');
    expect(html).not.toContain('sourceDocument');
  });

  it('renders the public empty state when no approved inventory is published', () => {
    const openPeriod = getPublicInventorySummary({ periodId: 'PER-2026-27' });
    const html = renderToStaticMarkup(
      <GhgPublicView
        publicData={openPeriod}
        periods={openPeriod.periods}
        selectedPeriodLabel="FY 2026-27"
        onSelectPeriod={() => {}}
      />
    );

    expect(openPeriod.available).toBe(false);
    expect(html).toContain('No approved inventory is published yet');
    expect(html).toContain('No approved inventory');
    expect(html).not.toContain('296.7');
  });

  it('renders methodology, formula, published factors and run history', () => {
    const summary = getInventorySummary('PER-2025-26', reviewer);
    const catalog = listFactorCatalog(reviewer);
    const runs = listCalculationRuns('PER-2025-26', reviewer);
    const line = summary.lines.find((item) => item.sourceId === 'SRC-WST-01');
    const html = renderToStaticMarkup(
      <GhgMethodologyPanel
        line={line}
        metadata={getInventoryMetadata()}
        factorCatalog={catalog}
        runs={runs}
        selectedRunId={runs[0]?.id}
        onSelectRun={() => {}}
      />
    );

    expect(html).toContain('Methodology &amp; formula inspection');
    expect(html).toContain('ghg-methodology-2026.1');
    expect(html).toContain('ghg-inventory-export/v1');
    expect(html).toContain('Measured · Estimated · Excluded');
    expect(html).toContain(line.formula);
    expect(html).toContain('Published factor versions');
    expect(html).toContain('Calculation run history');
    expect(html).toContain('45%');
  });

  it('renders estimation recommendations as human-controlled and labelled', () => {
    const recommendations = listRecommendations({ periodId: 'PER-2026-27' }, reviewer).items;
    const html = renderToStaticMarkup(
      <GhgRecommendationsPanel
        recommendations={recommendations}
        onDecide={() => {}}
        canDecide
      />
    );

    expect(html).toContain('Estimated totals &amp; human decisions');
    expect(html).toContain('Fire &amp; Emergency Fleet');
    expect(html).toContain('Awaiting human decision');
    expect(html).toContain('Estimated (not measured)');
    expect(html).toContain('±12%');
    expect(html).toContain('A recommendation is not data.');
    expect(html).toContain('Decision reason (required)');
    expect(html).toContain('Accept as estimated');
    expect(html).toContain('Reject estimate');
    expect(html).toContain('Source fields behind this estimate');
  });

  it('renders reviewer decisions with a required reason and operator resubmission controls', () => {
    const submissions = listSubmissions(
      { periodId: 'PER-2026-27', pageSize: 100 },
      reviewer
    ).items;
    const reviewerDetail = getSubmissionDetail('SUB-2627-FLEET', reviewer);
    const reviewerHtml = renderToStaticMarkup(
      <GhgSubmissionReview
        submissions={submissions}
        detail={reviewerDetail}
        selectedId={reviewerDetail.id}
        onSelect={() => {}}
        onAction={() => {}}
        canReview
        canOperate={false}
      />
    );

    expect(reviewerHtml).toContain('Department submissions');
    expect(reviewerHtml).toContain('Start review');
    expect(reviewerHtml).toContain('Reject submission');
    expect(reviewerHtml).toContain('Review reason');
    expect(reviewerHtml).toContain('Required for return, rejection and reopening.');

    const draftDetail = getSubmissionDetail('SUB-2627-WASTE', operator);
    const operatorHtml = renderToStaticMarkup(
      <GhgSubmissionReview
        submissions={submissions}
        detail={draftDetail}
        selectedId={draftDetail.id}
        onSelect={() => {}}
        onAction={() => {}}
        canReview={false}
        canOperate
        onEditSubmission={() => {}}
        onSubmitSubmission={() => {}}
      />
    );

    expect(operatorHtml).toContain('Edit draft rows');
    expect(operatorHtml).toContain('Submit for review');
    expect(operatorHtml).not.toContain('Approve submission');
  });

  it('renders the submission form with accessible fields, units and document metadata', () => {
    const sources = listEmissionSources({ pageSize: 100 }, operator).items;
    const factors = listFactorCatalog(operator).factors;
    const html = renderToStaticMarkup(
      <GhgSubmissionForm
        sources={sources}
        factors={factors}
        period={{
          id: 'PER-2026-27',
          label: 'FY 2026-27',
          jurisdictionId: 'WARD-042',
          status: 'open',
        }}
        jurisdictionId="WARD-042"
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );

    expect(html).toContain('New department submission');
    expect(html).toContain('Submission title');
    expect(html).toContain('Department');
    expect(html).toContain('Activity records');
    expect(html).toContain('Source');
    expect(html).toContain('Original value');
    expect(html).toContain('Unit');
    expect(html).toContain('Data quality');
    expect(html).toContain('Measured (meter or invoice)');
    expect(html).toContain('Estimated (labelled, not measured)');
    expect(html).toContain('Excluded (outside inventory boundary)');
    expect(html).toContain('Source document reference (optional, metadata only)');
    expect(html).toContain('Only document metadata is stored');
    expect(html).toContain('Add activity row');
    expect(html).toContain('Save draft submission');
    expect(html).toContain('aria-label="Remove activity row 1"');
  });

  it('renders period comparison as an accessible table with missing baselines', () => {
    const comparison = getPeriodComparison(
      { periodId: 'PER-2025-26', comparisonPeriodId: 'PER-2024-25' },
      reviewer
    );
    const html = renderToStaticMarkup(
      <GhgPeriodComparison comparison={comparison} />
    );

    expect(html).toContain('Period comparison');
    expect(html).toContain('Category change');
    expect(html).toContain('accessible alternative');
    expect(html).toContain('Waste operations');
    expect(html).toContain('5,790.14');
    expect(html).toContain('201.804');
    expect(html).toContain('n/a');
  });

  it('renders the audit trail with actors, actions and timestamps', () => {
    const audit = listAuditEvents({ pageSize: 50 }, reviewer);
    const html = renderToStaticMarkup(
      <GhgAuditPanel events={audit.items} total={audit.total} />
    );

    expect(html).toContain('Audit trail');
    expect(html).toContain('submission.approved');
    expect(html).toContain('factor.version_published');
    expect(html).toContain('reviewer');
    expect(html).toContain(`${audit.total} recorded event(s)`);
  });

  it('shows administrator maintenance actions only to the administrator perspective', () => {
    mockAuthState.user = { id: 'admin-1', username: 'InventoryAdmin', role: 'admin' };
    const html = renderWorkspace();

    expect(html).toContain('Administrator');
    expect(html).toContain('Reset local inventory');
    expect(html).toContain('Administrator maintenance actions are audited.');
    expect(html).toContain('Generate estimates');
  });

  it('renders loading, offline, stale, empty, error and permission-denied states', () => {
    const skeleton = renderToStaticMarkup(<GhgInventorySkeleton count={2} />);
    expect(skeleton).toContain('aria-label="Loading greenhouse-gas inventory"');
    expect(skeleton).toContain('Loading the latest inventory data.');

    const offline = renderToStaticMarkup(<GhgOfflineBanner cachedAt="2026-11-16T10:00:00Z" />);
    expect(offline).toContain('Offline mode.');
    expect(offline).toContain('last inventory saved on this device');

    const stale = renderToStaticMarkup(
      <GhgStaleNotice
        lastCalculatedAt="2026-11-16T10:00:00Z"
        reason="Approved activity data changed after this calculation."
        onRecalculate={() => {}}
        canRecalculate
      />
    );
    expect(stale).toContain('Stale calculation.');
    expect(stale).toContain('Last calculation:');
    expect(stale).toContain('Run calculation');

    const empty = renderToStaticMarkup(
      <GhgEmptyState
        title="No approved activity"
        message="Approve a submission to populate this table."
        actionLabel="Create submission"
        onAction={() => {}}
      />
    );
    expect(empty).toContain('No approved activity');
    expect(empty).toContain('Create submission');

    const error = renderToStaticMarkup(
      <GhgErrorState message="Storage could not be read." code="GHG_MIGRATION_FAILED" onRetry={() => {}} />
    );
    expect(error).toContain('The inventory could not be loaded');
    expect(error).toContain('Storage could not be read.');
    expect(error).toContain('GHG_MIGRATION_FAILED');
    expect(error).toContain('Try again');

    const denied = renderToStaticMarkup(<GhgPermissionDenied role="citizen" />);
    expect(denied).toContain('Your role cannot open this section');
    expect(denied).toContain('citizen');

    const badge = renderToStaticMarkup(<GhgStatusBadge label="Measured" tone="success" />);
    expect(badge).toContain('Measured');
  });
});
