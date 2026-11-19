import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import StreetlightOutageWorkspace from './StreetlightOutageWorkspace';
import StreetlightClusterDetailModal from '../components/streetlight/StreetlightClusterDetailModal';
import StreetlightReportModal from '../components/streetlight/StreetlightReportModal';
import StreetlightTrackModal from '../components/streetlight/StreetlightTrackModal';
import StreetlightWorkOrderModal from '../components/streetlight/StreetlightWorkOrderModal';
import StreetlightTechnicianPanel from '../components/streetlight/StreetlightTechnicianPanel';
import StreetlightInteractiveMap from '../components/streetlight/StreetlightInteractiveMap';
import {
  StreetlightSkeleton,
  StreetlightOfflineBanner,
  StreetlightStaleNotice,
  StreetlightEmptyState,
  StreetlightErrorState,
  StreetlightPermissionDenied,
  StreetlightPriorityBadge,
  StreetlightStatusBadge,
} from '../components/streetlight/StreetlightStates';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import { AuthProvider } from '../context/AuthContext';
import {
  SEED_OUTAGE_CLUSTERS,
  SEED_STREETLIGHT_ASSETS,
  SEED_WORK_ORDERS,
} from '../data/streetlightSeedData';
import { rollbackStreetlightStorage } from '../services/streetlightMigrations';
import { setCurrentActor } from '../services/accessControl';

