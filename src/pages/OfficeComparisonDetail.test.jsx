import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OfficeComparisonDetail from './OfficeComparisonDetail';
import { ToastProvider } from '../context/ToastContext';

const render = (url) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Routes>
          <Route path="/office/:officeId" element={<OfficeComparisonDetail />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

describe('OfficeComparisonDetail (#824)', () => {
  it('shows the full office record with sources, accessibility and verification', () => {
    const html = render('/office/delhi-rto-sarai-kale-khan?service=driving-license');

    expect(html).toContain('Regional Transport Office (RTO) - Sarai Kale Khan');
    expect(html).toContain('Recorded service capabilities');
    expect(html).toContain('Driving License');
    expect(html).toContain('Capability source');
    expect(html).toContain('https://transport.delhi.gov.in');
    expect(html).toContain('Official contact channels');
    expect(html).toContain('Accessibility evidence');
    expect(html).toContain('Verification and jurisdiction');
    expect(html).toContain('Last verified');
    expect(html).toContain('2026-01-20');
    expect(html).toContain('Not shown — coordinates are not verified');
    expect(html).toContain('Suggestion, not an official decision');
    expect(html).toContain('Documents the service guide lists');
    expect(html).toContain('Valid Learner');
    expect(html).toContain('not a guarantee');
  });

  it('distinguishes recorded hours from a live open status', () => {
    const html = render('/office/delhi-rto-sarai-kale-khan?service=driving-license');
    expect(html).toContain('Recorded hours');
    expect(html).toContain('not a live open/closed status');
    expect(html).not.toContain('Currently open');
    expect(html).not.toContain('Open now');
  });

  it('offers a way back to the workspace with the service preserved', () => {
    const html = render('/office/delhi-rto-sarai-kale-khan?service=driving-license');
    expect(html).toContain('href="/comparison?service=driving-license"');
    expect(html).toContain('Back to comparison');
  });

  it('includes the privacy-safe report form and avoids an official-status claim', () => {
    const html = render('/office/delhi-rto-sarai-kale-khan?service=driving-license&report=1');
    expect(html).toContain('id="office-report"');
    expect(html).toContain('Report an outdated record');
    expect(html).toContain('Cancel and return');
    expect(html).toContain('not a government application status');
    expect(html).toContain('does not change the record immediately');
  });

  it('shows a recoverable not-found state for an unknown office', () => {
    const html = render('/office/not-a-real-office');
    expect(html).toContain('Office record not found');
    expect(html).toContain('Back to comparison');
    expect(html).toContain('href="/comparison"');
  });
});
