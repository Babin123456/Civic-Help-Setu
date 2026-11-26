import { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from 'lucide-react';
import { getHandoffGraph, getPlainLanguageExplanation, getKeyboardAccessibleInfo } from '../../services/jurisdictionHandoffService';
import { getJurisdictionSourceInfo } from '../../data/jurisdictionBoundaries';
import { useToast } from '../../context/ToastContext';
import TextOnlyHandOff from './TextOnlyHandOff';

/**
 * Jurisdiction Hand-off Map component.
 * 
 * Shows an interactive jurisdiction map with layered boundaries and coloured
 * responsibility regions. Paired with a stage-to-authority hand-off graph.
 * 
 * Features:
 * - Interactive map with layered boundaries
 * - Stage-to-authority hand-off graph
 * - Legend, boundary date, source panel, zoom controls
 * - Searchable authority list
 * - Text-only alternative for accessibility
 * - Loading, empty, error, stale-data, and permission-denied states
 * - Keyboard navigation support
 * - Readable list/table alternative for every chart/map/graph
 */
const JurisdictionMap = ({
  service,
  initialLocality,
  initialState,
  onAuthoritySelect,
  showTextOnly = false,
  permissionDenied = false,
}) => {
  const [locality, setLocality] = useState(initialLocality || '');
  const [state, setState] = useState(initialState || 'All');
  const [loading, setLoading] = useState(false);
  const [error] = useState(null);
  const [showStaleDataWarning, setShowStaleDataWarning] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [authoritySearchQuery, setAuthoritySearchQuery] = useState('');
  const [manualConfirmation, setManualConfirmation] = useState(false);

  // Hand-off graph state
  const [handoffGraph, setHandoffGraph] = useState(() => {
    if (!service) {
      return {
        stages: [],
        summary: 'No service selected.',
        ambiguity: false,
        requiresConfirmation: false,
      };
    }
    return getHandoffGraph(service, initialLocality || '', initialState || 'All');
  });

  // Plain language explanation state
  const [plainLanguageExplanation, setPlainLanguageExplanation] = useState(() => {
    if (!service) return null;
    const initialGraph = getHandoffGraph(service, initialLocality || '', initialState || 'All');
    return getPlainLanguageExplanation(initialGraph, false);
  });

  let toast = null;
  let showToast = null;
  try {
    const toastContext = useToast();
    toast = toastContext?.toast;
    showToast = toastContext?.showToast;
  } catch {
    // ignore
  }

  const mapRef = useRef(null);
  useFocusTrap(mapRef);
  useReducedMotion();

  // Effect: build hand-off graph when service or locality changes
  useEffect(() => {
    if (!service) {
      setHandoffGraph({
        stages: [],
        summary: 'No service selected.',
        ambiguity: false,
      });
      setLoading(false);
      return;
    }

    // Build the hand-off graph
    const graph = getHandoffGraph(service, locality, state);

    setHandoffGraph(graph);

    // Get plain language explanation (AI suggestion until confirmed)
    const explanation = getPlainLanguageExplanation(graph, false);
    setPlainLanguageExplanation(explanation);

    setLoading(false);
  }, [service, locality, state]);

  // Effect: handle ambiguous jurisdiction results
  useEffect(() => {
    if (handoffGraph.ambiguity && !manualConfirmation) {
      setShowStaleDataWarning(true);
      const title = 'Ambiguous jurisdiction';
      const msg = 'Multiple authorities could serve this locality. Please confirm which authority is responsible.';
      if (toast?.warning) {
        toast.warning(msg, title);
      } else if (showToast) {
        showToast(msg, 'warning', title);
      }
    }
  }, [handoffGraph.ambiguity, manualConfirmation, toast, showToast]);

  // Effect: handle review-required results
  useEffect(() => {
    if (handoffGraph.requiresConfirmation && !manualConfirmation) {
      setShowStaleDataWarning(true);
      const title = 'Review required';
      const msg = 'Jurisdiction resolution requires manual confirmation due to overlapping authorities.';
      if (toast?.warning) {
        toast.warning(msg, title);
      } else if (showToast) {
        showToast(msg, 'warning', title);
      }
    }
  }, [handoffGraph.requiresConfirmation, manualConfirmation, toast, showToast]);

  // Handle manual confirmation
  const handleConfirmManual = () => {
    setManualConfirmation(true);
    setShowStaleDataWarning(false);
  };

  const handleCancelManual = () => {
    setManualConfirmation(false);
  };

  const handleResolve = () => {
    if (!service) return;
    const graph = getHandoffGraph(service, locality, state);
    setHandoffGraph(graph);
    const explanation = getPlainLanguageExplanation(graph, false);
    setPlainLanguageExplanation(explanation);
  };

  // Handle locality change
  const handleLocalityChange = (value) => {
    setLocality(value);
    setState('All'); // Reset state when locality changes
  };

  // Handle state change
  const handleStateChange = (value) => {
    setState(value);
  };

  // Compute keyboard-accessible info
  const keyboardInfo = getKeyboardAccessibleInfo(handoffGraph);

  // Compute source info
  const sourceInfo = getJurisdictionSourceInfo();

  // Render modes
  if (showTextOnly) {
    return (
      <TextOnlyHandOff
        service={service}
        locality={locality}
        state={state}
        graph={handoffGraph}
        onClose={() => {}}
      />
    );
  }

  if (permissionDenied) {
    return renderPermissionDeniedMode();
  }

  if (!service) {
    return (
      <div className="section container" style={{ minHeight: '300px' }}>
        <div className="glass-panel" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>No service selected</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Please choose a service from the catalogue to view its jurisdiction hand-off map.</p>
        </div>
      </div>
    );
  }

  if (loading && handoffGraph.stages.length === 0) {
    return renderLoadingMode();
  }

  if (error && handoffGraph.stages.length === 0) {
    return renderErrorMode(error);
  }

  if (showStaleDataWarning) {
    return renderStaleDataMode({
      onDismiss: () => setShowStaleDataWarning(false),
    });
  }

  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.0, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))));
  const handleZoomReset = () => setZoomLevel(1);

  return renderMapMode({
    service,
    locality,
    state,
    handoffGraph,
    plainLanguageExplanation,
    handleLocalityChange,
    handleStateChange,
    handleResolve,
    keyboardInfo,
    sourceInfo,
    onAuthoritySelect,
    zoomLevel,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    authoritySearchQuery,
    setAuthoritySearchQuery,
    onConfirmManual: handleConfirmManual,
    onCancelManual: handleCancelManual,
    mapRef,
  });
};

