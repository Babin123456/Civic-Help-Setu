import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContinuityPlannerWorkspace from './ContinuityPlannerWorkspace';
import { LanguageProvider } from '../context/LanguageContext';
import { TabletopExerciseConductor } from '../components/continuity/TabletopExerciseConductor';
import { PrintableContinuityRunbook } from '../components/continuity/PrintableContinuityRunbook';
import { DependencyMatrixTable } from '../components/continuity/DependencyMatrixTable';
import { RecommendationCard } from '../components/continuity/RecommendationCard';
import { ActionItemsTracker } from '../components/continuity/ActionItemsTracker';
import { IncidentScenarioModal } from '../components/continuity/IncidentScenarioModal';
import { ContinuityPlanModal } from '../components/continuity/ContinuityPlanModal';
import {
  DEFAULT_CONTINUITY_PLANS,
  DEFAULT_SERVICE_DEPENDENCIES,
  DEFAULT_INCIDENT_SCENARIOS,
  EXERCISE_STATES,
  ACTION_ITEM_STATES,
} from '../services/continuityPlannerService';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin_test', email: 'officer@gov.in', role: 'admin' } }),
}));

let mockNetworkOnline = true;
vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: mockNetworkOnline }),
}));

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

const render = (path = '/continuity-planner') =>
  renderToStaticMarkup(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/continuity-planner" element={<ContinuityPlannerWorkspace />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );

describe('ContinuityPlannerWorkspace (#780)', () => {
  beforeEach(() => {
    memStore.clear();
    mockNetworkOnline = true;
  });

  it('renders workspace hero title, description, and offline runbook button', () => {
    const html = render();
    expect(html).toContain('Civic Incident Drill &amp; Continuity Planner');
    expect(html).toContain('Offline Runbook');
    expect(html).toContain('New Continuity Plan');
  });

  it('renders all primary workspace navigation tabs with accessible role attributes', () => {
    const html = render();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Continuity Plans &amp; BIA');
    expect(html).toContain('Dependency Graph &amp; SPOFs');
    expect(html).toContain('Tabletop Drills');
    expect(html).toContain('AAR &amp; Action Items');
    expect(html).toContain('Audit &amp; Compliance');
  });

  it('renders default continuity plan specifications with recovery objectives', () => {
    const html = render();
    expect(html).toContain('Ward 12 Essential Public Services Continuity Plan');
    expect(html).toContain('Target RTO (Disruption Tolerance)');
    expect(html).toContain('Target RPO (Max Data Gap)');
    expect(html).toContain('Emergency Escalation Call Tree');
  });

  it('renders offline warning banner when device is offline', () => {
    mockNetworkOnline = false;
    const html = render();
    expect(html).toContain('Offline Operating Mode Active');
    expect(html).toContain('Continuity runbooks and tabletop exercise decision logs remain fully operable');
  });
});

describe('Continuity Subcomponents Integrity (#780)', () => {
  it('renders PrintableContinuityRunbook with official seals, SOPs, and call tree', () => {
    const plan = DEFAULT_CONTINUITY_PLANS[0];
    const deps = DEFAULT_SERVICE_DEPENDENCIES;

    const html = renderToStaticMarkup(
      <PrintableContinuityRunbook plan={plan} dependencies={deps} onBack={vi.fn()} />
    );

    expect(html).toContain('CIVIC PUBLIC SERVICE CONTINUITY &amp; DISASTER RUNBOOK');
    expect(html).toContain('1. Core Recovery Objectives &amp; Resilience Thresholds');
    expect(html).toContain('2. Emergency Escalation Call Tree');
    expect(html).toContain('3. Offline Manual Operating Procedures (Zero-Connectivity SOPs)');
    expect(html).toContain('Incident Commander Signature');
    expect(html).toContain('Print Runbook');
  });

  it('renders DependencyMatrixTable with accessible search, tiers, and SPOF alerts', () => {
    const deps = DEFAULT_SERVICE_DEPENDENCIES;
    const services = deps.map((d) => ({ id: d.serviceId, name: d.serviceName }));

    const html = renderToStaticMarkup(
      <DependencyMatrixTable dependencies={deps} services={services} isAdmin={true} />
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('Service dependencies and recovery matrix');
    expect(html).toContain('Municipal Drinking Water Supply');
    expect(html).toContain('Tier 1 - Critical (≤4h)');
    expect(html).toContain('None (Single Point of Failure)');
  });

  it('renders TabletopExerciseConductor with timeline injects and recovery gap meters', () => {
    const scenario = DEFAULT_INCIDENT_SCENARIOS[0];
    const exerciseRun = {
      id: 'ex_test_1',
      title: 'Ransomware Drill',
      leadFacilitator: 'Facilitator Rao',
      status: EXERCISE_STATES.IN_PROGRESS,
      decisionLogs: [
        {
          id: 'dec_1',
          timestamp: new Date().toISOString(),
          injectIndex: 0,
          recordedDecision: 'Isolated substation network and invoked cold storage',
          responsibleOfficer: 'Facilitator Rao',
          delayMinutes: 15,
        },
      ],
      recoveryMetrics: {
        targetRTOHours: 4,
        actualEstimatedRTOHours: 4.25,
        gapHours: 0.25,
        serviceResilienceScore: 96,
      },
    };

    const html = renderToStaticMarkup(
      <TabletopExerciseConductor
        exerciseRun={exerciseRun}
        scenario={scenario}
        onRecordDecision={vi.fn()}
        onTransitionState={vi.fn()}
        isAdmin={true}
      />
    );

    expect(html).toContain('IN_PROGRESS');
    expect(html).toContain('Ransomware Drill');
    expect(html).toContain('Target RTO');
    expect(html).toContain('Estimated Restoration Time');
    expect(html).toContain('Service Resilience Score');
    expect(html).toContain('Recorded Decisions Journal (1)');
    expect(html).toContain('Isolated substation network');
  });

  it('renders RecommendationCard with ruleset version, explainable parameters, and human controls', () => {
    const recommendation = {
      id: 'rec_1',
      rulesetVersion: '1.0.0',
      executionTimestamp: new Date().toISOString(),
      type: 'SPOF_WARNING',
      severity: 'HIGH',
      targetServiceId: 'svc_power',
      targetServiceName: '33kV Substation',
      rationale: 'Substation lacks a redundant diesel backup generator',
      contributingFields: ['criticality', 'redundantAlternative'],
      suggestedRemediation: 'Procure standby 500kVA generator',
      status: 'PENDING',
    };

    const html = renderToStaticMarkup(
      <RecommendationCard recommendation={recommendation} onRecordDecision={vi.fn()} isPrivileged={true} />
    );

    expect(html).toContain('HIGH RISK');
    expect(html).toContain('Ruleset v1.0.0');
    expect(html).toContain('33kV Substation');
    expect(html).toContain('Substation lacks a redundant diesel backup generator');
    expect(html).toContain('criticality');
    expect(html).toContain('Accept Suggestion');
    expect(html).toContain('Modify SOP');
    expect(html).toContain('Dismiss');
  });

  it('renders ActionItemsTracker with status filters and advance state buttons', () => {
    const actionItems = [
      {
        id: 'act_1',
        title: 'Upgrade intake diesel generator capacity',
        ownerDepartment: 'Water Works',
        assignee: 'Officer Deshmukh',
        dueDate: '2026-12-01',
        status: ACTION_ITEM_STATES.OPEN,
        priority: 'URGENT',
      },
    ];

    const html = renderToStaticMarkup(
      <ActionItemsTracker actionItems={actionItems} onTransitionState={vi.fn()} isAdmin={true} />
    );

    expect(html).toContain('Filter by Status:');
    expect(html).toContain('URGENT');
    expect(html).toContain('Upgrade intake diesel generator capacity');
    expect(html).toContain('Dept: Water Works');
    expect(html).toContain('Officer Deshmukh');
    expect(html).toContain('Start Work');
  });

  it('renders IncidentScenarioModal with category selection and timeline inject builder', () => {
    const html = renderToStaticMarkup(
      <IncidentScenarioModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain('Create Custom Incident Drill Scenario');
    expect(html).toContain('Infrastructure Failure');
    expect(html).toContain('Cyber Incident / Ransomware');
    expect(html).toContain('Timeline Injects Sequence');
    expect(html).toContain('Initial Detection &amp; Alert');
  });

  it('renders ContinuityPlanModal with recovery objectives and call tree fields', () => {
    const html = renderToStaticMarkup(
      <ContinuityPlanModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain('Create Public Service Continuity Plan');
    expect(html).toContain('Recovery Objectives (RTO &amp; RPO)');
    expect(html).toContain('Target RTO (Hours to restore)');
    expect(html).toContain('Emergency Escalation Call Tree');
  });
});
