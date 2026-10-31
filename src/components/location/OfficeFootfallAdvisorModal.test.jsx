import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import OfficeFootfallAdvisorModal from './OfficeFootfallAdvisorModal';

describe('OfficeFootfallAdvisorModal', () => {
  it('returns null when closed or without office', () => {
    const html1 = renderToString(<OfficeFootfallAdvisorModal isOpen={false} office={{ name: 'RTO Office' }} onClose={() => {}} />);
    expect(html1).toBe('');

    const html2 = renderToString(<OfficeFootfallAdvisorModal isOpen={true} office={null} onClose={() => {}} />);
    expect(html2).toBe('');
  });

  it('renders footfall modal with day selector, hourly slots, and wait recommendations', () => {
    const office = {
      id: 'off-1',
      name: 'Indiranagar RTO Facilitation Center',
      type: 'rto',
    };
    const html = renderToString(
      <OfficeFootfallAdvisorModal
        isOpen={true}
        office={office}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Peak Hours &amp; Queue Wait Time Advisor');
    expect(html).toContain('Indiranagar RTO Facilitation Center');
    expect(html).toContain('Recommended Visit Window');
    expect(html).toContain('Peak Rush Window');
    expect(html).toContain('11:00 AM');
    expect(html).toContain('mins wait');
    expect(html).toContain('Wednesday');
  });
});
