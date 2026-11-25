import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import OpenContractingWorkspace from './OpenContractingWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import { resetOpenContractingData } from '../services/openContractingStorage.js';

describe('OpenContractingWorkspace (#751)', () => {
  beforeEach(() => {
    resetOpenContractingData();
  });

  const renderComponent = () => {
    return renderToString(
      <AuthProvider>
        <ToastProvider>
          <NetworkProvider>
            <OpenContractingWorkspace />
          </NetworkProvider>
        </ToastProvider>
      </AuthProvider>
    );
  };

  it('renders the header with Open Contracting Red-Flag Analytics title and mission', () => {
    const html = renderComponent();
    expect(html).toContain('Open Contracting Red-Flag Analytics');
    expect(html).toContain('Explainable oversight and anomaly detection for public procurement records');
    expect(html).toContain('without declaring wrongdoing');
  });

  it('renders summary KPI metrics for procurement audit overview', () => {
    const html = renderComponent();
    expect(html).toContain('Analyzed Notices');
    expect(html).toContain('Red-Flag Anomalies');
    expect(html).toContain('Single-Bid Awards');
    expect(html).toContain('Auditor Triage Progress');
  });

  it('renders filter controls and persona / role selector', () => {
    const html = renderComponent();
    expect(html).toContain('Analytics Filters &amp; Scopes');
    expect(html).toContain('Active Persona:');
    expect(html).toContain('All Jurisdictions');
    expect(html).toContain('All Categories');
    expect(html).toContain('All Severities');
    expect(html).toContain('All Review Statuses');
    expect(html).toContain('Reset Filters');
  });

  it('renders navigation tabs for anomaly triage, notices, vendors, and audit trail', () => {
    const html = renderComponent();
    expect(html).toContain('Flagged Anomalies');
    expect(html).toContain('Procurement Notices');
    expect(html).toContain('Vendor Concentration Risk');
    expect(html).toContain('Sealed Audit Trail');
  });

  it('renders explainable anomaly cards with comparison cohorts and non-accusatory guidance', () => {
    const html = renderComponent();
    expect(html).toContain('Single-Bid Award Pattern on Open Competitive Notice');
    expect(html).toContain('Comparison Cohort:');
    expect(html).toContain('Auditor Inquest Guidance:');
    expect(html).toContain('Inspect Lifecycle');
  });

  it('renders the accessible cohort matrix table alternative', () => {
    const html = renderComponent();
    expect(html).toContain('Accessible Procurement Distribution &amp; Anomaly Matrix');
    expect(html).toContain('Civil &amp; Public Works');
    expect(html).toContain('Goods &amp; Supplies');
  });
});
