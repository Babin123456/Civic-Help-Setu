import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import WardAnalyticsDashboard from './WardAnalyticsDashboard';
import { resetBudgetLedger } from '../services/privacyBudgetService';
import { resetCivicReports } from '../services/wardIssueHeatmapStorage';

describe('WardAnalyticsDashboard (#1163)', () => {
  beforeEach(() => {
    resetBudgetLedger();
    resetCivicReports();
  });

  const renderPage = () => {
    return renderToString(
      <MemoryRouter initialEntries={['/ward-analytics']}>
        <WardAnalyticsDashboard />
      </MemoryRouter>
    );
  };

  it('renders page header, title, and breadcrumb navigation', () => {
    const html = renderPage();
    expect(html).toContain('Municipal Ward Civic Analytics');
    expect(html).toContain('Back to Home');
    expect(html).toContain('Differential Privacy');
  });

  it('renders filter controls for ward, window, and privacy epsilon', () => {
    const html = renderPage();
    expect(html).toContain('Ward:');
    expect(html).toContain('Aggregation Window:');
    expect(html).toContain('Privacy Budget');
    expect(html).toContain('Apply Filters');
  });

  it('renders statutory municipal disclaimer with Section 13B citation', () => {
    const html = renderPage();
    expect(html).toContain('Statutory Disclosure Notice:');
    expect(html).toContain('Section 13B of the Municipal Corporation Act');
    expect(html).toContain('DPDP Act 2023');
  });

  it('renders privacy protection metrics and suppression indicators', () => {
    const html = renderPage();
    expect(html).toContain('Session Privacy Budget');
    expect(html).toContain('Protected Sparse Cells');
    expect(html).toContain('95% Confidence Bounds');
    expect(html).toContain('Suppressed');
  });
});
