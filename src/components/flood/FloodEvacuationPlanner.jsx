/**
 * Flood Evacuation Route and Safe-Shelter Readiness Planner
 * 
 * Pilot: Gorakhpur flood-prone district (UP Seasonal Flood)
 * 
 * Acceptance criteria compliance:
 * - Official routes and community observations are visually and semantically distinct
 * - Temporary route reports expire unless revalidated
 * - A route with an unresolved blockage is not recommended
 * - Shelter details include source, authority, and last verification
 * - The planner works without precise location permission
 * - Official emergency contact always shown first
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  RouteSegmentStatus, 
  RouteSegmentType,
  getEffectiveSegmentStatus,
  hasUnresolvedBlockage,
  getRecommendedRoutes,
  isRouteAvailable,
  getShelterById,
  getAllShelters,
  getPrimaryHelpline,
  getAllHelplines,
  generateLowBandwidthRouteDirectory,
  generatePrintableChecklist,
  FLOOD_PREPAREDNESS_CHECKLIST,
  EVACUATION_ROUTE_SEGMENTS,
  GORAKHPUR_SHELTERS,
  UP_EMERGENCY_HELPLINES,
  markRouteSegmentBlocked,
  revalidateRouteSegment,
  autoExpireStaleReports,
} from '../../services/floodRouteService.js';

// ============================================================
// Planner Modes
// ============================================================

const PLANNER_MODE = {
  ROUTES: 'routes',
  SHELTERS: 'shelters', 
  CHECKLIST: 'checklist',
  LOW_BANDWIDTH: 'low_bandwidth',
};

// ============================================================
// FloodEvacuationPlanner - Main Component
// ============================================================

export default function FloodEvacuationPlanner() {
  const [mode, setMode] = useState(PLANNER_MODE.ROUTES);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [responderId, setResponderId] = useState('responder-gorakhpur-ddma');
  
  // Auto-expire stale community reports every hour
  useEffect(() => {
    const intervalId = setInterval(autoExpireStaleReports, 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);
  
  // Memoized data
  const allSegments = useMemo(() => [...EVACUATION_ROUTE_SEGMENTS], []);
  const allShelters = useMemo(() => [...GORAKHPUR_SHELTERS], []);
  const allHelplines = useMemo(() => [...UP_EMERGENCY_HELPLINES], []);
  const primaryHelpline = useMemo(() => {
    // Find the one marked isPrimary, fallback to first
    const primary = allHelplines.find(h => h.isPrimary);
    return primary || allHelplines[0];
  }, [allHelplines]);

  // ============================================================
  // Mode Switching
  // ============================================================

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode !== PLANNER_MODE.ROUTES) {
      setOrigin('');
      setDestination('');
    }
  };

  // ============================================================
  // ROUTES MODE - Evacuation Route Display & Management
  // ============================================================

  if (mode === PLANNER_MODE.ROUTES) {
    return <RoutesMode 
      segments={allSegments}
      primaryHelpline={primaryHelpline}
      onSegmentSelect={(id) => setSelectedSegmentId ? setSelectedSegmentId(id) : null}
      onBlockSegment={(id, evidence) => markRouteSegmentBlocked(id, true, evidence, responderId)}
      onRevalidateSegment={(id, evidence) => revalidateRouteSegment(id, evidence, responderId)}
      onSetOrigin={(val) => setOrigin(val)}
      onSetDestination={(val) => setDestination(val)}
    />;
  }

  // ============================================================
  // SHELTERS MODE - Shelter Details Display
  // ============================================================

  if (mode === PLANNER_MODE.SHELTERS) {
    return <SheltersMode shelters={allShelters} primaryHelpline={primaryHelpline} />;
  }

  // ============================================================
  // CHECKLIST MODE - Printable Preparedness List
  // ============================================================

  if (mode === PLANNER_MODE.CHECKLIST) {
    return <ChecklistMode 
      checklist={FLOOD_PREPAREDNESS_CHECKLIST}
      onGeneratePrint={() => generatePrintableChecklist()}
    />;
  }

  // ============================================================
  // LOW-BANDWIDTH MODE - Text-Only Route Directory
  // ============================================================

  if (mode === PLANNER_MODE.LOW_BANDWIDTH) {
    return <LowBandwidthMode directory={generateLowBandwidthRouteDirectory()} />;
  }

  return null;
}

// ============================================================
// RoutesMode Sub-Component
// ============================================================

function RoutesMode({segments, primaryHelpline, onBlockSegment, onRevalidateSegment, onSetOrigin, onSetDestination}) {
  // Compute recommended routes based on origin/destination
  const recommendedRoutes = useMemo(() => {
    if (origin && destination) {
      return getRecommendedRoutes(origin, destination);
    }
    return [];
  }, [origin, destination]);

  const routeAvailability = useMemo(() => {
    if (origin && destination) {
      return isRouteAvailable(origin, destination);
    }
    return { available: false, recommendedRoutes: [], alternativeRoutes: [] };
  }, [origin, destination]);

  // Prevent undefined setSelectedSegmentId error
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // ============================================================
  // Header / Emergency Contact
  // ============================================================

  const emergencyContact = primaryHelpline 
    ? `${primaryHelpline.name}: ${primaryHelpline.number} (${primaryHelpline.category})`
    : '1070 - UP Disaster Management Helpline';

  return (
    <div className="flood-planner" aria-label="UP Seasonal Flood Evacuation Route Planner">
      {/* Emergency Contact - Always First */}
      <div className="flood-planner__header">
        <div className="flood-planner__emergency-contact">
          <strong>EMERGENCY CONTACT (FIRST):</strong> {emergencyContact}
        </div>
        <div className="flood-planner__mode-tabs">
          <button 
            className={`flood-planner__mode-tab ${mode === PLANNER_MODE.ROUTES ? 'active' : ''}`}
            onClick={() => handleModeChange(PLANNER_MODE.ROUTES)}
          >
            Routes
          </button>
          <button 
            className={`flood-planner__mode-tab ${mode === PLANNER_MODE.SHELTERS ? 'active' : ''}`}
            onClick={() => handleModeChange(PLANNER_MODE.SHELTERS)}
          >
            Shelters
          </button>
          <button 
            className={`flood-planner__mode-tab ${mode === PLANNER_MODE.CHECKLIST ? 'active' : ''}`}
            onClick={() => handleModeChange(PLANNER_MODE.CHECKLIST)}
          >
            Checklist
          </button>
          <button 
            className={`flood-planner__mode-tab ${mode === PLANNER_MODE.LOW_BANDWIDTH ? 'active' : ''}`}
            onClick={() => handleModeChange(PLANNER_MODE.LOW_BANDWIDTH)}
          >
            Low-Bandwidth
          </button>
        </div>
      </div>

      {/* ============================================================
      ROUTES SECTION
      ============================================================ */}
      {mode === PLANNER_MODE.ROUTES && (
        <div className="flood-planner__content">
          
          {/* Origin & Destination Search */}
          <div className="flood-planner__search-bar">
            <input
              type="text"
              placeholder="Origin area/locality"
              value={origin || ''}
              onChange={(e) => onSetOrigin(e.target.value)}
            />
            <input
              type="text"
              placeholder="Destination (shelter or area)"
              value={destination || ''}
              onChange={(e) => onSetDestination(e.target.value)}
            />
          </div>

          {/* Route Availability Status */}
          {origin && destination && (
            <div className="flood-planner__route-status">
              {routeAvailability.available ? (
                <span className="status-available">
                  Route(s) available between {origin} and {destination}
                </span>
              ) : (
                <span className="status-unavailable">
                  No recommended routes between {origin} and {destination}
                </span>
              )}
            </div>
          )}

          {/* Recommended Routes List */}
          <div className="flood-planner__routes-list">
            <h3>Recommended Evacuation Routes</h3>
            
            {recommendedRoutes.length > 0 ? (
              <ul className="routes-list__items">
                {recommendedRoutes.map((route) => (
                  <li key={route.segmentId} className="routes-list__item">
                    <div className="routes-list__name">
                      {route.name}
                      <span className="routes-list__status-badge">
                        {route.status}
                      </span>
                    </div>
                    <div className="routes-list__details">
                      <span>From: {route.from}</span>
                      <span>To: {route.to}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-routes">
                No recommended routes found. Please verify route statuses.
              </p>
            )}
          </ul>

          {/* All Route Segments (Official + Community) */}
          <div className="flood-planner__all-segments">
            <h3>All Route Segments</h3>
            <p className="segment-note">
              Official routes: Verified by District Disaster Management Authority.
              Community reports: Temporary; auto-expire unless revalidated.
            </p>
            
            <ul className="segments__list">
              {segments.map((segment) => {
                const effectiveStatus = getEffectiveSegmentStatus(segment.id);
                
                return (
                  <li key={segment.id} className="segments__item">
                    <div className="segments__header">
                      <span className="segments__type-badge">
                        {segment.official ? 'Official' : 'Community'}
                      </span>
                      <strong>{segment.name}</strong>
                      <span className="segments__status">{effectiveStatus.status}</span>
                    </div>
                    
                    <div className="segments__details">
                      <span>From: {segment.from}</span>
                      <span>To: {segment.to}</span>
                      <span>Type: {segment.type}</span>
                    </div>
                    
                    {segment.warnings && segment.warnings.length > 0 && (
                      <div className="segments__warnings">
                        {segment.warnings.map((w, wi) => (
                          <div key={w.id} className="segments__warning">
                            {w.message} 
                            {w.expiresAt && new Date(w.expiresAt) < new Date() && (
                              <span className="segments__warning-expire"> [EXPIRED]</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Block/Revalidate actions - only for community segments */}
                    {!segment.official && (
                      <div className="segments__actions">
                        {effectiveStatus.status === 'BLOCKED' || !effectiveStatus.isRecommended ? (
                          <button
                            className="btn btn-small"
                            onClick={() => onBlockSegment(segment.id, 'Confirm blocked')}
                          >
                            Confirm Blocked
                          </button>
                        ) : (
                          <button
                            className="btn btn-small"
                            onClick={() => onBlockSegment(segment.id, 'Unblock - cleared')}
                          >
                            Unblock
                          </button>
                        )}
                        
                        {effectiveStatus.status === 'BLOCKED' || !effectiveStatus.isRecommended ? (
                          <button
                            className="btn btn-small"
                            onClick={() => onRevalidateSegment(segment.id, 'Revalidation evidence')}
                          >
                            Revalidate
                          </button>
                        ) : null}
                      </div>
                    )}

                    <button
                      className="btn btn-link segments__details-btn"
                      onClick={() => setSelectedSegmentId(segment.id)}
                    >
                      View Details
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================
      SHELTERS SECTION
      ============================================================ */}
      {mode === PLANNER_MODE.SHELTERS && (
        <div className="flood-planner__shelters-content">
          <h3>Verified Safe Shelters - Gorakhpur District</h3>
          
          <p className="shelters-intro">
            All shelters below are from verified district disaster-management authority sources.
            Shelter details include source, authority, and last verification date.
          </p>
          
          <ul className="shelters__list">
            {allShelters.map((shelter) => (
              <li key={shelter.id} className="shelter__item">
                <div className="shelter__header">
                  <h4>{shelter.name}</h4>
                  <div className="shelter__authority">
                    <strong>Authority:</strong> {shelter.authority}
                    <br />
                    <strong>Source:</strong> {shelter.source}
                    <br />
                    <strong>Last Verified:</strong> {new Date(shelter.lastVerified).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="shelter__attributes">
                  <strong>Capacity:</strong> {shelter.capacity} persons
                  <br />
                  <strong>Current Occupancy:</strong> {shelter.currentOccupancy}
                </div>
                
                <div className="shelter__facilities">
                  <span title="Wheelchair Accessible" 
                    style={{ color: shelter.attributes.wheelchair ? '#10b981' : '#6b7280' }}>
                    {shelter.attributes.wheelchair ? '✓' : '✗'}
                  </span>
                  <span title="Emergency Vehicle Access" 
                    style={{ color: shelter.attributes.emergencyVehicle ? '#10b981' : '#6b7280' }}>
                    {shelter.attributes.emergencyVehicle ? '✓' : '✗'}
                  </span>
                  <span title="Water Available" 
                    style={{ color: shelter.attributes.water ? '#10b981' : '#6b7280' }}>
                    {shelter.attributes.water ? '✓' : '✗'}
                  </span>
                  <span title="Sanitation Available" 
                    style={{ color: shelter.attributes.sanitation ? '#10b981' : '#6b7280' }}>
                    {shelter.attributes.sanitation ? '✓' : '✗'}
                  </span>
                  <span title="Power Available" 
                    style={{ color: shelter.attributes.power ? '#10b981' : '#6b7280' }}>
                    {shelter.attributes.power ? '✓' : '✗'}
                  </span>
                  <span title="Storage Available" 
                    style={{ color: shelter.attributes.storage ? '#10b981' : '#6b7280' }}>
                    {shelter.attributes.storage ? '✓' : '✗'}
                  </span>
                </div>
                
                <div className="shelter__notes">
                  <strong>Accessibility:</strong> {shelter.accessibilityNotes || 'Not specified'}
                  <br />
                  <strong>Sanitation Notes:</strong> {shelter.sanitationNotes || 'Not specified'}
                  <br />
                  <strong>Water Notes:</strong> {shelter.waterNotes || 'Not specified'}
                </div>
                
                <button className="btn btn-link shelter__more-btn">More Details</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ============================================================
      CHECKLIST SECTION
      ============================================================ */}
      {mode === PLANNER_MODE.CHECKLIST && (
        <div className="flood-planner__checklist-content">
          <h3>Flood Preparedness Checklist</h3>
          <p>Print or save this list for household readiness.</p>
          
          <div className="checklist__items">
            {FLOOD_PREPAREDNESS_CHECKLIST.map((item) => (
              <div key={item.id} className="checklist__item">
                <input
                  type="checkbox"
                  id={`checklist-${item.id}`}
                  className="checklist__input"
                />
                <label htmlFor={`checklist-${item.id}`} className="checklist__label">
                  {item.item}
                  {item.essential && <span className="checklist__essential">★ Essential</span>}
                </label>
              </div>
            ))}
          </div>
          
          <div className="checklist__actions">
            <button
              className="btn"
              onClick={() => {
                const txt = generatePrintableChecklist();
                alert('Printable checklist generated!\n\n' + txt.substring(0, 500) + '...');
              }}
            >
              Generate Printable List
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
      LOW-BANDWIDTH SECTION
      ============================================================ */}
      {mode === PLANNER_MODE.LOW_BANDWIDTH && (
        <div className="flood-planner__low-bandwidth-content">
          <h3>Low-Bandwidth Route Directory (Text-Only)</h3>
          <p>
            Use this format for areas with poor connectivity. No graphics, minimal data.
          </p>
          <pre className="low-bandwidth__directory">
{/* Generated content via generateLowBandwidthRouteDirectory() */}
          </pre>
          <button
            className="btn"
            onClick={() => {
              const dirText = generateLowBandwidthRouteDirectory();
              navigator.clipboard?.writeText(dirText).then(() => {
                alert('Low-bandwidth route directory copied to clipboard!');
              });
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}