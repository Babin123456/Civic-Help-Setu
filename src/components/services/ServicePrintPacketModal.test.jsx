import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServicePrintPacketModal from './ServicePrintPacketModal';

describe('ServicePrintPacketModal', () => {
  const mockService = {
    title: 'Income Certificate',
    category: 'Revenue & Social Welfare',
    processingTime: '15 Days',
    documents: ['Aadhaar Card', 'Ration Card', 'Salary Slip'],
  };

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <ServicePrintPacketModal isOpen={false} onClose={() => {}} service={mockService} />
    );
    expect(html).toBe('');
  });

  it('renders service details, checklist table and CSC slip when open', () => {
    const html = renderToStaticMarkup(
      <ServicePrintPacketModal isOpen={true} onClose={() => {}} service={mockService} />
    );
    expect(html).toContain('Physical Application Packet Checklist');
    expect(html).toContain('Income Certificate');
    expect(html).toContain('Aadhaar Card');
    expect(html).toContain('Ration Card');
    expect(html).toContain('Salary Slip');
    expect(html).toContain('CSC / Tehsil Submission Acknowledgement Slip');
    expect(html).toContain('Photograph Specs');
    expect(html).toContain('Print Checklist Packet');
  });

  it('falls back to default civic documents when service has no specific documents', () => {
    const html = renderToStaticMarkup(
      <ServicePrintPacketModal isOpen={true} onClose={() => {}} service={{ title: 'General Service' }} />
    );
    expect(html).toContain('Physical Application Packet Checklist');
    expect(html).toContain('Aadhaar Card (Original &amp; 2 self-attested photocopies)');
  });
});
