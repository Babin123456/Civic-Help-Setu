import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VoluntaryProfileRecommendationPanel from './VoluntaryProfileRecommendationPanel';

describe('VoluntaryProfileRecommendationPanel', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    });
  });

  it('renders default anonymous mode with privacy safeguards', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VoluntaryProfileRecommendationPanel />
      </MemoryRouter>
    );

    expect(html).toContain('Voluntary Service Recommendations');
    expect(html).toContain('Anonymous Mode');
    expect(html).toContain('Privacy Safeguard:');
    expect(html).toContain('Enable Profile-Based Suggestions');
    expect(html).toContain('View Requirements');
  });

  it('displays active state when opted in with stored attributes', () => {
    store['civicbridge_voluntary_profile_opt_in'] = 'true';
    store['civicbridge_voluntary_profile_attrs'] = JSON.stringify({
      occupation: 'Farmer / Agriculture',
      state: 'Karnataka',
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VoluntaryProfileRecommendationPanel />
      </MemoryRouter>
    );

    expect(html).toContain('Active (Opted-in)');
    expect(html).toContain('Voluntary Service Recommendations');
  });
});

