import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DirectoryEmptyState from './DirectoryEmptyState';

describe('DirectoryEmptyState component (#567)', () => {
  const renderEmptyState = (props = {}) => {
    return renderToStaticMarkup(<DirectoryEmptyState {...props} />);
  };

  describe('Scenario 1: Completely empty service catalogue', () => {
    it('renders empty catalogue heading and explanation when totalServices is 0', () => {
      const html = renderEmptyState({ totalServices: 0 });

      expect(html).toContain('No Civic Services Available');
      expect(html).toContain('There are currently no civic service guides listed in the directory');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-labelledby="directory-empty-title"');
    });

    it('does not render a misleading "Reset filters" or "Clear search" button when catalogue is empty', () => {
      const html = renderEmptyState({ totalServices: 0, onReset: vi.fn() });

      expect(html).not.toContain('Reset filters');
      expect(html).not.toContain('Reset all filters');
      expect(html).not.toContain('Clear search');
    });

    it('renders empty catalogue state when totalServices is unspecified and no search/filters active', () => {
      const html = renderEmptyState({ onReset: vi.fn() });

      expect(html).toContain('No Civic Services Available');
      expect(html).not.toContain('Reset filters');
    });

    it('does not show reset button even if query params are present when totalServices is 0', () => {
      const html = renderEmptyState({
        totalServices: 0,
        searchQuery: 'driver',
        activeCategory: 'Transport',
        hasActiveFilters: true,
        onReset: vi.fn(),
      });

      expect(html).toContain('No Civic Services Available');
      expect(html).not.toContain('Reset filters');
      expect(html).not.toContain('Clear search');
    });
  });

  describe('Scenario 2: No results because of search', () => {
    it('renders search empty state with search query and suggestions', () => {
      const html = renderEmptyState({
        totalServices: 10,
        searchQuery: 'nonexistent-service-123',
        onReset: vi.fn(),
        onClearSearch: vi.fn(),
      });

      expect(html).toContain('No Search Results Found');
      expect(html).toContain('nonexistent-service-123');
      expect(html).toContain('Check your query for spelling mistakes or typos');
    });

    it('provides a "Clear search" button and no "Reset filters" button when only search is active', () => {
      const html = renderEmptyState({
        totalServices: 10,
        searchQuery: 'passport',
        onReset: vi.fn(),
        onClearSearch: vi.fn(),
      });

      expect(html).toContain('Clear search');
      expect(html).not.toContain('Reset filters');
      expect(html).not.toContain('Reset all filters');
    });

    it('safely escapes special characters and does not output raw markup in search text', () => {
      const hostileQuery = '<script>alert("xss")</script>';
      const html = renderEmptyState({
        totalServices: 10,
        searchQuery: hostileQuery,
        onReset: vi.fn(),
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Scenario 3: No results because of active filters', () => {
    it('renders filter empty state with category and filter relaxation tips', () => {
      const html = renderEmptyState({
        totalServices: 10,
        activeCategory: 'Health',
        hasActiveFilters: true,
        onReset: vi.fn(),
      });

      expect(html).toContain('No Services Match Selected Filters');
      expect(html).toContain('within the Health category');
      expect(html).toContain('Expand your category, department, or jurisdiction filters');
      expect(html).toContain('Reset filters');
      expect(html).not.toContain('Clear search');
    });

    it('renders filter empty state when non-category filters are active', () => {
      const html = renderEmptyState({
        totalServices: 10,
        activeCategory: 'All',
        hasActiveFilters: true,
        onReset: vi.fn(),
      });

      expect(html).toContain('No Services Match Selected Filters');
      expect(html).toContain('Reset filters');
      expect(html).not.toContain('within the All category');
    });
  });

  describe('Scenario 4: Search query with active filters combined', () => {
    it('renders combined empty state with both "Clear search" and "Reset all filters" buttons', () => {
      const html = renderEmptyState({
        totalServices: 10,
        searchQuery: 'pension',
        activeCategory: 'Education',
        hasActiveFilters: true,
        onReset: vi.fn(),
        onClearSearch: vi.fn(),
      });

      expect(html).toContain('No Matching Services Found');
      expect(html).toContain('pension');
      expect(html).toContain('in the Education category');
      expect(html).toContain('Clear search');
      expect(html).toContain('Reset all filters');
    });
  });

  describe('Actions and event handler wiring', () => {
    it('triggers onClearSearch when Clear search action is invoked', () => {
      const onClearSearch = vi.fn();
      const onReset = vi.fn();

      const element = DirectoryEmptyState({
        totalServices: 10,
        searchQuery: 'aadhaar',
        onReset,
        onClearSearch,
      });

      // Find the Clear search button in the returned element tree
      const actionsContainer = element.props.children[3];
      const clearSearchBtn = actionsContainer.props.children[0];

      expect(clearSearchBtn.props['aria-label']).toBe('Clear search');
      clearSearchBtn.props.onClick();
      expect(onClearSearch).toHaveBeenCalledTimes(1);
      expect(onReset).not.toHaveBeenCalled();
    });

    it('falls back to onReset if onClearSearch is not provided for search empty state', () => {
      const onReset = vi.fn();

      const element = DirectoryEmptyState({
        totalServices: 10,
        searchQuery: 'aadhaar',
        onReset,
      });

      const actionsContainer = element.props.children[3];
      const clearSearchBtn = actionsContainer.props.children[0];

      clearSearchBtn.props.onClick();
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('triggers onReset when Reset filters action is invoked', () => {
      const onReset = vi.fn();

      const element = DirectoryEmptyState({
        totalServices: 10,
        hasActiveFilters: true,
        onReset,
      });

      const actionsContainer = element.props.children[3];
      const resetFiltersBtn = actionsContainer.props.children[1];

      expect(resetFiltersBtn.props['aria-label']).toBe('Reset filters');
      resetFiltersBtn.props.onClick();
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility and responsiveness', () => {
    it('has accessible status semantics, headings, and labelled buttons', () => {
      const html = renderEmptyState({
        totalServices: 10,
        hasActiveFilters: true,
        onReset: vi.fn(),
      });

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-labelledby="directory-empty-title"');
      expect(html).toContain('id="directory-empty-title"');
      expect(html).toContain('aria-label="Reset filters"');
      expect(html).toContain('aria-hidden="true"');
    });
  });
});

