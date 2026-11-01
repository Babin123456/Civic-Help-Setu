import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PhysicalVisitDossierModal from './PhysicalVisitDossierModal.jsx';

describe('PhysicalVisitDossierModal (#434)', () => {
  it('returns null when isOpen is false or office is missing', () => {
    const html = renderToStaticMarkup(
      <PhysicalVisitDossierModal isOpen={false} office={{ name: 'RTO' }} onClose={() => {}} />
    );
    expect(html).toBe('');

    const htmlNoOffice = renderToStaticMarkup(
      <PhysicalVisitDossierModal isOpen={true} office={null} onClose={() => {}} />
    );
    expect(htmlNoOffice).toBe('');
  });

  it('renders modal title, dealing window, checklist, and actions', () => {
    const office = {
      id: 'off-1',
      name: 'RTO Koramangala',
      channel: 'physical_desk',
    };
    const service = {
      id: 'driving-license',
      name: 'Driving License Renewal',
    };

    const html = renderToStaticMarkup(
      <PhysicalVisitDossierModal
        isOpen={true}
        office={office}
        selectedService={service}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Physical Visit Dossier &amp; Checklist');
    expect(html).toContain('RTO Koramangala');
    expect(html).toContain('Driving License Renewal');
    expect(html).toContain('Dealing Window');
    expect(html).toContain('Required Documents &amp; Photocopy Sets');
    expect(html).toContain('Photograph Specifications');
    expect(html).toContain('Payment &amp; Change Preparation');
    expect(html).toContain('Essential Stationary Pack');
    expect(html).toContain('Citizen Protection Notice');
    expect(html).toContain('Copy Text Checklist');
    expect(html).toContain('Print Dossier');
  });

  it('customizes checklist for Passport Seva Kendra', () => {
    const office = {
      id: 'psk-1',
      name: 'Passport Seva Kendra Lalbagh',
    };

    const html = renderToStaticMarkup(
      <PhysicalVisitDossierModal isOpen={true} office={office} onClose={() => {}} />
    );

    expect(html).toContain('Biometric Live Capture at Counter');
    expect(html).toContain('Printed Application Receipt (ARN Sheet)');
  });
});
