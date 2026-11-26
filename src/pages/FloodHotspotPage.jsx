/**
 * Flood Hotspot Forecast and Safe-Route Advisory Page
 * End-to-end workflow: view time-bounded hotspot map, submit observation,
 * compare accessible route alternatives.
 *
 * Accessibility:
 * - Semantic HTML with visible focus
 * - Keyboard-only operation (Tab/Shift+Tab, Enter, Escape)
 * - Screen-reader announcements (aria-label, aria-describedby)
 * - Color-independent status communication (icons + text labels)
 * - Plain-language explanations with timestamps and sources
 * - Responsive layout: mobile-first, tablet, desktop
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FLOOD_SCHEMA_VERSION,
  FLOOD_REPORT_STATES,
  FLOOD_REPORT_STATE_LABELS,
  FLOOD_HAZARD_TYPES,
  FLOOD_HAZARD_TYPE_LABELS,
  HOTSPOT_RISK_LEVELS,
  HOTSPOT_RISK_LEVEL_LABELS,
  ROUTE_ADVISORY_STATUS,
  ROUTE_ADVISORY_STATUS_LABELS,
  CONTRIBUTING_SIGNALS,
  SOURCE_TYPE_LABELS,
} from '../data/floodContract';
import {
  generateFloodReport,
  generateForecastRun,
  computeHotspotCells,
  generateRouteAdvisory,
  transitionFloodReportState,
  ensureFloodSeedData,
  validateFloodReport,
  floodRateLimiter,
} from '../services/floodIntelligenceService';
import { requirePermission, roleOf, setCurrentActor, checkPermission } from './accessControl';
import { serializePublicBlackspotSummary } from '../services/roadSafetyBlackspotService';
import { rateLimiter as generalRateLimiter } from '../services/rateLimiter';

// Lucide icons for UI
import {
  MapPin,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Sun,
  CloudRain,
  Trash,
  RefreshCw,
  Loader2,
  Shield,
  Info,
  Map,
  Route,
  UserPlus,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const COORDINATE_PRECISION = 6;
const CELL_SIZE_KM = 1.0;

// ============================================================
// FloodReportForm Component
// ============================================================
function FloodReportForm({ onSubmit, mode = 'submit', existingReport = null, onClose }) {
  const [formData, setFormData] = useState({
    hazardType: FLOOD_HAZARD_TYPES.WATERLOGGING,
    severity: 'medium',
    description: '',
    location: { lat: 0, lng: 0 },
    locationHint: '',
    altitudeMeters: 0,
    confidence: 0.5,
    reporterRole: 'citizen',
    sourceTimestamp: new Date().toISOString(),
    idempotencyKey: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [showIdempotencyWarning, setShowIdempotencyWarning] = useState(false);
  const focusRef = useRef(null);

  useEffect(() => {
    if (existingReport) {
      setFormData({
        hazardType: existingReport.hazardType,
        severity: existingReport.severity || 'medium',
        description: existingReport.description || '',
        location: { ...existingReport.location },
        locationHint: existingReport.locationHint || '',
        altitudeMeters: existingReport.altitudeMeters || 0,
        confidence: existingReport.confidence !== undefined ? existingReport.confidence : 0.5,
        reporterRole: existingReport.reporterRole || 'citizen',
        sourceTimestamp: existingReport.sourceTimestamp || new Date().toISOString(),
        idempotencyKey: existingReport.idempotencyKey || '',
      });
    }
  }, [existingReport]);

  useEffect(() => {
    // Check rate limit status
    const checkRate = floodRateLimiter.take(`user-${Date.now()}`);
    if (!checkRate.allowed) {
      setRateLimited(true);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = value;
    if (type === 'number') val = Number(value);
    if (checked !== undefined) val = checked;
    setFormData({ ...formData, [name]: val });
    // Clear error for this field
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate
    const validationErrors = validateFloodReport(formData);
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors.reduce((acc, err) => {
        acc[err.toLowerCase().replace(/[^a-z0-9\s]/g, '')] = err;
        return acc;
      }, {}));
      return;
    }

    setSubmitting(true);
    try {
      const report = await generateFloodReport({
        ...formData,
        idempotencyKey: formData.idempotencyKey || undefined,
      }, undefined, 'anon-client');
      onSubmit(report);
      if (onClose) onClose();
    } catch (err) {
      // Rate limit error
      if (err.message && err.message.includes('Rate limit')) {
        setRateLimited(true);
      }
      console.error('Flood report submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-generate idempotency key
  useEffect(() => {
    if (!formData.idempotencyKey && formData.description) {
      setFormData({
        ...formData,
        idempotencyKey: `flood-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    }
  }, [formData.description]);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 p-6 bg-white rounded-xl shadow-lg">
      {rateLimited && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4 animate-bounce">
          Rate limit exceeded. You have submitted the maximum number of flood reports in the last 15 minutes. Please wait before reporting again.
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-900">
        {mode === 'submit' ? 'Submit Flood Observation' : 'Edit Flood Report'}
      </h2>

      {/* Hazard Type Select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hazard Type
        </label>
        <div className="space-y-2">
          {Object.entries(FLOOD_HAZARD_TYPES).map(([key, label]) => (
            <label key={key} className="flex items-center space-x-2">
              <input
                type="radio"
                name="hazardType"
                value={key}
                checked={formData.hazardType === key}
                onChange={(e) => handleChange({ target: { name: 'hazardType', value: key, type: 'radio' } })}
                className="rounded border-gray-300 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-describedby={key}
              />
              <span>{SOURCE_TYPE_LABELS[FLOOD_HAZARD_TYPE_LABELS[key] || label] || label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Severity Select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Severity
        </label>
        <div className="space-y-2">
          {['low', 'medium', 'high', 'critical'].map((sev) => (
            <label key={sev} className="flex items-center space-x-2">
              <input
                type="radio"
                name="severity"
                value={sev}
                checked={formData.severity === sev}
                onChange={(e) => handleChange({ target: { name: 'severity', value: sev, type: 'radio' } })}
                className="rounded border-gray-300 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-describedby={sev}
              />
              <span className={`text-${sev === 'critical' ? 'red' : sev === 'high' ? 'orange' : 'green'}-600}`>
                {sev}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
          <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          rows={4}
          placeholder="Describe the waterlogging situation: depth, duration, affected roads, any hazards..."
          value={formData.description}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
          aria-required="true"
          aria-describedby="desc-help"
        />
        <p id="desc-help" className="mt-1 text-xs text-gray-500">
          Keep it under 1000 characters. Be specific about depth, duration, and affected routes.
        </p>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Approximate Location
          <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            name="lat"
            type="number"
            step="0.000001"
            value={formData.location.lat.toFixed(COORDINATE_PRECISION)}
            onChange={(e) => handleChange({ target: { name: 'lat', value: Number(e.target.value), type: 'number' } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
            aria-label="Latitude"
            required
          />
          <input
            name="lng"
            type="number"
            step="0.000001"
            value={formData.location.lng.toFixed(COORDINATE_PRECISION)}
            onChange={(e) => handleChange({ target: { name: 'lng', value: Number(e.target.value), type: 'number' } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
            aria-label="Longitude"
            required
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Coordinates are rounded to ~10m precision. Use your current location or approximate area.
        </p>
      </div>

      {/* Location Hint */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location Hint (optional)
        </label>
        <input
          name="locationHint"
          placeholder="e.g. Near main bus stop, outside school, etc."
          value={formData.locationHint}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
          aria-label="Location hint"
        />
      </div>

      {/* Altitude & Confidence */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Altitude (meters above sea level)
          </label>
          <input
            name="altitudeMeters"
            type="number"
            step="1"
            value={formData.altitudeMeters}
            onChange={(e) => handleChange({ target: { name: 'altitudeMeters', value: Number(e.target.value), type: 'number' } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
            aria-label="Altitude in meters"
          />
          <p className="mt-1 text-xs text-gray-500">Above sea level. Leave blank if unknown.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confidence (0.0 - 1.0)
          </label>
          <input
            name="confidence"
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={formData.confidence}
            onChange={(e) => handleChange({ target: { name: 'confidence', value: Number(e.target.value), type: 'number' } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
            aria-label="Confidence score"
          />
          <p className="mt-1 text-xs text-gray-500">
            How confident are you about this observation? (1.0 = very confident, 0.0 = uncertain)
          </p>
        </div>
      </div>

      {/* Idempotency Key */}
      {mode === 'submit' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Idempotency Key (optional)
          </label>
          <p className="text-sm text-gray-500">
            Re-enter if you want to retry this submission safely. Duplicate keys will return the existing report.
          </p>
          <input
            name="idempotencyKey"
            value={formData.idempotencyKey}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:visible:ring-offset-2 transition-colors"
            placeholder="flood-report-20250115-abc123"
            aria-label="Idempotency key"
          />
          {showIdempotencyWarning && (
            <p className="mt-1 text-sm text-red-600">
              This idempotency key already exists. The existing report will be returned.
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled:className="opacity-50 cursor-not-allowed"
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || rateLimited}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          aria-disabled={submitting || rateLimited}
        >
          {submitting ? 'Submitting...' : rateLimited ? 'Rate Limited' : mode === 'submit' ? 'Submit Observation' : 'Update Report'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// HotspotCell Component
// ============================================================
function HotspotCell({ cell, onViewRoute }) {
  const riskLevel = cell.riskLevel;
  const riskLabel = HOTSPOT_RISK_LEVEL_LABELS[riskLevel] || riskLevel;
  const riskColorClass = riskLevel === HOTSPOT_RISK_LEVELS.CRITICAL ? 'red-600' : riskLevel === HOTSPOT_RISK_LEVELS.HIGH ? 'orange-600' : riskLevel === HOTSPOT_RISK_LEVELS.MODERATE ? 'yellow-600' : 'green-600';
  const riskBgClass = riskLevel === HOTSPOT_RISK_LEVELS.CRITICAL ? 'bg-red-100' : riskLevel === HOTSPOT_RISK_LEVELS.HIGH ? 'bg-orange-100' : riskLevel === HOTSPOT_RISK_LEVELS.MODERATE ? 'bg-yellow-100' : 'bg-green-100';

  const contributingSignalsText = cell.contributingSignals
    .map((sig) => CONTRIBUTING_SIGNALS[sig] || sig)
    .join(', ') || 'None';

  return (
    <div
      key={cell.id}
      className`
        border-2 rounded-xl p-4 mb-3 transition-all cursor-pointer
        hover:border-${riskColorClass} hover:bg-${riskBgClass}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-${riskColorClass}
        accessible viewbox
      `
      role="button"
      tabIndex={0}
      onClick={() => onViewRoute(cell)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewRoute(cell);
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Cell {cell.gridIndex + 1}
          </span>
          <span
            className`
              inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
              ${riskBgClass} ${riskColorClass}
            `
          >
            {riskLabel}
          </span>
        </div>

        <p className="text-xs text-gray-500">
          Lat: {cell.lat.toFixed(4)}, Lng: {cell.lng.toFixed(4)}
        </p>

        <p className="text-xs text-gray-500">
          {cell.note || 'No additional notes'}
        </p>

        <details className="mt-2">
          <summary className="text-xs font-medium text-indigo-600 cursor-pointer">
            Contributing Signals
          </summary>
          <p className="text-xs text-gray-500 mt-1">{contributingSignalsText}</p>
        </details>

        {cell.associatedDrainageAssetId && (
          <p className="mt-1 text-xs text-gray-500">
            Associated drainage: {cell.associatedDrainageAssetId}
          </p>
        )}

        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Confidence: {Number(cell.confidence).toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">
            {cell.forecastWindowStart} - {cell.forecastWindowEnd}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RouteAdvisory Component
// ============================================================
function RouteAdvisoryCard({ advisory }) {
  const status = advisory.status;
  const statusLabel = ROUTE_ADVISORY_STATUS_LABELS[status] || status;
  const statusBg = status === ROUTE_ADVISORY_STATUS.ACTIVE ? 'bg-green-100' : status === ROUTE_ADVISORY_STATUS.EXPIRED ? 'bg-gray-100' : 'bg-red-100';
  const statusColor = status === ROUTE_ADVISORY_STATUS.ACTIVE ? 'green-600' : status === ROUTE_ADVISORY_STATUS.EXPIRED ? 'gray-600' : 'red-600';

  const originText = `${advisory.origin.lat.toFixed(4)}, ${advisory.origin.lng.toFixed(4)}`;
  const destText = `${advisory.destination.lat.toFixed(4)}, ${advisory.destination.lng.toFixed(4)}`;

  return (
    <div
      key={advisory.id}
      className`
        border rounded-lg p-5 bg-white shadow-sm transition-all
        hover:border-${statusColor} hover:bg-${statusBg}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-${statusColor}
      `
      role="region"
      aria-label={`Route advisory from ${originText} to ${destText}, status: ${statusLabel}`}
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            From: {originText}
          </p>
          <p className="text-sm font-medium text-gray-700">
            To: {destText}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Estimated time: {advisory.estimatedTimeMinutes} min
          </span>
          <span
            className`
              inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
              ${statusBg} ${statusColor}
            `
          >
            {statusLabel}
          </span>
        </div>

        {advisory.avoidFloodHotspots && advisory.hotspotCellIds.length > 0 && (
          <div>
            <p className="text-xs text-gray-600">
              Avoiding {advisory.hotspotCellIds.length} flood hotspot{advisory.hotspotCellIds.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 text-xs text-gray-500 space-y-0.5">
              {advisory.hotspotCellIds.map((cellId) => (
                <li key={cellId} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {cellId}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!advisory.avoidFloodHotspots && (
          <p className="text-xs text-green-600">
            No flood hotspots on direct route
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Created: {new Date(advisory.createdAt).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            Expires: {new Date(advisory.expiresAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FloodHotspotPage Component
// ============================================================
export default function FloodHotspotPage() {
  const [actor, setActor] = useState(null);
  const [phase, setPhase] = useState('view'); // view, submit, forecast, routes
  const [reportFormMode, setReportFormMode] = useState('submit'); // submit, edit

  // State for report submission
  const [submittedReport, setSubmittedReport] = useState(null);
  const [forecastRun, setForecastRun] = useState(null);
  const [hotspotCells, setHotspotCells] = useState([]);
  const [routeAdvisory, setRouteAdvisory] = useState(null);

  // Form states
  const [formError, setFormError] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [forecastStatus, setForecastStatus] = useState('idle'); // idle, preparing, running, completed

  // Check auth on mount
  useEffect(() => {
    // In a real app, this would check Clerk/Firebase auth
    // For now, set a default citizen actor
    setActor({ id: 'cit-1', role: 'citizen', username: 'Community Member' });
  }, []);

  const requireFloodPermission = (permission) => {
    if (!actor) return false;
    return checkPermission(permission, actor) === 'ok';
  };

  // ── Submit Report Workflow ────────────────────────────────
  const handleSubmitReport = async (report) => {
    setSubmittedReport(report);
    setPhase('view');
    setFormError(null);
  };

  const handleCloseReportForm = () => {
    setPhase('view');
    setSubmittedReport(null);
  };

  // ── Forecast Run Workflow ──────────────────────────────────
  const handleExecuteForecast = async () => {
    if (!requireFloodPermission('flood.intelligence.execute')) {
      alert('You do not have permission to execute flood forecasts. Admin access required.');
      return;
    }

    setForecastStatus('preparing');
    try {
      const run = await generateForecastRun({
        featureWindowStart: new Date().toISOString().split('T')[0],
        featureWindowEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7-day window
        inputRecordsCount: 0, // Will be populated by the service
        weights: {
          [CONTRIBUTING_SIGNALS.RAINFALL_FORECAST]: 0.4,
          [CONTRIBUTING_SIGNALS.DRAINAGE_CAPACITY]: 0.25,
          [CONTRIBUTING_SIGNALS.ELEVATION]: 0.15,
          [CONTRIBUTING_SIGNALS.COMMUNITY_OBSERVATIONS]: 0.1,
          [CONTRIBUTING_SIGNALS.RECENT_REPORTS]: 0.1,
        },
      }, undefined, actor);
      setForecastRun(run);
      setForecastStatus('running');

      // Compute hotspot cells
      const { cells } = await computeHotspotCells(run.id, undefined, actor);
      setHotspotCells(cells);
      setForecastStatus('completed');
    } catch (err) {
      console.error('Forecast execution error:', err);
      setForecastStatus('idle');
      alert(err.message || 'Failed to execute forecast');
    }
  };

  const handleCloseForecast = () => {
    setForecastRun(null);
    setHotspotCells([]);
    setForecastStatus('idle');
  };

  // ── Route Advisory Workflow ────────────────────────────────
  const handleGenerateRoute = async (origin, destination) => {
    if (!requireFloodPermission('flood.route.advisory')) {
      alert('You do not have permission to generate route advisories.');
      return;
    }

    try {
      const advisory = await generateRouteAdvisory(origin, destination, undefined, 'anon-client');
      setRouteAdvisory(advisory);
    } catch (err) {
      console.error('Route advisory error:', err);
      alert(err.message || 'Failed to generate route advisory');
    }
  };

  const handleCloseRouteAdvisory = () => {
    setRouteAdvisory(null);
  };

  // ── Report State Transition (moderator only) ────────────────
  const handleTransitionReportState = async (reportId, targetState, reason) => {
    if (!requireFloodPermission('flood.report.moderate')) {
      alert('You do not have permission to moderate flood reports.');
      return;
    }

    try {
      const updated = await transitionFloodReportState(reportId, targetState, undefined, actor);
      // Refresh cells if needed
      alert(`Report state transitioned from ${FLOOD_REPORT_STATE_LABELS[reportId ? /* need to look up */ 'submitted'] : '?'} to ${FLOOD_REPORT_STATE_LABELS[targetState]}`);
    } catch (err) {
      alert(err.message || 'Failed to transition report state');
    }
  };

  // ── Render appropriate phase ────────────────────────────────
  if (phase === 'submit') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Submit Flood Observation
        </h1>
        <FloodReportForm
          onSubmit={handleSubmitReport}
          onClose={handleCloseReportForm}
          mode={reportFormMode}
        />
      </div>
    );
  }

  if (phase === 'view') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hyperlocal Flood Hotspot Forecast & Safe-Route Advisory
            </h1>
            <p className="text-gray-600">
              Combined rainfall forecasts, drainage assets, terrain and community observations to identify potential waterlogging hotspots.
            </h1>
          </div>

          {/* Auth controls */}
          {actor ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Welcome, {actor.username}
              </span>
              {roleOf(actor) === 'admin' && (
                <button
                  onClick={() => setPhase('admin')}
                  className="px-3 py-1 text-xs text-indigo-600 hover underline"
                >
                  Admin Panel
                </button>
              )}
              {!requireFloodPermission('flood.report.submit') && (
                <span className="text-xs text-gray-400">
                  {roleOf(actor) === 'admin' ? 'Admin' : 'Citizen'}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setPhase('submit')}
              className="px-4 py-2 text-sm text-indigo-600 hover underline"
            >
              Sign in to submit observation
            </button>
          )}
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Left: Hotspot Map Summary */}
          <div>
            <h2 className="text-lg font-medium text-gray-800 mb-4">
              Current Flood Hotspots
            </h2>

            {/* Loading / Empty / Error states */}
            {forecastStatus === 'preparing' && (
              <div className="p-4 text-center text-gray-500">
                <Loader2 className="w-6 h-6 mx-auto mb-2" />
                <span>Preparing forecast run...</span>
              </div>
            )}

            {forecastStatus === 'running' && (
              <div className="p-4 text-center text-gray-500">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <span>Running flood risk model...</span>
              </div>
            )}

            {forecastStatus === 'completed' && hotspotCells.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {hotspotCells.map((cell) => (
                  <HotspotCell key={cell.id} cell={cell} onViewRoute={() => {/* navigate to route */}} />
                ))}
              </div>
            )}

            {forecastStatus === 'completed' && hotspotCells.length === 0 && (
              <div className="p-4 text-center text-gray-400">
                <span className="text-lg">No hotspot cells generated.</span>
                <p className="mt-1 text-sm">Try submitting more community observations or adjust the forecast window.</p>
              </div>
            )}

            {forecastStatus === 'idle' && hotspotCells.length === 0 && (
              <div className="p-4 text-center text-gray-400">
                <span>No forecast run executed.</span>
                <p className="mt-1 text-sm">
                  Execute a forecast run to generate hotspot cells, or submit community observations.
                </p>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md mb-4 animate-shake">
                {formError}
              </div>
            )}

            {isRateLimited && (
              <div className="p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md mb-4 animate-shake">
                Rate limited. Wait before submitting more observations.
              </div>
            )}
          </div>

          {/* Middle: Forecast Controls (admin) */}
          {roleOf(actor) === 'admin' && (
            <div>
              <h2 className="text-lg font-medium text-gray-800 mb-4">
                Flood Forecast Controls
              </h2>

              <div className="p-4 bg-white rounded-md shadow-sm mb-4">
                <p className="text-sm text-gray-600">
                  Execute a geospatial risk model run to generate hotspot cells.
                </p>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Feature Window Start
                    </label>
                    <input
                      type="date"
                      value={forecastRun?.featureWindowStart?.split('T')[0] || ''}
                      onChange={(e) => {
                        // Update forecast run start
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Feature Window End
                    </label>
                    <input
                      type="date"
                      value={forecastRun?.featureWindowEnd?.split('T')[0] || ''}
                      onChange={(e) => {
                        // Update forecast run end
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleExecuteForecast}
                  className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  disabled={forecastStatus !== 'idle'}
                >
                  {forecastStatus === 'idle' ? 'Execute Flood Risk Model' : 'Running...'}
                </button>

                {forecastRun && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-800">
                      Run: {forecastRun.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status: {FORECAST_RUN_STATE_LABELS[forecastRun.status] || forecastRun.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      Input records: {forecastRun.inputRecordsCount}
                    </p>
                    <p className="text-xs text-gray-500">
                      Hotspot cells generated: {forecastRun.hotspotCellsGenerated}
                    </p>
                    <p className="text-xs text-gray-500">
                      Executed by: {forecastRun.executedBy}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {forecastRun.disclaimer || 'Flood forecasts require human verification.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right: Route Advisory */}
          <div>
            <h2 className="text-lg font-medium text-gray-800 mb-4">
              Safe Route Advisory
            </h2>

            {/* Route form */}
            <div className="p-4 bg-white rounded-md shadow-sm mb-4">
              <p className="text-sm text-gray-600">
                Get an alternative route avoiding flood hotspots.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Origin (lat/lng)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 28.7041"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  <p className="text-xs text-gray-500">Latitude</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Destination (lat/lng)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 77.1025"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500">Longitude</p>
                </div>
              </div>

              <button
                onClick={() => handleGenerateRoute({ lat: 28.7041, lng: 77.1025 }, { lat: 28.7050, lng: 77.1040 })}
                className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                Generate Safe Route
              </button>
            </div>

            {/* Route result */}
            {routeAdvisory && (
              <RouteAdvisoryCard advisory={routeAdvisory} />
            )}

            {!routeAdvisory && (
              <p className="text-gray-500 text-sm">
                Enter origin and destination to get a safe route advisory.
              </p>
            )}
          </div>
        </div>

        {/* Admin moderation panel (floating at bottom for admin) */}
        {roleOf(actor) === 'admin' && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-xl shadow-md">
            <h3 className="text-sm font-medium text-indigo-700 mb-3">
              Moderation Panel
            </h3>
            <p className="text-xs text-indigo-600">
              Use the report form above or access stored reports to moderate flood observations.
            </p>
            <button
              onClick={() => setPhase('moderate')}
              className="mt-2 px-3 py-1 text-xs text-indigo-600 hover underline"
            >
              Moderate Reports
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}