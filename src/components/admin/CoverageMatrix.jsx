/**
 * CoverageMatrix - sortable coverage matrix across services.
 *
 * Shows a table where:
 * - Rows = service records
 * - Columns = coverage fields
 * - Cell colors = state (missing/draft/verified/stale/conflicting)
 * - Last column = overall quality score
 * - First column = service name/link
 * - Can be sorted by any column
 *
 * Also includes filter controls for category, jurisdiction, and publication state.
 *
 * Accessibility:
 * - Keyboard-navigable (focus rows, navigate with arrow keys)
 * - Semantic table markup with scope attributes
 * - Visible focus outlines
 * - Summary attribute describing the table
 * - Essential info (state, field) available without hover
 * - Sortable column headers have keyboard activation
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ENHANCED_COVERAGE_RULES, 
  STATES, 
  STATE_LABELS, 
  STATE_COLORS, 
  SEVERITY_LABELS 
} from '../../services/catalogueCoverage.enhanced';
import { analyzeEnhancedCoverage } from '../../services/catalogueCoverage.enhanced';
import { getAllServices } from '../../services/serviceCatalog';
import { SEVERITIES } from '../../services/catalogueCoverage';

const SortableHeader = ({ label, onSort, currentSort, direction, ...props }) => {
  const arrow = direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '';
  const isSorted = currentSort && currentSort.field === label;

  return (
    <th
      scope="col"
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(label)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(label);
        }
      }}
      tabIndex={0}
      role="button"
      aria-sort={isSorted ? direction : 'none'}
      aria-label={`Sort by ${label}, ${direction} order`}
    >
      {label} {arrow}
    </th>
  );
};

/**
 * CoverageMatrix - displays coverage state across all services as a sortable matrix.
 *
 * Props:
 *   services: service records to display (defaults to full catalogue)
 *   initialFilters: initial filter state { category, jurisdiction, publicationState }
 *   onEditService: (id) => void - opens service record editor
 *   onSegmentSelect: (serviceId, field, state) => void - called when a cell state is selected/filtered
 *   showSummary: boolean - whether to show summary stats
 */
