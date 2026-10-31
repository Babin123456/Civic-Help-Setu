import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OfficeAccessibilityRatingModal from './OfficeAccessibilityRatingModal';

describe('OfficeAccessibilityRatingModal Component', () => {
  const sampleOffice = {
    id: 'off-test-1',
    name: 'District Sub-Registrar Office',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    accessibility: {
      wheelchairRamp: true,
      elevator: false,
      accessibleRestroom: true,
      accessibleParking: true,
      tactilePaving: false,
    },
  };

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <OfficeAccessibilityRatingModal isOpen={false} office={sampleOffice} />
    );
    expect(html).toBe('');
  });

  it('renders accessibility score, facility toggles, and modal structure', () => {
    const html = renderToStaticMarkup(
      <OfficeAccessibilityRatingModal isOpen={true} office={sampleOffice} />
    );

    expect(html).toContain('Physical Accessibility Audit');
    expect(html).toContain('District Sub-Registrar Office');
    expect(html).toContain('Overall Facility Accessibility Index');
    expect(html).toContain('Wheelchair Ramp');
    expect(html).toContain('Elevator / Lift');
    expect(html).toContain('Accessible Disabled-Friendly Restroom');
    expect(html).toContain('Submit Verified Audit');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
