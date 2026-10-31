import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import GrievanceEscalationAlertBanner from './GrievanceEscalationAlertBanner';

describe('GrievanceEscalationAlertBanner', () => {
  it('returns null if no application is passed', () => {
    const html = renderToString(<GrievanceEscalationAlertBanner application={null} />);
    expect(html).toBe('');
  });

  it('renders on-schedule timeline status for completed application', () => {
    const app = {
      id: 'APP-101',
      serviceName: 'Income Certificate',
      submissionDate: '2026-10-25',
      status: 'completed',
    };
    const html = renderToString(<GrievanceEscalationAlertBanner application={app} />);
    expect(html).toContain('On Schedule');
    expect(html).toContain('Statutory Timeline');
  });

  it('renders breach alert and sanitizes portal link via safeHttpUrl', () => {
    const app = {
      id: 'APP-102',
      serviceName: 'Income Certificate',
      submissionDate: '2026-08-01',
      status: 'in_progress',
    };
    const html = renderToString(<GrievanceEscalationAlertBanner application={app} citizenName="Test Citizen" />);
    expect(html).toContain('Statutory SLA Breached');
    expect(html).toContain('Official Portal');
    expect(html).toContain('https://');
    expect(html).not.toContain('javascript:');
  });
});
