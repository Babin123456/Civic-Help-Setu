/**
 * src/pages/WardIssueHeatmapWorkspace.test.jsx
 * Component tests for WardIssueHeatmapWorkspace (#763).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import WardIssueHeatmapWorkspace from './WardIssueHeatmapWorkspace';
import { resetWardIssueHeatmapData } from '../services/wardIssueHeatmapStorage.js';

describe('WardIssueHeatmapWorkspace Component (#763)', () => {
  beforeEach(() => {
    resetWardIssueHeatmapData();
  });

  const renderComponent = () => {
    return renderToString(<WardIssueHeatmapWorkspace />);
  };

  it('renders workspace title, municipal analytics banner, and primary actions', () => {
    const html = renderComponent();
    expect(html).toContain('Anonymized Ward-Level Civic Issue Heatmap &amp; Trend Explorer');
    expect(html).toContain('Municipal Aggregate Analytics');
    expect(html).toContain('Report Civic Issue');
    expect(html).toContain('Export CSV');
  });

  it('renders privacy transparency panel with active k-anonymity guarantee', () => {
    const html = renderComponent();
    expect(html).toContain('Anonymization Safeguards &amp; Privacy Thresholds');
    expect(html).toContain('k-Anonymity');
    expect(html).toContain('Sparse cohorts suppressed');
  });

  it('renders filters for search, category, zone, time window, and view modes', () => {
    const html = renderComponent();
    expect(html).toContain('Search ward name or code...');
    expect(html).toContain('All Issue Categories');
    expect(html).toContain('All Municipal Zones');
    expect(html).toContain('Heatmap Grid');
    expect(html).toContain('Accessible Table View');
    expect(html).toContain('Trend Comparison');
    expect(html).toContain('Explainable Interventions');
  });

  it('renders ward heatmap cards with counts and small-cell suppression', () => {
    const html = renderComponent();
    expect(html).toContain('Indiranagar');
    expect(html).toContain('Bellandur');
    expect(html).toContain('Koramangala');
  });

  it('renders role scoping simulator for testing public vs operator vs admin', () => {
    const html = renderComponent();
    expect(html).toContain('View Scope:');
    expect(html).toContain('Public Citizen (Aggregates Only)');
    expect(html).toContain('Municipal Operator (Triage &amp; Review)');
    expect(html).toContain('Administrator (Audit &amp; Full Access)');
  });
});

