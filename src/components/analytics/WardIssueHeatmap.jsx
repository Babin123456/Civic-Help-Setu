/**
 * src/components/analytics/WardIssueHeatmap.jsx
 * Accessible interactive civic grievance heatmap with Differential Privacy (#1163).
 *
 * Enforces WCAG 2.1 AA compliance:
 * - High-contrast indicators and screen-reader announcements
 * - Clear disclosure of suppressed sparse cells (< 5)
 * - Session privacy budget consumption meter
 * - Non-official statutory municipal disclaimer
 */

import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Info,
  Filter,
  RefreshCw,
  HelpCircle,
  EyeOff,
} from 'lucide-react';
import {
  CIVIC_ISSUE_CATEGORIES,
  VALID_TIME_WINDOWS,
  PRIVACY_LIMITS,
  STATUTORY_MUNICIPAL_DISCLAIMER,
} from '../../data/wardAnalyticsContract';
import { fetchDifferentiallyPrivateWardAnalytics } from '../../services/wardAnalyticsQueryService';

export default function WardIssueHeatmap({ defaultWard = '', clientId = 'web-dashboard-client' }) {
  const [selectedWard, setSelectedWard] = useState(defaultWard);
  const [selectedWindow, setSelectedWindow] = useState('30d');
  const [epsilon, setEpsilon] = useState(PRIVACY_LIMITS.DEFAULT_EPSILON);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPrivacyExplainer, setShowPrivacyExplainer] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);

  const analyticsResult = useMemo(() => {
    if (refreshKey < 0) return null;
    try {
      return fetchDifferentiallyPrivateWardAnalytics({
        wardId: selectedWard || undefined,
        timeWindow: selectedWindow,
        epsilon,
        sparseThreshold: PRIVACY_LIMITS.DEFAULT_SPARSE_THRESHOLD,
        clientId,
      });
    } catch (err) {
      return {
        success: false,
        error: 'CLIENT_ERROR',
        message: err.message,
      };
    }
  }, [selectedWard, selectedWindow, epsilon, clientId, refreshKey]);

  // Distinct wards for the filter dropdown
  const availableWards = useMemo(() => {
    if (!analyticsResult?.data) return [];
    return Array.from(new Set(analyticsResult.data.map((d) => d.wardId))).sort();
  }, [analyticsResult]);

  // Pivot data: Map of wardId -> { categoryId: { publishedCount, isSuppressed } }
  const matrixData = useMemo(() => {
    if (!analyticsResult?.data) return {};
    const map = {};
    analyticsResult.data.forEach((item) => {
      if (!map[item.wardId]) map[item.wardId] = {};
      map[item.wardId][item.category] = item;
    });
    return map;
  }, [analyticsResult]);

  const categories = Object.values(CIVIC_ISSUE_CATEGORIES);

  // Cell intensity styling
  const getCellBg = (publishedCount, isSuppressed) => {
    if (isSuppressed) return highContrastMode ? '#333333' : '#f1f5f9';
    if (publishedCount === null || publishedCount === undefined) return '#ffffff';
    if (highContrastMode) {
      if (publishedCount >= 20) return '#000000';
      if (publishedCount >= 10) return '#444444';
      return '#777777';
    }
    if (publishedCount >= 25) return '#fed7aa'; // high amber
    if (publishedCount >= 15) return '#fef08a'; // yellow
    if (publishedCount >= 8) return '#ccfbf1';  // soft teal
    return '#e0f2fe';                           // light blue
  };

  return (
    <div className="ward-analytics-heatmap-container" style={{ fontFamily: 'inherit' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={26} color="#0284c7" aria-hidden="true" />
            Ward-Level Civic Grievance Analytics
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Differentially private trends across municipal jurisdictions
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setShowPrivacyExplainer(!showPrivacyExplainer)}
            aria-expanded={showPrivacyExplainer}
            aria-controls="privacy-explainer-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '0.85rem',
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            <HelpCircle size={16} aria-hidden="true" />
            How Privacy is Protected
          </button>

          <button
            type="button"
            onClick={() => setHighContrastMode(!highContrastMode)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #cbd5e1',
              backgroundColor: highContrastMode ? '#0f172a' : '#ffffff',
              color: highContrastMode ? '#ffffff' : '#334155',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            aria-pressed={highContrastMode}
          >
            {highContrastMode ? 'Standard Mode' : 'High Contrast'}
          </button>
        </div>
      </div>

      {/* Explainer Collapsible Panel */}
      {showPrivacyExplainer && (
        <section
          id="privacy-explainer-panel"
          aria-label="Differential Privacy Explanation"
          style={{
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '0.5rem',
            border: '1px solid #bae6fd',
            marginBottom: '1.5rem',
            color: '#0369a1',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Info size={22} style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                Mathematical Privacy Guarantees (DPDP Act 2023 Compliance)
              </strong>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                To prevent curious viewers or malicious actors from identifying individual households:
              </p>
              <ul style={{ margin: '0 0 0.5rem 0', paddingLeft: '1.25rem' }}>
                <li>
                  <strong>$\epsilon$-Differential Privacy:</strong> Zero-mean calibrated Laplace noise is mathematically added to all public counts.
                </li>
                <li>
                  <strong>Sparse-Cell Suppression:</strong> Any category with fewer than 5 recorded reports is masked to prevent small-cohort re-identification.
                </li>
                <li>
                  <strong>Anti-Reconstruction Budget:</strong> Each session has a daily query budget ($\epsilon \le 3.0$) to block repeated-query database reconstruction attacks.
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Query Filters Bar */}
      <div
        role="region"
        aria-label="Analytics Filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="#64748b" aria-hidden="true" />
          <label htmlFor="ward-select" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
            Ward:
          </label>
          <select
            id="ward-select"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
          >
            <option value="">All Municipal Wards</option>
            {availableWards.map((wId) => (
              <option key={wId} value={wId}>{wId}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="window-select" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
            Aggregation Window:
          </label>
          <select
            id="window-select"
            value={selectedWindow}
            onChange={(e) => setSelectedWindow(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
          >
            {VALID_TIME_WINDOWS.map((win) => (
              <option key={win} value={win}>{win === '7d' ? 'Last 7 Days' : win === '14d' ? 'Last 14 Days' : win === '30d' ? 'Last 30 Days' : 'Last 90 Days'}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="epsilon-select" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
            Privacy Budget ($\epsilon$):
          </label>
          <select
            id="epsilon-select"
            value={epsilon}
            onChange={(e) => setEpsilon(Number(e.target.value))}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
          >
            <option value={0.2}>$\epsilon = 0.2$ (Maximum Privacy)</option>
            <option value={0.5}>$\epsilon = 0.5$ (Balanced - Recommended)</option>
            <option value={1.0}>$\epsilon = 1.0$ (High Utility)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
          aria-label="Refresh analytics data"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Apply Filters
        </button>
      </div>

      {/* Privacy Budget & Metadata Stats Cards */}
      {analyticsResult?.budgetStatus && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Session Privacy Budget</span>
            <strong style={{ fontSize: '1.1rem', color: analyticsResult.budgetStatus.isExhausted ? '#ef4444' : '#0f172a' }}>
              {analyticsResult.budgetStatus.remainingBudget} / {analyticsResult.budgetStatus.totalBudget} $\epsilon$
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
              {analyticsResult.budgetStatus.isExhausted ? 'Exhausted: queries blocked' : 'Active shield protection'}
            </span>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Protected Sparse Cells</span>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>
              {analyticsResult.privacyMetadata?.suppressedCells || 0} Cells
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
              Masked (&lt; 5 reports)
            </span>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>95% Confidence Bounds</span>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>
              &plusmn; {analyticsResult.privacyMetadata?.confidenceInterval95?.margin || 0}
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
              Laplace scale $b = {analyticsResult.privacyMetadata?.confidenceInterval95?.scale || 0}$
            </span>
          </div>
        </div>
      )}

      {/* Error state if budget exhausted */}
      {analyticsResult?.error === 'BUDGET_EXHAUSTED' && (
        <div
          role="alert"
          style={{
            padding: '1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#b91c1c',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <AlertCircle size={24} style={{ flexShrink: 0 }} aria-hidden="true" />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem' }}>Privacy Budget Limit Reached</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                To prevent statistical reconstruction attacks, query limits are strictly enforced. Your session budget will reset at midnight UTC.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Heatmap Table */}
      {analyticsResult?.success && (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}
            aria-label="Differentially Private Ward Grievance Table"
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Ward Identifier</th>
                {categories.map((cat) => (
                  <th key={cat.id} scope="col" style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    {cat.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(matrixData).map((wardId) => (
                <tr key={wardId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th scope="row" style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                    {wardId}
                  </th>
                  {categories.map((cat) => {
                    const cell = matrixData[wardId]?.[cat.id];
                    const isSuppressed = cell?.isSuppressed;
                    const count = cell?.publishedCount;
                    const bg = getCellBg(count, isSuppressed);

                    return (
                      <td
                        key={cat.id}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: bg,
                          color: highContrastMode && !isSuppressed ? '#ffffff' : '#0f172a',
                        }}
                      >
                        {isSuppressed ? (
                          <span
                            tabIndex="0"
                            aria-label={`Ward ${wardId}, ${cat.label}: Fewer than 5 reports. Cell suppressed to protect resident privacy.`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '0.25rem',
                              backgroundColor: '#e2e8f0',
                              color: '#64748b',
                              fontWeight: 500,
                            }}
                          >
                            <EyeOff size={13} aria-hidden="true" />
                            &lt; 5 (Suppressed)
                          </span>
                        ) : (
                          <span
                            tabIndex="0"
                            aria-label={`Ward ${wardId}, ${cat.label}: Approximately ${count} reports.`}
                            style={{ fontWeight: 600 }}
                          >
                            ~ {count}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statutory Disclaimer Footer */}
      <footer
        style={{
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
          fontSize: '0.8rem',
          color: '#64748b',
          lineHeight: '1.4',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <ShieldCheck size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
          <div>
            <strong>Statutory Disclosure Notice:</strong> {STATUTORY_MUNICIPAL_DISCLAIMER}
          </div>
        </div>
      </footer>
    </div>
  );
}