const CoverageMatrix = ({
  services,
  initialFilters = {},
  onEditService,
  onSegmentSelect,
  showSummary = true,
}) => {
  const [filters, setFilters] = useState({ ...initialFilters });
  const [sort, setSort] = useState({ field: 'name', direction: 'asc' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load data when services change or filters change
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    try {
      const allServices = services ?? getAllServices();
      const result = analyzeEnhancedCoverage(allServices, ENHANCED_COVERAGE_RULES);

      // Apply filters
      const { records } = result;
      let filtered = records;

      if (filters.category && filters.category !== 'All') {
        filtered = filtered.filter((r) => r.category === filters.category);
      }
      if (filters.jurisdiction && filters.jurisdiction !== 'All') {
        filtered = filtered.filter((r) => r.jurisdiction === filters.jurisdiction);
      }
      if (filters.publicationState && filters.publicationState !== 'All') {
        filtered = filtered.filter((r) => r.publicationState === filters.publicationState);
      }

      // Store analyzed data for sorting/filtering
      // We'll keep it in state for the component's lifetime
      // Actually, let's recompute on re-render or use useMemo

      // For now, just store the filtered records
      // The full analysis is done in the onSegmentSelect handler
      // and in the parent component

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coverage data');
      console.error('CoverageMatrix load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [services, filters.category, filters.jurisdiction, filters.publicationState]);

  // Re-analyze whenever filters or services change
  const allServices = services ?? getAllServices();
  const analysis = useState(() => analyzeEnhancedCoverage(allServices, ENHANCED_COVERAGE_RULES));
  const records = analysis[0].records.filter((r) => {
    if (filters.category && filters.category !== 'All') {
      if (r.category !== filters.category) return false;
    }
    if (filters.jurisdiction && filters.jurisdiction !== 'All') {
      if (r.jurisdiction !== filters.jurisdiction) return false;
    }
    if (filters.publicationState && filters.publicationState !== 'All') {
      if (r.publicationState !== filters.publicationState) return false;
    }
    return true;
  });

  // Sort records
  const sortedRecords = [...records].sort((a, b) => {
    const aVal = a[sort.field] || '';
    const bVal = b[sort.field] || '';
    const comparison = aVal.localeCompare(bVal);
    return sort.direction === 'desc' ? -comparison : comparison;
  });

  // Build matrix data: rows = services, columns = fields
  const matrixRows = sortedRecords.map((record) => {
    const row = { ...record };

    // Add state cells for each rule
    const stateCells = ENHANCED_COVERAGE_RULES.map((rule) => {
      const state = record.fieldStates?.[rule.field] || 'missing';
      return {
        field: rule.field,
        label: rule.label,
        state,
        color: STATE_COLORS[state] || '#64748b',
        severity: rule.severity,
        weight: rule.weight,
        isBlocker: rule.level === 'required',
      };
    });

    row.stateCells = stateCells;
    return row;
  });

  // Compute summary stats
  const totalRecords = matrixRows.length;
  const completeRecords = matrixRows.filter((r) => r.score === 100).length;
  const avgScore = totalRecords > 0
    ? Math.round(matrixRows.reduce((sum, r) => sum + r.score, 0) / totalRecords)
    : 100;

  // State counts overall
  const stateTotals = { missing: 0, draft: 0, verified: 0, stale: 0, conflicting: 0 };
  matrixRows.forEach((record) => {
    STATES.forEach((state) => {
      const fieldCount = ENCHANCED_COVERAGE_RULES.length;
      for (const rule of ENCHANCED_COVERAGE_RULES) {
        if (record.fieldStates?.[rule.field] === state) {
          stateTotals[state] += 1 / fieldCount; // normalize
        }
      }
    });
  });

  // Available sort options
  const sortOptions = ['name', 'category', 'jurisdiction', 'score', 'averageState']
    .map((field) => ({ field, label: field.replace(/([a-z])(?=[A-Z])/g, '$1 ').trim() }));

  // Handle segment click (cell interaction)
  const handleCellClick = (recordId, field, state) => {
    if (onSegmentSelect) {
      onSegmentSelect(recordId, field, state);
    }
  };

  // Build column headers
  const columnHeaders = [
    { field: 'name', label: 'Service', sort: true },
    ...ENHANCED_COVERAGE_RULES.map((rule) => ({
      field: `state_${rule.field}`,
      label: rule.label,
      sort: false, // fields too many to sort meaningfully
    })),
    { field: 'score', label: 'Score (%)', sort: true },
  ];

  return (
    <section
      aria-labelledby="coverage-matrix-heading"
      style={{
        padding: '1rem',
        overflowX: 'auto',
        border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
        borderRadius: '0.5rem',
        background: 'var(--glass-bg, rgba(255,255,255,0.04))',
      }}
    >
      <h2 id="coverage-matrix-heading" style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 800 }}>
        Coverage Matrix
      </h2>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem', marginBottom: '1rem', borderRadius: '0.3rem' }}>
          <p style={{ margin: 0, color: '#991b1b' }}>Error: {error}</p>
        </div>
      )}

      {isLoading && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading coverage data...</p>
        </div>
      )}

      {!error && !isLoading && totalRecords > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
            Showing {totalRecords} {showSummary ? (
              <span style={{ marginLeft: '0.5rem', color: 'var(--text-primary)' }>
                · Average score: {avgScore}% · {completeRecords} complete
              </span>
            ) : ''}
          </p>

          {/* Filter controls */}
          <form
            aria-label="Coverage matrix filters"
            onSubmit={(e) => e.preventDefault()}
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <select
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              value={filters.category || 'All'}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="All">Category</option>
              {['All', 'Certificates', 'Identity', 'Business', 'Health', 'Social Welfare', 'Employment', 'Transport'].map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                )
              )}
            </select>

            <select
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              value={filters.jurisdiction || 'All'}
              onChange={(e) => setFilters({ ...filters, jurisdiction: e.target.value })}
            >
              <option value="All">Jurisdiction</option>
              <option value="India">India (national)</option>
              {INDIAN_STATES_AND_UTS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>

            <select
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              value={filters.publicationState || 'All'}
              onChange={(e) => setFilters({ ...filters, publicationState: e.target.value })}
            >
              <option value="All">Publication state</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            <button
              type="button"
              style={{
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem',
                background: 'var(--button-bg, #e2e8f0)',
                border: '1px solid var(--border-color, #cbd5e1)',
                borderRadius: '0.3rem',
              }}
              onClick={() => setFilters({ category: 'All', jurisdiction: 'All', publicationState: 'All' })}
            >
              Clear
            </button>
          </form>

          {/* Summary stats */}
          {showSummary && (
            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.75rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total records</p>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{totalRecords}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avg score</p>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{avgScore}%</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Complete</p>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{completeRecords}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sortable table header row */}
        <div style={{ display: 'flex', marginBottom: '0.5rem' }}>
          {columnHeaders.map((col, i) => (
            <SortableHeader
              key={i}
              label={col.label}
              onSort={(field) => setSort((current) => {
                if (current.field === field) return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
                return { field, direction: 'asc' };
              })}
              currentSort={sort}
              direction={sort.direction}
            />
          ))}
        </div>

        {/* Matrix table */}
        <table
          role="grid"
          aria-label={`Coverage matrix showing service requirement states across ${totalRecords} services. Rows are services, columns are required/optional fields. States: Missing (red), Draft (amber), Verified (green), Stale (yellow), Conflicting (purple).`}
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.7rem',
            marginTop: '0.5rem',
          }}
        >
          <thead>
            <tr>
              <th scope="col" style={{ padding: '0.3rem 0.4rem', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>Service</th>
              {ENHANCED_COVERAGE_RULES.map((rule, i) => (
                <th
                  key={i}
                  style={{
                    padding: '0.3rem 0.4rem',
                    fontWeight: 600,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                  }}
                  role="columnheader"
                  aria-label={`Field: ${rule.label}, ${SEVERITY_LABELS[rule.severity]} severity`}
                >
                  {rule.label.split(' ')[0]} {/* short label */}
                </th>
              ))}
              <th scope="col" style={{ padding: '0.3rem 0.4rem', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((record, rIdx) => (
              <tr
                key={record.id}
                style={{
                  background: record.score === 100 ? '#f0fdf4' : 'transparent',
                  borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                  cursor: 'pointer',
                }}
                onClick={() => onEditService && onEditService(record.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEditService && onEditService(record.id);
                  }
                }}
                tabIndex={0}
                role="row"
                aria-selected={false}
              >
                <td
                  style={{
                    padding: '0.3rem 0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {record.name || '(unnamed)'}
                </td>
                {ENHANCED_COVERAGE_RULES.map((rule, cIdx) => {
                  const state = record.stateCells?.[cIdx]?.state || 'missing';
                  const color = STATE_COLORS[state] || '#64748b';
                  const isBlocker = rule.level === 'required';

                  return (
                    <td
                      key={cIdx}
                      style={{
                        padding: '0.3rem 0.4rem',
                        fontSize: '0.7rem',
                        border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                        borderRadius: '3px',
                        backgroundColor: color === '#ef4444' || color === '#eab308' ? `${color}20` : 'transparent',
                        color,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCellClick(record.id, rule.field, state);
                      }}
                      onFocus={(e) => {
                        e.stopPropagation();
                        handleCellClick(record.id, rule.field, state);
                      }}
                      tabIndex={0}
                      role="gridcell"
                      aria-label={`${
                        record.name || 'Service'
                      } - ${rule.label}: ${STATE_LABELS[state]} state. ${
                        isBlocker ? 'This is a publication blocker.' : 'Optional field.'
                      }`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '1.2em',
                          borderRadius: '3px',
                          backgroundColor: color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.55rem',
                          fontWeight: 600,
                          color: state === '#fff' || state === 'transparent' ? '#000' : '#fff',
                          minWidth: '2.5ch',
                        }}
                        title={STATE_LABELS[state]}
                      >
                        {STATE_LABELS[state]}
                      </div>
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: '0.3rem 0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.15))',
                  }}
                >
                  {record.score}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
      )}

      {totalRecords === 0 && !isLoading && !error && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>No services match the current filters.</p>
          <p>Try adjusting the category, jurisdiction, or publication state filters.</p>
        </div>
      )}

      {/* Loading more data */}
      {isLoading && totalRecords === 0 && !error && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Loading catalogue data...</p>
        </div>
      )}
    </section>
  );
};

export default CoverageMatrix;