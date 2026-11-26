import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import JurisdictionMap from './JurisdictionMap';
import TextOnlyHandOff from './TextOnlyHandOff';
import { SAMPLE_SERVICES } from '../../data/jurisdictionTestData';
import { ToastProvider } from '../../context/ToastContext';
import { ReducedMotionProvider } from '../../context/ReducedMotionContext';

describe('JurisdictionMap Component & Hand-off Visualizer (#815)', () => {
  const birthCertService = SAMPLE_SERVICES.find((s) => s.id === 'birth-certificate');

  const renderComponent = (ui) => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <ToastProvider>
          <ReducedMotionProvider>
            {ui}
          </ReducedMotionProvider>
        </ToastProvider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders correctly with service and locality', () => {
    it('renders map with service name and header info', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('Birth Certificate');
      expect(html).toContain('Jurisdiction Hand-off Map');
    });

    it('renders locality input field with default or provided value', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('id="locality-input"');
      expect(html).toContain('value="chennai"');
    });

    it('renders state selector with Indian States & UTs options', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('id="state-select"');
      expect(html).toContain('Tamil Nadu');
      expect(html).toContain('Uttar Pradesh');
    });
  });

  describe('hand-off graph and stages', () => {
    it('shows hand-off stages when jurisdiction is resolved', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="Tamil Nadu" />
      );

      expect(html).toContain('Tamil Nadu');
      expect(html).toContain('Official Portal');
    });

    it('shows ambiguity alert when jurisdiction is ambiguous', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="north delhi" initialState="Delhi" />
      );

      expect(html).toContain('Ambiguous jurisdiction');
      expect(html).toContain('Confirm jurisdiction');
    });

    it('shows unavailable notice when locality has no matching geometry', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="999999" initialState="All" />
      );

      expect(html).toContain('Jurisdiction unavailable');
    });
  });

  describe('plain language explanation and AI guardrails', () => {
    it('displays AI suggestion advisory label when unconfirmed', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('(AI suggestion');
    });

    it('displays official source provenance and effective date', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('Source Provenance');
      expect(html).toContain('Effective Boundary Date');
    });
  });

  describe('text-only alternative for accessibility', () => {
    it('renders text-only view when showTextOnly prop is true', () => {
      const html = renderComponent(
        <JurisdictionMap
          service={birthCertService}
          initialLocality="chennai"
          initialState="All"
          showTextOnly
        />
      );

      expect(html).toContain('Authority Hand-off Matrix Table');
      expect(html).toContain('table');
    });
  });

  describe('keyboard navigation and focusable elements', () => {
    it('provides accessible buttons and inputs with semantic aria-labels', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('aria-label="Locality or PIN code for jurisdiction resolution"');
      expect(html).toContain('aria-label="State / Union Territory"');
    });
  });

  describe('loading, empty, and permission states', () => {
    it('renders empty fallback when no service is selected', () => {
      const html = renderComponent(
        <JurisdictionMap service={null} initialLocality="" initialState="All" />
      );

      expect(html).toContain('No service selected');
    });

    it('renders permission-denied state when permissionDenied is true', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" permissionDenied={true} />
      );

      expect(html).toContain('Permission Denied');
      expect(html).toContain('lacks administrative permissions');
    });
  });

  describe('zoom controls and searchable authority list', () => {
    it('renders zoom controls with accessible aria labels', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('aria-label="Zoom in"');
      expect(html).toContain('aria-label="Zoom out"');
      expect(html).toContain('100%');
    });

    it('renders searchable authority filter input', () => {
      const html = renderComponent(
        <JurisdictionMap service={birthCertService} initialLocality="chennai" initialState="All" />
      );

      expect(html).toContain('aria-label="Search and filter authority list"');
      expect(html).toContain('placeholder="Search authorities..."');
    });
  });
});

describe('TextOnlyHandOff Component (#815)', () => {
  const birthCertService = SAMPLE_SERVICES.find((s) => s.id === 'birth-certificate');

  it('renders semantic table of hand-off authorities', () => {
    const html = renderToStaticMarkup(
      <ReducedMotionProvider>
        <TextOnlyHandOff
          service={birthCertService}
          locality="chennai"
          state="tamil-nadu"
          onClose={() => {}}
        />
      </ReducedMotionProvider>
    );

    expect(html).toContain('Jurisdiction Hand-off Journey');
    expect(html).toContain('Authority');
    expect(html).toContain('Role &amp; Responsibilities');
    expect(html).toContain('Contact &amp; Escalation');
  });

  it('renders source provenance metadata in text-only mode', () => {
    const html = renderToStaticMarkup(
      <ReducedMotionProvider>
        <TextOnlyHandOff
          service={birthCertService}
          locality="chennai"
          state="tamil-nadu"
          onClose={() => {}}
        />
      </ReducedMotionProvider>
    );

    expect(html).toContain('Source Provenance');
    expect(html).toContain('Effective Boundary Date');
  });
});
