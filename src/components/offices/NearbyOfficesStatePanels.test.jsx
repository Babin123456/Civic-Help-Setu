import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LocationPermissionPanel,
  NoOfficesResultsPanel
} from './NearbyOfficesStatePanels';

describe('NearbyOfficesStatePanels (#580)', () => {
  it('renders location permission request prompt cleanly', () => {
    const html = renderToStaticMarkup(
      <LocationPermissionPanel isDenied={false} />
    );

    expect(html).toContain('Find Government Centres Near You');
    expect(html).toContain('Use Current Location');
    expect(html).toContain('Search by State &amp; District');
    expect(html).toContain('coordinates remain strictly inside your browser');
  });

  it('renders denied location explanation without blocking search', () => {
    const html = renderToStaticMarkup(
      <LocationPermissionPanel isDenied={true} />
    );

    expect(html).toContain('Location Access Unavailable');
    expect(html).toContain('Don’t worry! You can still explore the entire directory');
    expect(html).toContain('Search by State &amp; District');
  });

  it('renders empty result state showing active filter tags', () => {
    const filters = { state: 'Delhi', district: 'New Delhi', officeType: 'Sub-Divisional Magistrate' };
    const html = renderToStaticMarkup(
      <NoOfficesResultsPanel activeFilters={filters} />
    );

    expect(html).toContain('No Matching Civic Offices Found');
    expect(html).toContain('State: Delhi');
    expect(html).toContain('District: New Delhi');
    expect(html).toContain('Reset All Filters');
  });
});
