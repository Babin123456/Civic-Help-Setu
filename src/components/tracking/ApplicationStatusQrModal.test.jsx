import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicationStatusQrModal from './ApplicationStatusQrModal';

describe('ApplicationStatusQrModal Component (#458)', () => {
  const mockApp = {
    id: 'APP-1234',
    serviceName: 'Water Connection Sanction',
    status: 'Inspection Scheduled',
  };

  it('renders modal with QR code, service title, and security assurance', () => {
    const html = renderToStaticMarkup(
      <ApplicationStatusQrModal
        isOpen={true}
        onClose={() => {}}
        application={mockApp}
      />
    );

    expect(html).toContain('Application QR Status Pass');
    expect(html).toContain('Water Connection Sanction');
    expect(html).toContain('Opaque token protection:');
    expect(html).toContain('Rotate Token');
    expect(html).toContain('Deactivate Pass');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ApplicationStatusQrModal
        isOpen={false}
        onClose={() => {}}
        application={mockApp}
      />
    );

    expect(html).toBe('');
  });
});
