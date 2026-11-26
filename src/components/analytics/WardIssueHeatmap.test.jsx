import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import WardIssueHeatmap from './WardIssueHeatmap';
import { resetBudgetLedger } from '../../services/privacyBudgetService';
import { resetCivicReports } from '../../services/wardIssueHeatmapStorage';

describe('WardIssueHeatmap Component (#1163)', () => {
  beforeEach(() => {
    resetBudgetLedger();
    resetCivicReports();
  });

  it('renders heatmap table with accessible aria labels and headings', () => {
    const html = renderToString(<WardIssueHeatmap clientId="test-client-ui" />);
    expect(html).toContain('Ward-Level Civic Grievance Analytics');
    expect(html).toContain('table');
    expect(html).toContain('aria-label="Differentially Private Ward Grievance Table"');
    expect(html).toContain('Roads &amp; Potholes');
    expect(html).toContain('Drinking Water Supply');
  });

  it('renders privacy controls and statutory notice', () => {
    const html = renderToString(<WardIssueHeatmap clientId="test-client-ui" />);
    expect(html).toContain('How Privacy is Protected');
    expect(html).toContain('High Contrast');
    expect(html).toContain('Statutory Disclosure Notice:');
    expect(html).toContain('Section 13B of the Municipal Corporation Act');
  });

  it('renders suppressed badges for sparse cells', () => {
    const html = renderToString(<WardIssueHeatmap clientId="test-client-ui" />);
    expect(html).toContain('&lt; 5 (Suppressed)');
    expect(html).toContain('aria-label="Ward');
  });
});
