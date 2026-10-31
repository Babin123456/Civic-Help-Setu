import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StatutoryCompensationClaimModal from './StatutoryCompensationClaimModal';
import { ToastProvider } from '../../context/ToastContext';

describe('StatutoryCompensationClaimModal', () => {
  const dummyApp = {
    id: 'APP-9988',
    serviceName: 'Income Certificate',
    serviceId: 'income-certificate',
    applicantName: 'Anil Deshmukh',
    status: 'delayed',
    appliedDate: '2026-08-01'
  };

  it('exports a valid React component function', () => {
    expect(typeof StatutoryCompensationClaimModal).toBe('function');
  });

  it('renders empty string when isOpen is false or application is null', () => {
    const htmlClosed = renderToStaticMarkup(
      <ToastProvider>
        <StatutoryCompensationClaimModal isOpen={false} onClose={() => {}} application={dummyApp} />
      </ToastProvider>
    );
    expect(htmlClosed).toBe('');

    const htmlNoApp = renderToStaticMarkup(
      <ToastProvider>
        <StatutoryCompensationClaimModal isOpen={true} onClose={() => {}} application={null} />
      </ToastProvider>
    );
    expect(htmlNoApp).toBe('');
  });

  it('renders modal dialog with claim breakdown and calculator when open', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <StatutoryCompensationClaimModal isOpen={true} onClose={() => {}} application={dummyApp} />
      </ToastProvider>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Statutory Delay Compensation Claim');
    expect(html).toContain('Claim Breakdown &amp; Calculator');
    expect(html).toContain('Prescribed SLA');
    expect(html).toContain('Net Claim Amount');
    expect(html).toContain('First Appellate Authority:');
  });
});
