import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AppellateEscalationLadder from './AppellateEscalationLadder';

describe('AppellateEscalationLadder Component', () => {
  const renderComponent = (props) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <AppellateEscalationLadder {...props} />
      </MemoryRouter>
    );

  it('renders nothing when application is null', () => {
    const html = renderComponent({ application: null });
    expect(html).toBe('');
  });

  it('renders 3-tier escalation ladder for within-SLA application', () => {
    const freshApp = {
      id: 'APP-100',
      serviceId: 'income-certificate',
      submissionDate: new Date().toISOString(),
    };

    const html = renderComponent({ application: freshApp });

    expect(html).toContain('Statutory Redressal &amp; Appellate Hierarchy Ladder');
    expect(html).toContain('Tier 1 In Progress');
    expect(html).toContain('Designated Public Officer / Service Desk');
    expect(html).toContain('First Appellate Authority (FAA)');
    expect(html).toContain('Second Appellate Authority (SAA)');
  });

  it('highlights overdue escalation status and appeal copy button when breached', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 40);

    const breachedApp = {
      id: 'APP-200',
      serviceId: 'income-certificate',
      submissionDate: pastDate.toISOString(),
    };

    const html = renderComponent({ application: breachedApp });

    expect(html).toContain('Tier 2 Active');
    expect(html).toContain('Current Jurisdiction');
    expect(html).toContain('Copy Appeal Petition Text');
  });

  it('has accessible role and label', () => {
    const app = {
      id: 'APP-300',
      serviceId: 'driving-license',
      submissionDate: new Date().toISOString(),
    };

    const html = renderComponent({ application: app });
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Statutory Appellate Authority Hierarchy Ladder"');
  });
});

