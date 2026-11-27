import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import CivicWorkflowDigitalTwinWorkspace from './CivicWorkflowDigitalTwinWorkspace';
import { resetDigitalTwinStorage } from '../services/digitalTwinStorage';

describe('CivicWorkflowDigitalTwinWorkspace (#1157)', () => {
  beforeEach(() => {
    resetDigitalTwinStorage();
  });

  const renderComponent = () => {
    return renderToString(<CivicWorkflowDigitalTwinWorkspace />);
  };

  it('renders the header and statutory boundary notice', () => {
    const html = renderComponent();
    expect(html).toContain('Civic Workflow Digital Twin');
    expect(html).toContain('Statutory Boundary &amp; Synthetic Model Notice');
    expect(html).toContain('100% synthetic models');
    expect(html).toContain('does not access live citizen files');
  });

  it('renders workflow selection controls with initial seed workflows', () => {
    const html = renderComponent();
    expect(html).toContain('Baseline Workflow (Live / Benchmark)');
    expect(html).toContain('Candidate Workflow (Draft Revision to Verify)');
    expect(html).toContain('Income and Asset Certificate (Baseline 2025)');
    expect(html).toContain('Synthetic Test Persona / Cohort');
  });

  it('renders synthetic personas in selector dropdown without any real citizen PII', () => {
    const html = renderComponent();
    expect(html).toContain('Full Synthetic Cohort');
    expect(html).toContain('Synthetic Citizen: Priya Sharma');
    expect(html).toContain('Synthetic Citizen: Rajesh Mahto');
    expect(html).toContain('Synthetic Citizen: Devaki Amma');
    expect(html).toContain('Synthetic Citizen: Karthik Sundaram');
  });

  it('renders action triggers for simulation and version comparison', () => {
    const html = renderComponent();
    expect(html).toContain('Run Journey Simulation');
    expect(html).toContain('Compare Old vs New Versions');
    expect(html).toContain('Export Scenario');
  });

  it('renders graph integrity verification status', () => {
    const html = renderComponent();
    expect(html).toContain('Workflow Graph Integrity: Verified (No Dead-Ends or Cycles)');
  });

  it('renders WCAG-accessible inspection table and visual flow view toggles', () => {
    const html = renderComponent();
    expect(html).toContain('Accessible Table (WCAG)');
    expect(html).toContain('Visual Journey Flow');
  });
});