describe('StreetlightOutageWorkspace & Component Suite (#756)', () => {
  let mockStore;

  beforeEach(() => {
    mockStore = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (mockStore.has(key) ? mockStore.get(key) : null),
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    });
    setCurrentActor({ id: 'admin-1', role: 'admin', username: 'Chief Electrical Inspector' });
    rollbackStreetlightStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCurrentActor(null);
  });

  const renderWorkspace = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <ToastProvider>
              <StreetlightOutageWorkspace />
            </ToastProvider>
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('renders dashboard title, monitored metrics, and ward scope selector', () => {
    const html = renderWorkspace();

    expect(html).toContain('Streetlight Outage &amp; Repair Prioritization');
    expect(html).toContain('Monitored Poles');
    expect(html).toContain('Active Outage Clusters');
    expect(html).toContain('Critical Dark Zones');
    expect(html).toContain('Field Work Orders');
    expect(html).toContain('Ward Scope:');
    expect(html).toContain('All Municipal Wards');
    expect(html).toContain('Perspective:');
  });

  it('renders outage clusters with priority badges and explainability factors', () => {
    const html = renderWorkspace();

    expect(html).toContain('100 Feet Road Corridor');
    expect(html).toContain('80 Feet Road 4th Block Dark Stretch');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('Prioritization Factor:');
    expect(html).toContain('View Triage &amp; Explainability');
  });

  it('renders Cluster Detail modal with explainability breakdown table and human override', () => {
    const sampleCluster = {
      ...SEED_OUTAGE_CLUSTERS[0],
      assets: SEED_STREETLIGHT_ASSETS.slice(0, 3),
      reports: [],
    };

    const html = renderToStaticMarkup(
      <StreetlightClusterDetailModal
        cluster={sampleCluster}
        onClose={() => {}}
        onTriageOverride={() => {}}
        onDispatchWorkOrder={() => {}}
        activeActor={{ id: 'admin-1', role: 'admin', streetlightRole: 'admin' }}
      />
    );

    expect(html).toContain('100 Feet Road Corridor');
    expect(html).toContain('Prioritization Scoring Explainability');
    expect(html).toContain('Ruleset: v1.0.0');
    expect(html).toContain('Human Priority Review &amp; Override');
    expect(html).toContain('Constituent Streetlight Poles &amp; Reports');
    expect(html).toContain('POLE-042-101');
    expect(html).toContain('Dispatch Work Order');
  });

  it('renders Report Modal with fault categories, pole picker, and privacy guarantee', () => {
    const html = renderToStaticMarkup(
      <StreetlightReportModal
        assets={SEED_STREETLIGHT_ASSETS}
        selectedWard="WARD-042"
        onClose={() => {}}
        onSubmitReport={() => {}}
      />
    );

    expect(html).toContain('Report Streetlight Fault');
    expect(html).toContain('Ward Jurisdiction');
    expect(html).toContain('Fault Category');
    expect(html).toContain('Completely Dark (No Light)');
    expect(html).toContain('Exposed Live Wires / Missing Cover (Severe Hazard)');
    expect(html).toContain('Privacy guarantee: Your contact is cryptographically hashed and never made public.');
    expect(html).toContain('Submit Report');
  });

  it('renders Track Modal with lookup input and tracking token guidance', () => {
    const html = renderToStaticMarkup(
      <StreetlightTrackModal onClose={() => {}} />
    );

    expect(html).toContain('Track Streetlight Repair Status');
    expect(html).toContain('Lookup');
  });

  it('renders Work Order Dispatch Modal with crew assignment and SLA options', () => {
    const html = renderToStaticMarkup(
      <StreetlightWorkOrderModal
        cluster={SEED_OUTAGE_CLUSTERS[0]}
        onClose={() => {}}
        onConfirmDispatch={() => {}}
      />
    );

    expect(html).toContain('Dispatch Field Repair Work Order');
    expect(html).toContain('Assigned Repair Crew / Technician');
    expect(html).toContain('Work Order Priority');
    expect(html).toContain('Target SLA (Hours)');
    expect(html).toContain('Confirm Dispatch');
  });

  it('renders Technician Panel with work orders and repair outcome logger', () => {
    const html = renderToStaticMarkup(
      <StreetlightTechnicianPanel
        workOrders={SEED_WORK_ORDERS}
        onUpdateStatus={() => {}}
        onRecordRepair={() => {}}
      />
    );

    expect(html).toContain('Technician Field Work Orders &amp; Repair Outcome Logging');
    expect(html).toContain(SEED_WORK_ORDERS[0].id);
    expect(html).toContain('Suresh Kumar (South Division Crew)');
    expect(html).toContain('Log Repair &amp; Complete Order');
  });

  it('renders Interactive Map with SVG canvas, grid, safety anchors, and accessible table toggle', () => {
    const html = renderToStaticMarkup(
      <StreetlightInteractiveMap
        clusters={SEED_OUTAGE_CLUSTERS}
        assets={SEED_STREETLIGHT_ASSETS}
        onSelectCluster={() => {}}
      />
    );

    expect(html).toContain('Geospatial Outage Corridors &amp; Streetlight Clusters');
    expect(html).toContain('Accessible Table Alternative');
    expect(html).toContain('Interactive map of streetlight outages');
    expect(html).toContain('Critical Outage Cluster (Poles Grouped)');
  });

  it('renders Resilience States: skeleton, offline banner, stale notice, empty, and permission denied', () => {
    const skeletonHtml = renderToStaticMarkup(<StreetlightSkeleton count={2} />);
    expect(skeletonHtml).toContain('streetlight-skeleton-grid');

    const offlineHtml = renderToStaticMarkup(<StreetlightOfflineBanner />);
    expect(offlineHtml).toContain('Viewing cached streetlight outage data');

    const staleHtml = renderToStaticMarkup(<StreetlightStaleNotice lastRefreshed="2026-11-16T10:00:00Z" onRefresh={() => {}} />);
    expect(staleHtml).toContain('Data last verified at:');
    expect(staleHtml).toContain('Refresh');

    const emptyHtml = renderToStaticMarkup(<StreetlightEmptyState title="No clusters found" message="No dark corridors active." />);
    expect(emptyHtml).toContain('No clusters found');

    const errorHtml = renderToStaticMarkup(<StreetlightErrorState error="Connection timed out" onRetry={() => {}} />);
    expect(errorHtml).toContain('Connection timed out');
    expect(errorHtml).toContain('Retry Request');

    const deniedHtml = renderToStaticMarkup(<StreetlightPermissionDenied requiredCapability="Operator" />);
    expect(deniedHtml).toContain('Access Restricted');

    const priorityBadge = renderToStaticMarkup(<StreetlightPriorityBadge tier="critical" score={85} />);
    expect(priorityBadge).toContain('CRITICAL');
    expect(priorityBadge).toContain('(85)');

    const statusBadge = renderToStaticMarkup(<StreetlightStatusBadge status="in_progress" type="cluster" />);
    expect(statusBadge).toContain('Repair In Progress');
  });
});
