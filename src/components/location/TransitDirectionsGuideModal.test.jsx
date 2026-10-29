import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TransitDirectionsGuideModal from './TransitDirectionsGuideModal';

describe('TransitDirectionsGuideModal', () => {
  const mockOffice = {
    id: 'off-1',
    name: 'Tehsil Seva Kendra Indiranagar',
    address: '100 Feet Road, HAL 2nd Stage',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
  };

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <TransitDirectionsGuideModal isOpen={false} onClose={() => {}} office={mockOffice} />
    );
    expect(html).toBe('');
  });

  it('renders transit instructions, metro/bus details and maps link when open', () => {
    const html = renderToStaticMarkup(
      <TransitDirectionsGuideModal isOpen={true} onClose={() => {}} office={mockOffice} />
    );
    expect(html).toContain('Transit &amp; Landmark Navigation Guide');
    expect(html).toContain('Tehsil Seva Kendra Indiranagar');
    expect(html).toContain('Nearest Metro / Railway Station');
    expect(html).toContain('Public Bus Connectivity');
    expect(html).toContain('Parking &amp; Senior Citizen Drop-off');
    expect(html).toContain('Open Navigation in Maps');
  });
});
