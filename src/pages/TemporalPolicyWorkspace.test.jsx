import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TemporalPolicyWorkspace from './TemporalPolicyWorkspace';
import { resetRulesToDefault, clearEvaluationSnapshots } from '../services/temporalPolicyStorage';

describe('TemporalPolicyWorkspace Page Integration (#1155)', () => {
  beforeEach(() => {
    resetRulesToDefault();
    clearEvaluationSnapshots();
  });

  const renderComponent = () => {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={['/temporal-policy']}>
        <TemporalPolicyWorkspace />
      </MemoryRouter>
    );
  };

  it('renders the header title and non-legal advice statutory notice', () => {
    const html = renderComponent();
    expect(html).toContain('Effective-Dated Civic Rules &amp; As-Of Simulator');
    expect(html).toContain('Temporal Policy Engine (#1155)');
    expect(html).toContain('Official Advisory Notice:');
    expect(html).toContain('does NOT constitute legal advice');
  });

  it('renders selector controls for scheme family, jurisdiction, and as-of event date', () => {
    const html = renderComponent();
    expect(html).toContain('id="scheme-family-select"');
    expect(html).toContain('id="jurisdiction-select"');
    expect(html).toContain('id="event-date-type-select"');
    expect(html).toContain('id="event-date-input"');
  });

  it('renders four accessible tabs for simulator, timeline, anomalies, and audit ledger', () => {
    const html = renderComponent();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('As-Of Simulator &amp; Facts');
    expect(html).toContain('Version Timeline');
    expect(html).toContain('Timeline Anomalies');
    expect(html).toContain('Historical Audit Ledger');
  });

  it('renders applicant synthetic fact inputs for income, land, and bank seeding', () => {
    const html = renderComponent();
    expect(html).toContain('id="input-annual-income"');
    expect(html).toContain('id="input-land-acres"');
    expect(html).toContain('id="input-plot-yards"');
    expect(html).toContain('id="input-aadhaar-seed"');
  });

  it('renders an accessible screen reader announcement live region', () => {
    const html = renderComponent();
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
  });
});