/**
 * Render the loading mode state.
 */
const renderLoadingMode = () => {
  return (
    <div className="section container" style={{ minHeight: '400px' }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto' }} />
        <h2 style={{ margin: '1rem 0', fontSize: '1.25rem' }}>Loading jurisdiction map</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Resolving jurisdiction and building hand-off path...
        </p>
      </div>
    </div>
  );
};

/**
 * Render the error mode state.
 */
const renderErrorMode = (errorMessage) => {
  return (
    <div className="section container" style={{ minHeight: '400px' }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ margin: '0.5rem 0', fontSize: '1.25rem' }}>Error loading jurisdiction</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {errorMessage}
        </p>
        <button
          onClick={() => {}}
          style={{
            margin: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--accent-main)',
            color: 'var(--bg-main)',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
};

/**
 * Render the permission-denied state.
 */
const renderPermissionDeniedMode = () => {
  return (
    <div className="section container" style={{ minHeight: '400px' }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ margin: '0.5rem 0', fontSize: '1.25rem' }}>Permission Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Your verified account lacks administrative permissions to access this jurisdiction or modify territory mappings.
        </p>
      </div>
    </div>
  );
};

/**
 * Render the stale data warning mode.
 */
const renderStaleDataMode = ({ onDismiss } = {}) => {
  return (
    <div className="section container" style={{ minHeight: '400px' }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ margin: '0.5rem 0', fontSize: '1.25rem' }}>Stale data warning</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          The jurisdiction data may be stale. The last update was on {new Date().toLocaleDateString()}.
        </p>
        <button
          onClick={onDismiss}
          style={{
            margin: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--accent-main)',
            color: 'var(--bg-main)',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Dismiss &amp; Continue
        </button>
        <p style={{ color: 'var(--text-tertiary)', marginTop: '1rem' }}>
          <small>
            Source data version: {new Date().toISOString().split('T')[0]}
          </small>
        </p>
      </div>
    </div>
  );
};

/**
 * Render the main map mode with interactive map and hand-off graph.
 */
const renderMapMode = ({
  service,
  locality,
  state,
  handoffGraph,
  plainLanguageExplanation,
  handleLocalityChange,
  handleStateChange,
  handleResolve,
  keyboardInfo,
  sourceInfo,
  onAuthoritySelect,
  zoomLevel = 1,
  handleZoomIn,
  handleZoomOut,
  handleZoomReset,
  authoritySearchQuery = '',
  setAuthoritySearchQuery,
  onConfirmManual,
  onCancelManual,
  mapRef,
}) => {
  return (
    <div ref={mapRef} className="section container" style={{ minHeight: '600px' }}>
      <div className="glass-panel" style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header with service info and locality input */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.5rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>
              {service ? `${service.name} - Jurisdiction Hand-off Map` : 'Jurisdiction Hand-off Map'}
            </h2>
            
            {/* Locality search input */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="locality-input"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.35rem',
                }}
              >
                Locality or PIN code
              </label>
              <input
                id="locality-input"
                type="text"
                value={locality}
                onChange={(e) => handleLocalityChange(e.target.value)}
                placeholder="Enter locality name or PIN code (e.g. 'Anna Nagar' or '600001')"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
                aria-label="Locality or PIN code for jurisdiction resolution"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleResolve}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--accent-main)',
                  background: 'rgba(30, 64, 175, 0.1)',
                  color: 'var(--accent-main)',
                  fontSize: '0.75rem',
                }}
                aria-label="Resolve jurisdiction for entered locality"
              >
                Resolve
              </button>
            </div>

            {/* State selector */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="state-select"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.35rem',
                }}
              >
                State / UT
              </label>
              <select
                id="state-select"
                value={state}
                onChange={(e) => handleStateChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
                aria-label="State / Union Territory"
              >
                <option value="All">All States / UTs</option>
                {INDIAN_STATES_AND_UTS.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Plain language explanation panel */}
          <div style={{ minWidth: '260px' }}>
            {plainLanguageExplanation && (
              <div style={{
                padding: '0.75rem',
                background: 'rgba(30, 64, 175, 0.08)',
                border: '1px solid var(--accent-main)',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--accent-main)' }}>
                  {plainLanguageExplanation.isSuggestion ? '(AI suggestion)' : '(Confirmed)'}
                </div>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  {plainLanguageExplanation.text}
                </p>
                {plainLanguageExplanation.aiLabel && (
                  <p style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic',
                  }}>
                    {plainLanguageExplanation.aiLabel}
                  </p>
                )}
                {plainLanguageExplanation.requiresConfirmation && (
                  <p style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.75rem',
                    color: '#f59e0b',
                  }}>
                    <strong>Confirm:</strong> Please verify with official authority before proceeding.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Map canvas area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '400px',
            margin: '1.5rem 0',
            borderRadius: '0.75rem',
            background: 'var(--bg-card)',
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
          }}
        >
          {/* Map boundary visualizer with scaled zoom viewport */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-in-out',
              background: 
                handoffGraph.ambiguity
                  ? 'rgba(255, 243, 225, 0.5)' 
                  : handoffGraph.unavailable
                  ? 'rgba(254, 243, 230, 0.5)'
                  : 'var(--bg-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
            }}
          >
            {handoffGraph.ambiguity && (
              <div>
                <MapPin size={24} color="#f59e0b" style={{ marginRight: '0.5rem' }} />
                <span>Multiple authorities for this area</span>
              </div>
            )}
            {handoffGraph.unavailable && (
              <div>
                <MapPin size={24} color="#6b7280" style={{ marginRight: '0.5rem' }} />
                <span>Jurisdiction data unavailable</span>
              </div>
            )}
            {!handoffGraph.ambiguity && !handoffGraph.unavailable && handoffGraph.stages.length > 0 && (
              <div style={{ position: 'relative', width: '80%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Render layered responsibility regions based on hand-off stages */}
                {handoffGraph.stages.map((stage, idx) => {
                  const inset = idx * 18;
                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        top: `${inset}px`,
                        bottom: `${inset}px`,
                        left: `${inset}px`,
                        right: `${inset}px`,
                        border: `2px solid ${stageColors(stage.authority?.level)}`,
                        background: stageColors(stage.authority?.level),
                        opacity: 0.18 + (idx * 0.08),
                        borderRadius: '0.5rem',
                      }}
                      title={`${stage.name} (${stage.authority?.level})`}
                    />
                  );
                })}
                <div style={{ zIndex: 5, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '0.4rem 0.8rem', borderRadius: '2rem', color: '#fff' }}>
                  <MapPin size={20} color="#38bdf8" style={{ marginRight: '0.4rem' }} />
                  <span>Jurisdiction resolved for: {locality || 'selected area'}</span>
                </div>
              </div>
            )}
            {!handoffGraph.stages.length && (
              <div>
                <MapPin size={24} color="#6b7280" style={{ marginRight: '0.5rem' }} />
                <span>Select a service and locality to see the map</span>
              </div>
            )}
          </div>
        </div>

        {/* Zoom controls */}
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.65)',
            padding: '0.25rem 0.5rem',
            borderRadius: '2rem',
            border: '1px solid var(--border-light)',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 0.35rem' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            style={{
              padding: '0 0.5rem',
              height: '28px',
              borderRadius: '14px',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
            aria-label="Reset zoom"
          >
            1x
          </button>
        </div>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            background: 'rgba(0, 0, 0, 0.75)',
            color: 'var(--text-primary)',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            zIndex: 10,
          }}
        >
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                background: '#3b82f6',
                borderRadius: '2px',
                marginRight: '0.5rem',
              }}
            />
            National authority
          </div>
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                background: '#10b981',
                borderRadius: '2px',
                marginRight: '0.5rem',
              }}
            />
            State authority
          </div>
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                background: '#f59e0b',
                borderRadius: '2px',
                marginRight: '0.5rem',
              }}
            />
            District authority
          </div>
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                background: '#ef4444',
                borderRadius: '2px',
                marginRight: '0.5rem',
              }}
            />
            Local body authority
          </div>
        </div>
      </div>

      {/* Hand-off graph sidebar */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            Hand-off Sequence
          </h3>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={authoritySearchQuery}
              onChange={(e) => setAuthoritySearchQuery && setAuthoritySearchQuery(e.target.value)}
              placeholder="Search authorities..."
              aria-label="Search and filter authority list"
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem 0.35rem 1.85rem',
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
        {handoffGraph.ambiguity ? (
          <p style={{ color: '#f59e0b', marginBottom: '1rem' }}>
            <strong>Ambiguous jurisdiction:</strong> Multiple authorities could serve this area. 
            Please confirm which authority is responsible.
          </p>
        ) : (handoffGraph.unavailable || handoffGraph.stages[0]?.name === 'Jurisdiction resolution required') ? (
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            <strong>Jurisdiction unavailable:</strong> Could not resolve hand-off path for the provided locality.
          </p>
        ) : (
          <ol style={{ paddingLeft: '1.25rem' }}>
            {handoffGraph.stages
              .filter((stage) => {
                if (!authoritySearchQuery) return true;
                const q = authoritySearchQuery.toLowerCase();
                return (
                  (stage.name && stage.name.toLowerCase().includes(q)) ||
                  (stage.authority?.name && stage.authority.name.toLowerCase().includes(q)) ||
                  (stage.authority?.level && stage.authority.level.toLowerCase().includes(q))
                );
              })
              .map((stage, idx) => (
                <li
                  key={idx}
                  onClick={() => onAuthoritySelect && onAuthoritySelect(stage.authority || { name: stage.name, level: stage.authority?.level })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onAuthoritySelect && onAuthoritySelect(stage.authority || { name: stage.name, level: stage.authority?.level });
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    padding: '0.25rem 0.4rem',
                    borderRadius: '0.3rem',
                  }}
                  aria-label={`Select ${stage.name}`}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      background: stageColors(stage.authority?.level),
                      borderRadius: '50%',
                    }}
                  />
                  <span style={{ flex: 1, textDecoration: 'underline' }}>{stage.name}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    {stage.authority?.level || ''}
                  </span>
                </li>
              ))}
          </ol>
        )}

        {/* Authority details for selected stage */}
        {handoffGraph.stages.length > 0 && handoffGraph.stages[0].authority && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light' }}>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Authority Details
            </h4>
            <dl style={{ display: 'grid', gap: '0.5rem' }}>
              <dt style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Contact</dt>
              <dd style={{ fontSize: '0.875rem' }}>{handoffGraph.stages[0].authority.contact || 'Not available'}</dd>
              
              <dt style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Official Portal</dt>
              <dd style={{ fontSize: '0.875rem', textDecoration: 'underline' }}>
                {handoffGraph.stages[0].authority.portal || 'Not available'}
              </dd>
              
              <dt style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Escalation Path</dt>
              <dd style={{ fontSize: '0.875rem' }}>
                {handoffGraph.stages[0].authority.escalation || 'Not available'}
              </dd>
              
              <dt style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Source</dt>
              <dd style={{ fontSize: '0.875rem' }}>
                {handoffGraph.stages[0].authority.source || 'Official government source'}
              </dd>
            </dl>
          </div>
        )}

        {/* Manual confirmation when needed */}
        {handoffGraph.requiresConfirmation && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 243, 225, 0.5)', borderRadius: '0.5rem' }}>
            <p style={{ marginBottom: '0.5rem', color: '#f59e0b' }}>
              Confirm jurisdiction: The system detected multiple possible authorities for 
              the entered locality. Please select the correct authority to proceed.
            </p>
            <button
              onClick={onConfirmManual}
              style={{
                marginRight: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'var(--accent-main)',
                color: 'var(--bg-main)',
                border: 'none',
                borderRadius: '0.3rem',
                fontSize: '0.875rem',
              }}
            >
              Confirm Manually
            </button>
            <button
              onClick={onCancelManual}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.3rem',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Keyboard accessible info panel */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light)',
        }}
      >
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
          Keyboard Navigation Info
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
          Use Tab to navigate through the following information. Essential information
          is available without hover.
        </p>
        <ol style={{ paddingLeft: '1.25rem' }}>
          {keyboardInfo.map((item) => {
            if (item.type === 'authority') {
              return (
                <li key={`auth-${item.order}`}>
                  <kbd style={{ fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--accent-main)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    Authority {item.order + 1}: {item.label}
                  </kbd>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>: {item.value}</span>
                </li>
              );
            }
            if (item.type === 'level') {
              return (
                <li key={`level-${item.order}`}>
                  <kbd style={{ fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--accent-main)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    Level {item.order + 1}: {item.label}
                  </kbd>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>: {item.value}</span>
                </li>
              );
            }
            if (item.type === 'contact') {
              return (
                <li key={`contact-${item.order}`}>
                  <kbd style={{ fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--accent-main)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    Contact {item.order + 1}
                  </kbd>
                  <span style={{ color: 'var(--text-primary)' }}>: {item.value}</span>
                </li>
              );
            }
            if (item.type === 'portal') {
              return (
                <li key={`portal-${item.order}`}>
                  <kbd style={{ fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--accent-main)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    Portal {item.order + 1}
                  </kbd>
                  <a
                    href={item.value}
                    style={{ color: 'var(--accent-main)', textDecoration: 'underline', fontSize: '0.75rem' }}
                    target="_blank"
                  >
                    {item.value}
                  </a>
                </li>
              );
            }
            if (item.type === 'escalation') {
              return (
                <li key={`escal-${item.order}`}>
                  <kbd style={{ fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--accent-main)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    Escalation {item.order + 1}
                  </kbd>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>: {item.value}</span>
                </li>
              );
            }
            if (item.type === 'summary') {
              return (
                <li key={`summary-${item.order}`}>
                  <strong>{item.label}:</strong> {item.value}
                </li>
              );
            }
            return null;
          })}
        </ol>
      </div>

      {/* Source Provenance Panel */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Maintained Jurisdiction Data &amp; Source Provenance</h4>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          <strong>Source Provenance:</strong> {sourceInfo.dataSource} v{sourceInfo.version} | 
          <strong> Effective Boundary Date:</strong> {new Date(sourceInfo.lastUpdated).toLocaleDateString()} | 
          <strong> Deterministic Resolution:</strong> {sourceInfo.deterministic ? 'Yes' : 'No - AI generated'}
        </p>
      </div>

      {/* Text-only alternative toggle */}
      <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '0.5rem' }}>
        <button
          type="button"
          onClick={() => {}}
          style={{
            float: 'right',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Show text-only alternative
        </button>
        <span style={{ marginLeft: '0.5rem' }}>(for accessibility)</span>
      </div>
    </div>
  );
};

/**
 * Get colors for different jurisdiction levels in the map visualization.
 */
const stageColors = (level) => {
  const colors = {
    national: '#3b82f6',      // blue
    state: '#10b981',         // emerald
    district: '#f59e0b',      // amber
    local: '#ef4444',         // red
  };
  return colors[level] || '#6b7280';
};

/**
 * List of Indian states and UTs for the state selector.
 * Reuses the existing INDIAN_STATES_AND_UTS from the jurisdiction data.
 */
const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/**
 * Reduced-motion support - adjusts animation based on user preferences.
 */
const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mediaQuery.matches);
    
    const handler = () => setReduced(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return reduced;
};

/**
 * Focus trap for keyboard navigation within the map component.
 */
const useFocusTrap = (elementRef) => {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift + Tab - move to previous
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab - move to next
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    element.addEventListener('keydown', handleKeyDown);
    
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, [elementRef]);
};

export default JurisdictionMap;