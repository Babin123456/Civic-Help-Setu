import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OfficeReportForm from './OfficeReportForm';
import { ToastProvider } from '../../context/ToastContext';

const office = { id: 'delhi-rto-sarai-kale-khan', name: 'RTO Sarai Kale Khan' };

const render = (cancelHref = '') =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <OfficeReportForm office={office} cancelHref={cancelHref} />
      </ToastProvider>
    </MemoryRouter>
  );

describe('OfficeReportForm (#824)', () => {
  it('renders a labelled, non-sensitive outdated-record report form', () => {
    const html = render();

    expect(html).toContain('Report an outdated record');
    expect(html).toContain('for="report-reason"');
    expect(html).toContain('id="report-reason"');
    expect(html).toContain('What is wrong? (required)');
    expect(html).toContain('id="report-note"');
    expect(html).toContain('id="report-source"');
    expect(html).toContain('type="url"');
    expect(html).toContain('Submit report for review');
    expect(html).toContain('id="office-report"');
    expect(html).not.toContain('Cancel and return');
  });

  it('states the privacy limits and that review does not change the record immediately', () => {
    const html = render();
    expect(html).toContain('Do not include Aadhaar numbers, PAN numbers, passwords, OTPs');
    expect(html).toContain('does not change the record immediately');
  });

  it('does not render a status or error message before submission', () => {
    const html = render();
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('Submitting report');
  });

  it('offers a cancel-and-return action when the parent provides a return path', () => {
    const html = render('/comparison?service=driving-license');
    expect(html).toContain('Cancel and return');
    expect(html).toContain('href="/comparison?service=driving-license"');
  });
});
