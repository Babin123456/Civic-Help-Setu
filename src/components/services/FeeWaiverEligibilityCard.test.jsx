import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FeeWaiverEligibilityCard from './FeeWaiverEligibilityCard.jsx';

describe('FeeWaiverEligibilityCard (#433)', () => {
  it('renders card title, category selector pills, and pricing breakdown', () => {
    const service = {
      id: 'income-certificate',
      name: 'Income Certificate',
      fees: '₹50',
    };

    const html = renderToStaticMarkup(<FeeWaiverEligibilityCard service={service} />);
    expect(html).toContain('Statutory Fee Waiver &amp; Concession Checker');
    expect(html).toContain('BPL / AAY');
    expect(html).toContain('PwD / UDID');
    expect(html).toContain('Senior Citizen');
    expect(html).toContain('Standard Department Tariff');
    expect(html).toContain('Net Payable Fee');
  });

  it('renders required proof and safety tip guidance', () => {
    const service = {
      id: 'driving-license',
      name: 'Driving License Renewal',
      fees: '₹200',
    };

    const html = renderToStaticMarkup(<FeeWaiverEligibilityCard service={service} />);
    expect(html).toContain('Required Proof Document');
    expect(html).toContain('Never hand over original proof documents');
    expect(html).toContain('Statutory Rule');
  });

  it('handles zero-fee services cleanly', () => {
    const service = {
      id: 'free-service',
      name: 'PM-Kisan Scheme',
      fees: 'Free',
    };

    const html = renderToStaticMarkup(<FeeWaiverEligibilityCard service={service} />);
    expect(html).toContain('FREE / ₹0');
    expect(html).toContain('free of charge');
  });
});
