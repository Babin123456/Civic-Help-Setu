import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TrackingReceiptModal from './TrackingReceiptModal';

describe('TrackingReceiptModal component', () => {
  it('exports a valid React functional component', () => {
    expect(typeof TrackingReceiptModal).toBe('function');
  });

  it('renders nothing when closed or when app is missing', () => {
    const htmlClosed = renderToStaticMarkup(
      <TrackingReceiptModal isOpen={false} app={null} onClose={() => {}} />
    );
    expect(htmlClosed).toBe('');

    const htmlNoApp = renderToStaticMarkup(
      <TrackingReceiptModal isOpen={true} app={null} onClose={() => {}} />
    );
    expect(htmlNoApp).toBe('');
  });

  it('renders official submission receipt with deterministic verification seal and actions', () => {
    const sampleApp = {
      id: 'APP-TEST-99',
      serviceName: 'Aadhaar Address Update',
      applicantName: 'Sunita Sharma',
      appliedDate: '2026-10-20',
      estimatedCompletion: '2026-11-05',
      status: 'under-review'
    };

    const html = renderToStaticMarkup(
      <TrackingReceiptModal isOpen={true} app={sampleApp} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Official Submission Receipt');
    expect(html).toContain('REC-APP-TEST-99');
    expect(html).toContain('Sunita Sharma');
    expect(html).toContain('Aadhaar Address Update');
    expect(html).toContain('CB-SEAL-');
    expect(html).toContain('Print Slip');
    expect(html).toContain('Download Slip');
    expect(html).toContain('Copy Text');
  });
});
