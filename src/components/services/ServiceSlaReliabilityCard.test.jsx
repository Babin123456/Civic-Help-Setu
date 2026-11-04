import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceSlaReliabilityCard from './ServiceSlaReliabilityCard.jsx';

describe('ServiceSlaReliabilityCard (#431)', () => {
  it('renders heading, timeline details, and confidence rating', () => {
    const service = {
      id: 'income-certificate',
      name: 'Income Certificate',
      timeRequired: '15 to 21 working days',
    };

    const html = renderToStaticMarkup(<ServiceSlaReliabilityCard service={service} />);
    expect(html).toContain('Turnaround &amp; SLA Delivery Forecast');
    expect(html).toContain('Reliability');
    expect(html).toContain('ESTIMATED COMPLETION DATE');
    expect(html).toContain('Citizen Service Guarantee Deadline');
  });

  it('displays digital fulfillment channel for certificate services', () => {
    const service = {
      id: 'birth-certificate',
      name: 'Birth Certificate',
      timeRequired: '7 days',
    };

    const html = renderToStaticMarkup(<ServiceSlaReliabilityCard service={service} />);
    expect(html).toContain('Digital Download / DigiLocker');
    expect(html).toContain('Fulfillment Channel');
  });

  it('displays postal dispatch buffer for physical passport and card services', () => {
    const service = {
      id: 'passport',
      name: 'Passport Re-issue',
      timeRequired: '15 to 30 days',
    };

    const html = renderToStaticMarkup(<ServiceSlaReliabilityCard service={service} />);
    expect(html).toContain('Speed Post / Registered Dispatch');
  });

  it('renders default fallback data when service object is minimal or missing timeline', () => {
    const service = { id: 'unknown-service' };
    const html = renderToStaticMarkup(<ServiceSlaReliabilityCard service={service} />);
    expect(html).toContain('Turnaround &amp; SLA Delivery Forecast');
    expect(html).toContain('If applied / submitted on:');
    expect(html).toContain('Reset to Today');
  });
});
