import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import JurisdictionHandoffWorkspace from './JurisdictionHandoffWorkspace';
import { ToastProvider } from '../context/ToastContext';
import { ReducedMotionProvider } from '../context/ReducedMotionContext';

describe('JurisdictionHandoffWorkspace Page (#815)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return renderToString(
      <MemoryRouter initialEntries={['/jurisdiction-handoff?service=birth-certificate&locality=chennai']}>
        <ToastProvider>
          <ReducedMotionProvider>
            <JurisdictionHandoffWorkspace />
          </ReducedMotionProvider>
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('renders workspace title, status disclaimer, and authority navigator', () => {
    const html = renderComponent();

    expect(html).toContain('Jurisdiction Hand-Off Map &amp; Authority Navigator');
    expect(html).toContain('Workspace Planning Mode (Not an Official Government Application)');
    expect(html).toContain('Multi-Authority Architecture #815');
  });

  it('renders service selector and toolbar controls', () => {
    const html = renderComponent();

    expect(html).toContain('Select Multi-Authority Service:');
    expect(html).toContain('Accessible Text-Only View');
    expect(html).toContain('Save Progress');
  });

  it('renders child map and hand-off components', () => {
    const html = renderComponent();

    expect(html).toContain('Jurisdiction Hand-off Map');
    expect(html).toContain('id="locality-input"');
    expect(html).toContain('Maintained Jurisdiction Data &amp; Source Provenance');
  });
});
