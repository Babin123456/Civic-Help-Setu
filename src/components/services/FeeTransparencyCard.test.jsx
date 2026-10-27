import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import FeeTransparencyCard from './FeeTransparencyCard';

const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorageMock();
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

describe('FeeTransparencyCard Component (#145)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  const renderComponent = (props) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <FeeTransparencyCard {...props} />
      </MemoryRouter>
    );

  it('renders prominent non-collection disclaimer avoiding implication of fee collection', () => {
    const html = renderComponent({ serviceId: 'passport', serviceName: 'New Passport Application' });

    expect(html).toContain('Civic Help Setu Does Not Collect Any Fees');
    expect(html).toContain('We provide verified informational guidance only');
    expect(html).toContain('Fee &amp; Cost Transparency Breakdown');
  });

  it('renders 100% Free Public Service badge and zero fee details for free services', () => {
    const html = renderComponent({ serviceId: 'voter-id', serviceName: 'Voter ID Registration' });

    expect(html).toContain('100% Free Public Service');
    expect(html).toContain('Official Government Charge');
    expect(html).toContain('Free');
    expect(html).toContain('Election Commission of India');
  });

  it('renders conditional tiers, optional charges, and gazette references for tiered services', () => {
    const html = renderComponent({ serviceId: 'passport', serviceName: 'New Passport Application' });

    // Status & Badges
    expect(html).toContain('Gazette Verified');

    // Tiers
    expect(html).toContain('Standard Adult Passport');
    expect(html).toContain('Tatkaal Scheme Fast-Track');
    expect(html).toContain('₹1,500');

    // Optional charges
    expect(html).toContain('Optional Third-Party Charges');
    expect(html).toContain('Passport Seva Kendra Premium Lounge Access');
    expect(html).toContain('SMS Status Alert Service Package');

    // Official Gazette Source Link
    expect(html).toContain('View Official Gazette Fee Table');
    expect(html).toContain('https://www.passportindia.gov.in');

    // Payment Channels
    expect(html).toContain('Authorized Payment Channels');
    expect(html).toContain('State Bank of India');
  });

  it('renders safe unverified notice without inventing numbers for unverified services', () => {
    const html = renderComponent({ serviceId: 'unverified-municipal-tax', serviceName: 'Municipal Property Tax' });

    expect(html).toContain('Fee Unverified');
    expect(html).toContain('Official Statutory Fee Not Verified');
    expect(html).toContain('A gazetted or centralized fee schedule is not verified on record');
    expect(html).toContain('Civic Help Setu will never estimate or guess fee figures');
  });

  it('renders review warning banner when fee schedule is expired', () => {
    const html = renderComponent({ serviceId: 'test-expired-scheme', serviceName: 'Municipal Temporary Utility Relief' });

    expect(html).toContain('Review Warning');
    expect(html).toContain('Published Schedule Due for Review');
    expect(html).toContain('past its 365-day review window');
  });
});
