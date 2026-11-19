/**
 * src/components/pedestrianBarriers/RoutePlannerPanel.jsx
 * Route calculation form and mobility preference constraint toggles
 * for Accessible Pedestrian Route Barrier Map (#757).
 */

import { useState } from 'react';
import {
  Navigation,
  Sliders,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';
import {
  BARRIER_TYPES,
  BARRIER_SEVERITIES,
} from '../../data/pedestrianBarrierContract.js';

export default function RoutePlannerPanel({
  nodes = [],
  preferences,
  onPreferencesChange,
  onCalculateRoute,
  routeResult,
  loading = false,
}) {
  const [originNodeId, setOriginNodeId] = useState('NODE-101');
  const [destinationNodeId, setDestinationNodeId] = useState('NODE-103');
  const [showAdvancedPrefs, setShowAdvancedPrefs] = useState(false);

  const handleCalculate = (e) => {
    e?.preventDefault();
    if (originNodeId && destinationNodeId) {
      onCalculateRoute(originNodeId, destinationNodeId);
    }
  };

  const handlePrefToggle = (field) => {
    onPreferencesChange({
      ...preferences,
      [field]: !preferences[field],
    });
  };

  const handleGradientChange = (e) => {
    onPreferencesChange({
      ...preferences,
      maxGradientPct: Number(e.target.value),
    });
  };

  const getRatingBadge = (rating) => {
    switch (rating) {
      case 'fully_accessible':
        return (
          <span
            className="badge badge-success"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem' }}
          >
            <CheckCircle size={14} aria-hidden="true" />
            <strong>Fully Accessible Route</strong>
          </span>
        );
      case 'partially_accessible':
        return (
          <span
            className="badge badge-warning"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem' }}
          >
            <AlertTriangle size={14} aria-hidden="true" />
            <strong>Partially Accessible (Proceed with Caution)</strong>
          </span>
        );
      case 'high_impediment':
      default:
        return (
          <span
            className="badge badge-danger"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem' }}
          >
            <XCircle size={14} aria-hidden="true" />
            <strong>High Impediment / Obstacles Present</strong>
          </span>
        );
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Navigation size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Accessible Route Planner
        </h2>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Select your starting point and destination. Configure your functional mobility preferences below without
        requiring any medical diagnosis.
      </p>

      <form onSubmit={handleCalculate}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
          <div>
            <label
              htmlFor="planner-origin-select"
              style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
            >
              Origin / Starting Point
            </label>
            <select
              id="planner-origin-select"
              value={originNodeId}
              onChange={(e) => setOriginNodeId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, var(--bg-card))',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.ward})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="planner-dest-select"
              style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
            >
              Destination
            </label>
            <select
              id="planner-dest-select"
              value={destinationNodeId}
              onChange={(e) => setDestinationNodeId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, var(--bg-card))',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
              }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.ward})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobility Preferences Section */}
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.85rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sliders size={16} aria-hidden="true" />
              Functional Mobility Constraints
            </span>
            <button
              type="button"
              onClick={() => setShowAdvancedPrefs(!showAdvancedPrefs)}
              className="btn btn-sm btn-ghost"
              style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}
              aria-expanded={showAdvancedPrefs}
            >
              {showAdvancedPrefs ? 'Hide Details' : 'Customize Options'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={preferences.avoidStairsAndSteps}
                onChange={() => handlePrefToggle('avoidStairsAndSteps')}
                aria-label="Avoid stairs and steps"
              />
              Avoid stairs &amp; vertical steps
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={preferences.requireCurbRamps}
                onChange={() => handlePrefToggle('requireCurbRamps')}
                aria-label="Require curb ramps"
              />
              Require dropped curb ramps
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={preferences.avoidUnpavedSurfaces}
                onChange={() => handlePrefToggle('avoidUnpavedSurfaces')}
                aria-label="Avoid unpaved and broken surfaces"
              />
              Avoid dirt &amp; broken paver surfaces
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={preferences.requireTactilePaving}
                onChange={() => handlePrefToggle('requireTactilePaving')}
                aria-label="Require continuous tactile paving"
              />
              Require tactile paving (low-vision)
            </label>
          </div>

          {showAdvancedPrefs && (
            <div
              style={{
                marginTop: '0.85rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div>
                <label
                  htmlFor="max-gradient-range"
                  style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}
                >
                  Maximum Walking Slope: <strong>{preferences.maxGradientPct}%</strong> (Standard wheelchair limit: 8%)
                </label>
                <input
                  id="max-gradient-range"
                  type="range"
                  min="4"
                  max="15"
                  step="1"
                  value={preferences.maxGradientPct}
                  onChange={handleGradientChange}
                  style={{ width: '100%' }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={preferences.requireAudibleSignals}
                  onChange={() => handlePrefToggle('requireAudibleSignals')}
                />
                Require audible beeping signals at pelican road crossings
              </label>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || originNodeId === destinationNodeId}
          className="btn btn-primary"
          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
        >
          <Navigation size={16} aria-hidden="true" />
          {loading ? 'Analyzing Pedestrian Graph...' : 'Calculate Accessible Route'}
        </button>
      </form>

      {/* Active Route Calculation Details */}
      {routeResult && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
          }}
          aria-live="polite"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Route Assessment
            </span>
            {getRatingBadge(routeResult.overallAccessibilityRating)}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              textAlign: 'center',
              marginBottom: '0.85rem',
              padding: '0.65rem',
              background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
              borderRadius: '0.35rem',
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total Distance</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{routeResult.totalDistanceMeters} m</strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Accessible Ratio</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{Math.round(routeResult.accessibleDistanceRatio * 100)}%</strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Segments</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{routeResult.segments.length} links</strong>
            </div>
          </div>

          {/* Explainability Provenance */}
          {routeResult.scoringProvenance?.influencingFactors?.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                <Info size={13} aria-hidden="true" />
                Scoring Logic &amp; Routing Provenance:
              </span>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {routeResult.scoringProvenance.influencingFactors.map((factor, idx) => (
                  <li key={idx}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Identified Barriers Warning List */}
          {routeResult.identifiedBarriers?.length > 0 && (
            <div
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: '0.35rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger, #ef4444)', marginBottom: '0.25rem' }}>
                <AlertTriangle size={13} aria-hidden="true" />
                Caution: Obstacles on Traversed Corridors:
              </span>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {routeResult.identifiedBarriers.map((b) => (
                  <li key={b.id}>
                    <strong>{BARRIER_TYPES[b.barrierType]?.label || b.barrierType}:</strong> {b.description} ({BARRIER_SEVERITIES[b.severity]?.label})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
