import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SharedProfileView from './SharedProfileView';
import * as service from '../services/shareableProfileService';

describe('SharedProfileView Component (#455)', () => {
  it('renders read-only shared profile with security banner and verified citizen details', () => {
    vi.spyOn(service, 'getPublicSharedProfile').mockReturnValue({
      status: 'ACTIVE',
      profile: {
        fullName: 'Amina Begum',
        location: 'Kolkata, West Bengal',
        occupation: 'Craft Worker',
        readinessScore: 88,
        savedServices: [{ id: 's1', title: 'Artisan Credit Card' }],
        applicationMilestones: [{ serviceName: 'Artisan Credit Card', stage: 'Under Review' }],
      },
      createdAt: Date.now() - 3600000,
      expiresAt: Date.now() + 86400000,
      readOnly: true,
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SharedProfileView initialToken="mock-token-123" />
      </MemoryRouter>
    );

    expect(html).toContain('Amina Begum');
    expect(html).toContain('Privacy-Controlled Shared View');
    expect(html).toContain('Kolkata, West Bengal');
    expect(html).toContain('88%');
    expect(html).toContain('Artisan Credit Card');
    expect(html).toContain('Under Review');
  });

  it('renders revoked notice when profile has been revoked', () => {
    vi.spyOn(service, 'getPublicSharedProfile').mockReturnValue({
      status: 'REVOKED',
      error: 'Revoked by owner',
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SharedProfileView initialToken="mock-token-123" />
      </MemoryRouter>
    );

    expect(html).toContain('Shared Profile Link Revoked');
    expect(html).toContain('owner of this citizen profile has revoked public access');
  });
});
