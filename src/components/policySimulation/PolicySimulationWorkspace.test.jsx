import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PolicySimulationLoading,
  PolicySimulationEmpty,
  PolicySimulationError,
  PolicySimulationStale,
  PolicySimulationPermissionDenied,
} from './PolicySimulationStates';
import { ScenarioSelector } from './ScenarioSelector';
import { SimulationResults } from './SimulationResults';
import { SensitivityPanel } from './SensitivityPanel';
import { listScenarios, listPersonas, listServices, listOffices, listLevers } from '../../data/civicPolicySimulationData.js';

const scenarios = listScenarios();
const personas = listPersonas();
const services = listServices();
const offices = listOffices();
const levers = listLevers();

const baseline = scenarios.find((s) => s.id === 'scenario-baseline') || scenarios[0];

const fakeResult = {
  schemaVersion: 'civic-policy-simulation-v1',
  dataVersion: 'civic-policy-simulation-v1',
  reviewDate: '2026-11-20',
  staleAfterDays: 365,
  isStale: false,
  scenario: { id: 'scenario-baseline', title: 'Baseline', description: 'desc', expectedDirectionalEffects: [] },
  parameters: { personaIds: [], serviceIds: [], officeIds: [], leverIds: [], dayCount: 30, seed: 20261120 },
  reproducibilityDigest: 'psim-abcdef01',
  totals: {
    estimatedDailyDemand: 120,
    estimatedDailyInPersonVisits: 80,
    estimatedDailyOnlineDemand: 40,
    estimatedDailyTravelMinutes: 3600,
    averageDocumentBurden: 0.4,
  },
  byService: [
    {
      serviceId: 'service-income-certificate',
      serviceName: 'Income Certificate',
      category: 'certificate',
      estimatedDailyDemand: 40,
      estimatedDailyInPersonVisits: 40,
      estimatedDailyOnlineDemand: 0,
      estimatedDailyTravelMinutes: 1800,
      averageDocumentBurden: 0.5,
      onlineShare: 0,
      capacityMultiplier: 1,
    },
  ],
  byOffice: [
    {
      officeId: 'office-district-hq-south',
      officeName: 'District Headquarters - South',
      baseTravelMinutes: 45,
      adjustedTravelMinutes: 45,
      travelMinutesReduction: 0,
      capacityMultiplier: 1,
    },
  ],
  byPersona: [
    {
      personaId: 'persona-elderly-senior-citizen',
      archetype: 'elderly',
      label: 'Elderly citizen (limited mobility)',
      estimatedDemand: 0.3,
      averageTravelMinutes: 56,
      averageDocumentBurden: 0.6,
    },
  ],
  sensitivity: [
    { leverId: 'lever-online-ration-card', leverLabel: 'Enable online Ration Card applications', travelMinutesDelta: 0, demandDelta: 0, note: 'note' },
  ],
  uncertainty: { level: 'medium', isStale: false, lowConfidenceStatCount: 1, message: 'Mixed confidence aggregate inputs.' },
  aggregateValidation: { checks: [], passed: 0, total: 0, passRate: null, note: 'directional' },
  disclaimer: 'Illustrative agent-based scenario output.',
  illustrative: true,
  noIndividualPrediction: true,
};

describe('PolicySimulation states', () => {
  it('renders loading state', () => {
    const html = renderToStaticMarkup(<PolicySimulationLoading />);
    expect(html).toContain('Running simulation');
  });

  it('renders empty state', () => {
    const html = renderToStaticMarkup(<PolicySimulationEmpty />);
    expect(html).toContain('No scenario selected');
  });

  it('renders error state with message and retry', () => {
    const html = renderToStaticMarkup(<PolicySimulationError message="Boom" onRetry={() => {}} />);
    expect(html).toContain('Simulation error');
    expect(html).toContain('Boom');
    expect(html).toContain('Retry');
  });

  it('renders stale state', () => {
    const html = renderToStaticMarkup(<PolicySimulationStale notice="Data may be stale" />);
    expect(html).toContain('Data may be stale');
  });

  it('renders permission denied state', () => {
    const html = renderToStaticMarkup(<PolicySimulationPermissionDenied />);
    expect(html).toContain('Authentication required');
  });
});

describe('ScenarioSelector static markup', () => {
  it('renders scenario title and parameter groups', () => {
    const html = renderToStaticMarkup(
      <ScenarioSelector
        scenarios={scenarios}
        personas={personas}
        services={services}
        offices={offices}
        levers={levers}
        onParametersChange={() => {}}
        defaultScenarioId={baseline.id}
      />
    );
    expect(html).toContain('Configure scenario');
    expect(html).toContain(baseline.title);
    expect(html).toContain('Personas');
    expect(html).toContain('Services');
    expect(html).toContain('Offices');
    expect(html).toContain('Policy levers');
    expect(html).toContain('Run simulation');
  });

  it('renders lever chips with aria-pressed', () => {
    const html = renderToStaticMarkup(
      <ScenarioSelector
        scenarios={scenarios}
        personas={personas}
        services={services}
        offices={offices}
        levers={levers}
        onParametersChange={() => {}}
        defaultScenarioId={baseline.id}
      />
    );
    expect(html).toContain('aria-pressed');
  });
});

describe('SimulationResults static markup', () => {
  it('renders aggregate totals and tables', () => {
    const html = renderToStaticMarkup(<SimulationResults result={fakeResult} />);
    expect(html).toContain('Aggregate totals');
    expect(html).toContain('120');
    expect(html).toContain('By service');
    expect(html).toContain('Income Certificate');
    expect(html).toContain('By office');
    expect(html).toContain('By persona archetype');
    expect(html).toContain('Elderly citizen');
    expect(html).toContain('Illustrative');
  });

  it('renders disclaimer', () => {
    const html = renderToStaticMarkup(<SimulationResults result={fakeResult} />);
    expect(html).toContain('Illustrative agent-based scenario output');
  });
});

describe('SensitivityPanel static markup', () => {
  it('renders uncertainty, validation and sensitivity table', () => {
    const html = renderToStaticMarkup(<SensitivityPanel result={fakeResult} />);
    expect(html).toContain('Sensitivity');
    expect(html).toContain('uncertainty');
    expect(html).toContain('medium');
    expect(html).toContain('Aggregate validation');
    expect(html).toContain('Lever sensitivity');
    expect(html).toContain('Enable online Ration Card applications');
    expect(html).toContain('not establish causality');
  });
});
