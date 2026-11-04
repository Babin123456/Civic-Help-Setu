import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PublicApplicationStatusView from './PublicApplicationStatusView';
import * as qrService from '../services/applicationStatusQrService';

describe('PublicApplicationStatusView Component (#458)', () => {
  it('renders read-only milestone status without private personal identifiers', () => {
    vi.spyOn(qrService, 'resolvePublicStatusByToken').mockReturnValue({
      status: 'ACTIVE',
      application: {
        serviceName: 'Senior Citizen Pension Grant',
        department: 'Social Welfare Department',
        stage: 'Document Verification',
        submissionDate: '2026-10-12',
        expectedResolution: '15 business days',
        milestones: [
          { label: 'Application Submitted', status: 'COMPLETED' },
          { label: 'Aadhaar e-KYC Verification', status: 'IN_PROGRESS' },
        ],
      },
      expiresAt: Date.now() + 864000000,
      readOnly: true,
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PublicApplicationStatusView initialToken="token-abc-123" />
      </MemoryRouter>
    );

    expect(html).toContain('Senior Citizen Pension Grant');
    expect(html).toContain('Privacy-Safe Status View');
    expect(html).toContain('Document Verification');
    expect(html).toContain('Aadhaar e-KYC Verification');
    expect(html).toContain('Social Welfare Department');

    // Confirm sensitive fields do not render
    expect(html).not.toContain('Aadhaar Number');
    expect(html).not.toContain('Phone');
  });

  it('renders deactivated message for revoked tokens', () => {
    vi.spyOn(qrService, 'resolvePublicStatusByToken').mockReturnValue({
      status: 'REVOKED',
      error: 'This lookup QR code has been rotated or deactivated',
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PublicApplicationStatusView initialToken="revoked-token" />
      </MemoryRouter>
    );

    expect(html).toContain('QR Status Pass Deactivated');
    expect(html).toContain('rotated or deactivated');
  });
});
