import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import RoadSafetyDashboard from './RoadSafetyDashboard';
import RoadSafetyCaseDetailModal from '../components/roadSafety/RoadSafetyCaseDetailModal';
import RoadSafetySiteInspectionModal from '../components/roadSafety/RoadSafetySiteInspectionModal';
import RoadSafetyInterventionModal from '../components/roadSafety/RoadSafetyInterventionModal';
import RoadSafetyTimelineComparatorModal from '../components/roadSafety/RoadSafetyTimelineComparatorModal';
import RoadSafetyHazardReportModal from '../components/roadSafety/RoadSafetyHazardReportModal';
import RoadSafetyRiskRunModal from '../components/roadSafety/RoadSafetyRiskRunModal';
import RoadSafetyInteractiveMap from '../components/roadSafety/RoadSafetyInteractiveMap';
import {
  RoadSafetySkeleton,
  RoadSafetyOfflineBanner,
  RoadSafetyStaleDataNotice,
  RoadSafetyErrorState,
  RoadSafetyPermissionDeniedState,
  RoadSafetyViewToggle,
} from '../components/roadSafety/RoadSafetyStates';
import { ToastProvider } from '../context/ToastContext';
import { SEED_ROAD_SEGMENTS, SEED_CRASH_AGGREGATES, SEED_ROAD_FEATURES } from '../data/roadSafetyContract';
import { setCurrentActor } from '../services/accessControl';

