import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';
import SyntheticDatasetWorkspace from './SyntheticDatasetWorkspace';
import ScenarioSelector from '../components/syntheticDataset/ScenarioSelector';
import PiiCertificationBadge from '../components/syntheticDataset/PiiCertificationBadge';
import DatasetInspectionTable from '../components/syntheticDataset/DatasetInspectionTable';
import SyntheticDatasetEmptyState from '../components/syntheticDataset/SyntheticDatasetEmptyState';
import { SYNTHETIC_SCENARIOS } from '../data/syntheticScenarios';
import { executeSyntheticGeneration } from '../services/syntheticGeneratorEngine';

describe('SyntheticDatasetWorkspace & Components (#778)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  const renderWorkspace = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <SyntheticDatasetWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('renders workspace header, description, and scenario presets', () => {
    const html = renderWorkspace();

    expect(html).toContain('Privacy-Safe Synthetic Civic Dataset Generator');
    expect(html).toContain('Development &amp; Testing');
    expect(html).toContain('1. Select Testing Scenario Preset');
    expect(html).toContain('Generate Synthetic Dataset');
  });

  it('renders scenario preset selector cards with metadata', () => {
    const selected = SYNTHETIC_SCENARIOS[0];
    const html = renderToStaticMarkup(
      <ScenarioSelector
        scenarios={SYNTHETIC_SCENARIOS}
        selectedProfile={selected}
        onSelectProfile={() => {}}
        onUpdateCustomProfile={() => {}}
      />
    );

    expect(html).toContain('Ward Grievance Backlog &amp; Escalation Surge');
    expect(html).toContain('Right to Services (RTS) Statutory Compliance Audit');
    expect(html).toContain('Customize Seed &amp; Volume');
  });

  it('renders zero-PII certification badge with watermark and k-anonymity score', () => {
    const artifactMeta = {
      artifactId: 'art-test-01',
      checksumSha256: '9f8b7a6c',
      kAnonymityScore: 6,
    };

    const html = renderToStaticMarkup(
      <PiiCertificationBadge artifactMeta={artifactMeta} />
    );

    expect(html).toContain('Zero-PII Compliance Certified');
    expect(html).toContain('SYNTH-CIVIC-SETU-v1');
    expect(html).toContain('9f8b7a6c');
    expect(html).toContain('k ≥ 6');
  });

  it('renders dataset inspection table with tabs for applications, grievances, services, and offices', () => {
    const bundle = executeSyntheticGeneration(SYNTHETIC_SCENARIOS[0]);
    const html = renderToStaticMarkup(
      <DatasetInspectionTable bundle={bundle} />
    );

    expect(html).toContain('Generated Civic Records Inspection');
    expect(html).toContain('Applications (');
    expect(html).toContain('Grievances (');
    expect(html).toContain('Services (');
    expect(html).toContain('Offices (');
    expect(html).toContain(bundle.applications[0].id);
  });

  it('renders empty state with quick launch buttons', () => {
    const html = renderToStaticMarkup(
      <SyntheticDatasetEmptyState onLaunchPreset={() => {}} />
    );

    expect(html).toContain('No Synthetic Dataset Generated Yet');
    expect(html).toContain('Generate Grievance Backlog Surge');
    expect(html).toContain('Generate RTS Compliance Audit');
  });
});
