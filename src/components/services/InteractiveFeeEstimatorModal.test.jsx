import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import InteractiveFeeEstimatorModal from './InteractiveFeeEstimatorModal';

describe('InteractiveFeeEstimatorModal', () => {
  it('returns null when closed or without service', () => {
    const html1 = renderToString(<InteractiveFeeEstimatorModal isOpen={false} service={{ name: 'Passport' }} onClose={() => {}} />);
    expect(html1).toBe('');

    const html2 = renderToString(<InteractiveFeeEstimatorModal isOpen={true} service={null} onClose={() => {}} />);
    expect(html2).toBe('');
  });

  it('renders fee estimator modal with service name, concession options, and breakdown', () => {
    const service = {
      id: 'income-certificate',
      name: 'Income Certificate',
      fees: '₹50',
    };
    const html = renderToString(
      <InteractiveFeeEstimatorModal
        isOpen={true}
        service={service}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Interactive Cost &amp; Concession Calculator');
    expect(html).toContain('Income Certificate');
    expect(html).toContain('Citizen Concession Category');
    expect(html).toContain('BPL / Antyodaya Cardholder');
    expect(html).toContain('Speed Post Secure Document Dispatch');
    expect(html).toContain('Print Estimate Slip');
  });
});