describe('RoadSafetyDashboard & Components (#769)', () => {
  let mockStore;

  beforeEach(() => {
    mockStore = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (mockStore.has(key) ? mockStore.get(key) : null),
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    });
    setCurrentActor({ id: 'admin-1', role: 'admin', username: 'Chief Safety Auditor' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCurrentActor(null);
  });

  const renderDashboard = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <ToastProvider>
          <RoadSafetyDashboard />
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('renders dashboard title, ethical non-fault notice, and monitored corridors', () => {
    const html = renderDashboard();

    expect(html).toContain('Road-Safety Blackspot Detection &amp; Evidence Review Dashboard');
    expect(html).toContain('Non-Fault Attribution Mandate:');
    expect(html).toContain('Monitored Corridors');
    expect(html).toContain('Priority 1 Blackspots');
    expect(html).toContain('NH-44 Outer Ring Road');
    expect(html).toContain('Western Express Highway');
  });

  it('renders Case Detail modal with geometry, crash history, and explainability factors', () => {
    const sampleCaseDetail = {
      id: 'case-seg-ka-blr-nh44-01',
      compositeRiskScore: 84,
      confidenceLevel: 'high',
      status: 'candidate',
      primaryRiskFactors: [
        '3 fatal crashes recorded in assessment window.',
        'Unlit night corridor (+8 infrastructure risk)',
      ],
      segment: SEED_ROAD_SEGMENTS[0],
      crashes: SEED_CRASH_AGGREGATES.slice(0, 1),
      feature: SEED_ROAD_FEATURES[0],
      inspectionRecords: [],
      interventionRecords: [],
    };

    const html = renderToStaticMarkup(
      <RoadSafetyCaseDetailModal
        caseDetail={sampleCaseDetail}
        onClose={() => {}}
        onTransitionState={() => {}}
      />
    );

    expect(html).toContain('NH-44 Outer Ring Road - Hebbal Flyover Down-Ramp');
    expect(html).toContain('Risk Score: 84/100');
    expect(html).toContain('Explainable Risk Assessment Factors');
    expect(html).toContain('3 fatal crashes recorded in assessment window.');
    expect(html).toContain('Speed Limit');
    expect(html).toContain('80 km/h');
    expect(html).toContain('State Machine &amp; Governance Transition');
  });

  it('renders Site Inspection modal with required form inputs and photo section', () => {
    const sampleCase = {
      id: 'case-seg-ka-blr-nh44-01',
      segment: SEED_ROAD_SEGMENTS[0],
    };

    const html = renderToStaticMarkup(
      <RoadSafetySiteInspectionModal
        selectedCase={sampleCase}
        onClose={() => {}}
        onSubmitInspection={() => {}}
      />
    );

    expect(html).toContain('Document Physical Site Inspection');
    expect(html).toContain('Physical Audit Findings &amp; Deficiencies');
    expect(html).toContain('Night Illumination Quality Observed');
    expect(html).toContain('Photographic Evidence Reference (HTTPS Only)');
  });

  it('renders Intervention Countermeasure modal with engineering specifications', () => {
    const sampleCase = {
      id: 'case-seg-ka-blr-nh44-01',
      segment: SEED_ROAD_SEGMENTS[0],
    };

    const html = renderToStaticMarkup(
      <RoadSafetyInterventionModal
        selectedCase={sampleCase}
        onClose={() => {}}
        onSubmitIntervention={() => {}}
      />
    );

    expect(html).toContain('Plan Engineering Countermeasure');
    expect(html).toContain('Statutory Countermeasure Type');
    expect(html).toContain('Thermoplastic Rumble Strips &amp; Bar Markings');
    expect(html).toContain('Estimated Cost (INR ₹)');
    expect(html).toContain('Executing Agency / Contractor');
  });

  it('renders Timeline Comparator modal for before/after outcome evaluation', () => {
    const html = renderToStaticMarkup(
      <RoadSafetyTimelineComparatorModal
        segments={SEED_ROAD_SEGMENTS}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Timeline &amp; Countermeasure Outcome Comparator');
    expect(html).toContain('Baseline Window (Period A)');
    expect(html).toContain('Post-Intervention Window (Period B)');
    expect(html).toContain('Select Road Corridor for Comparison');
  });

  it('renders Citizen Hazard Report modal with privacy guarantee callout', () => {
    const html = renderToStaticMarkup(
      <RoadSafetyHazardReportModal
        segments={SEED_ROAD_SEGMENTS}
        onClose={() => {}}
        onSubmitReport={() => {}}
      />
    );

    expect(html).toContain('Report Road Hazard or Defect');
    expect(html).toContain('Privacy Assurance:');
    expect(html).toContain('Hazard Category');
    expect(html).toContain('Potholes / Severe Surface Rutting');
  });

  it('renders Risk Run modal with factor sliders and deterministic notice', () => {
    const html = renderToStaticMarkup(
      <RoadSafetyRiskRunModal
        onClose={() => {}}
        onExecuteRun={() => {}}
      />
    );

    expect(html).toContain('Execute Automated Blackspot Risk Assessment');
    expect(html).toContain('Deterministic MoRTH Evaluation:');
    expect(html).toContain('Crash Frequency Weight');
    expect(html).toContain('Crash Severity Weight');
  });

  it('renders RoadSafetyInteractiveMap with SVG canvas, corridor pins, and legend', () => {
    const mockCases = [
      {
        id: 'case-seg-ka-blr-nh44-01',
        compositeRiskScore: 84,
        status: 'candidate',
        severityWeightedFrequency: 45.2,
        segment: SEED_ROAD_SEGMENTS[0],
      },
    ];

    const html = renderToStaticMarkup(
      <RoadSafetyInteractiveMap
        cases={mockCases}
        onSelectCase={() => {}}
      />
    );

    expect(html).toContain('Spatial Blackspot Distribution Map');
    expect(html).toContain('Priority 1');
    expect(html).toContain('Priority 2');
    expect(html).toContain('Priority 3');
    expect(html).toContain('84');
    expect(html).toContain('NH-44 Outer Ring Road');
    expect(html).toContain('Review Full Evidence');
  });

  it('renders RoadSafetyStates components: skeleton, offline banner, stale notice, error state, and view toggle', () => {
    const skeletonHtml = renderToStaticMarkup(<RoadSafetySkeleton />);
    expect(skeletonHtml).toContain('Loading road safety blackspot records...');

    const offlineHtml = renderToStaticMarkup(<RoadSafetyOfflineBanner pendingCount={2} />);
    expect(offlineHtml).toContain('Offline Mode Active');
    expect(offlineHtml).toContain('2 pending local entries');

    const staleHtml = renderToStaticMarkup(<RoadSafetyStaleDataNotice />);
    expect(staleHtml).toContain('Statutory Baseline:');
    expect(staleHtml).toContain('Ministry of Road Transport and Highways (MoRTH)');

    const errorHtml = renderToStaticMarkup(
      <RoadSafetyErrorState message="Network storage timeout" onRetry={() => {}} />
    );
    expect(errorHtml).toContain('Unable to Load Road Safety Data');
    expect(errorHtml).toContain('Network storage timeout');
    expect(errorHtml).toContain('Retry Data Recovery');

    const toggleHtml = renderToStaticMarkup(
      <RoadSafetyViewToggle activeView="table" onViewChange={() => {}} />
    );
    expect(toggleHtml).toContain('Evidence Table (Accessible)');
    expect(toggleHtml).toContain('Spatial Hotspot Map');

    const deniedHtml = renderToStaticMarkup(
      <RoadSafetyPermissionDeniedState
        requiredRole="Executive Road Safety Officer"
        onDismiss={() => {}}
      />
    );
    expect(deniedHtml).toContain('Access Restricted: Authorized Personnel Only');
    expect(deniedHtml).toContain('Executive Road Safety Officer');
    expect(deniedHtml).toContain('Return to Monitored Corridors');
  });

  it('renders RoadSafetyDashboard with view toggle, stale data notice, and summary metrics', () => {
    const html = renderDashboard();
    expect(html).toContain('Evidence Table (Accessible)');
    expect(html).toContain('Spatial Hotspot Map');
    expect(html).toContain('Statutory Baseline:');
    expect(html).toContain('Showing');
    expect(html).toContain('identified road corridors');
  });
});

