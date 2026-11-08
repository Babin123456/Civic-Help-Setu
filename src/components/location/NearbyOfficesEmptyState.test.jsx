import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NearbyOfficesEmptyState from './NearbyOfficesEmptyState';

describe('NearbyOfficesEmptyState Component (#581)', () => {
  const defaultProps = {
    searchQuery: '',
    selectedState: '',
    selectedDistrict: '',
    selectedChannel: 'all',
    maxRadiusKm: 50,
    onlyOpenNow: false,
    onlyWheelchair: false,
    selectedFacilities: [],
    selectedLanguages: [],
    serviceFilter: '',
    userCoords: null,
    onResetFilters: vi.fn(),
    onExpandRadius: vi.fn(),
    onClearSearch: vi.fn(),
    onClearAccessibility: vi.fn(),
  };

  it('renders default empty state when location is not shared', () => {
    const html = renderToStaticMarkup(<NearbyOfficesEmptyState {...defaultProps} />);

    expect(html).toContain('No Matching Civic Facilitation Centers');
    expect(html).toContain('Without GPS location, results rely on state/district or keywords');
    expect(html).toContain('Reset all filters');
  });

  it('renders active filter chips when filters are applied', () => {
    const html = renderToStaticMarkup(
      <NearbyOfficesEmptyState
        {...defaultProps}
        searchQuery="passport"
        selectedState="Karnataka"
        onlyWheelchair={true}
      />
    );

    expect(html).toContain('Active filters narrowing these results');
    expect(html).toContain('Search: &quot;passport&quot;');
    expect(html).toContain('State: Karnataka');
    expect(html).toContain('Wheelchair Accessible Only');
  });

  it('renders expand radius button when user coordinates exist', () => {
    const html = renderToStaticMarkup(
      <NearbyOfficesEmptyState
        {...defaultProps}
        userCoords={{ lat: 12.97, lng: 77.59 }}
        maxRadiusKm={50}
      />
    );

    expect(html).toContain('Expand search radius to 100 km');
    expect(html).toContain('We could not find any facilitation centers within 50 km');
  });

  it('renders clear search button when search text exists', () => {
    const html = renderToStaticMarkup(
      <NearbyOfficesEmptyState
        {...defaultProps}
        searchQuery="aadhaar seva"
      />
    );

    expect(html).toContain('Clear search text');
  });
});
