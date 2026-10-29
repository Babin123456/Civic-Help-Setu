import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AvailabilityNoticeCard } from './ServiceAvailabilityNotice';

const notice = {
  id: 'n1',
  message: 'Portal down for announced maintenance.',
  startsAt: '2026-11-01T04:00:00.000Z',
  endsAt: '2026-11-02T04:00:00.000Z',
  ongoing: false,
  sourceName: 'UIDAI notice',
  sourceUrl: 'https://uidai.gov.in/notice',
  confirmed: true,
  updatedAt: '2026-10-29T04:00:00.000Z',
};

describe('AvailabilityNoticeCard', () => {
  it('shows source, times in IST, last updated and the confirmed label', () => {
    const html = renderToStaticMarkup(<AvailabilityNoticeCard notice={notice} serviceName="Aadhaar Card" />);
    expect(html).toContain('Confirmed by official announcement');
    expect(html).toContain('href="https://uidai.gov.in/notice"');
    expect(html).toContain('IST');
    expect(html).toContain('Last updated');
    expect(html).toContain('not checked automatically');
  });
  it('does not claim confirmation without an official link', () => {
    const html = renderToStaticMarkup(<AvailabilityNoticeCard notice={{ ...notice, sourceUrl: '' }} />);
    expect(html).toContain('Not yet confirmed');
    expect(html).not.toContain('<a ');
  });
  it('says ongoing when there is no end time and never renders an unsafe link', () => {
    const html = renderToStaticMarkup(<AvailabilityNoticeCard notice={{ ...notice, endsAt: '', ongoing: true, sourceUrl: 'javascript:alert(1)' }} />);
    expect(html).toContain('Ongoing');
    expect(html).not.toContain('javascript:');
  });
  it('renders the message as escaped text', () => {
    const html = renderToStaticMarkup(<AvailabilityNoticeCard notice={{ ...notice, message: '<img src=x onerror=1>' }} />);
    expect(html).not.toContain('<img');
  });
});
