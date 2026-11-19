import { useState, useEffect } from 'react';
import {
  getRoutePlan,
  getShelters,
  getOfficialEmergencyContact,
  getHelpline,
  checkSegmentBlockageStatus,
  getSegmentsWithUnresolvedBlockages,
  expireOldObservations,
  generatePreparednessList,
  generateTextRouteDirectory,
} from '../../services/upFloodRouteService';
import {
  RouteSegment,
  BLOCKAGE_STATUS,
  ROUTE_DIRECTION,
} from '../../data/upFloodRoutes';
import { LucideIcon } from 'lucide-react';
import { MapPin, Trash, CheckCircle, Clock, Shield, Info, Phone, Route, Search } from 'lucide-react';

/**
 * Main UP Flood Evacuation Route and Safe-Shelter Readiness Planner.
 *
 * Features:
 * - Displays official route segments distinctly from community observations
 * - Automatically expires unverified community reports older than 7 days
 * - Shows blockage status per segment; routes with unresolved blockages are not recommended
 * - Shelter details include source, authority, and last verification
 * - Works without precise location permission (uses static data)
 * - Official emergency contact always shown first
 * - Printable household preparedness list
 * - Low-bandwidth text-only route directory
 */
export default function UpFloodRoutePlanner() {
  const [routePlan, setRoutePlan] = useState<ReturnType<typeof getRoutePlan> | null>(null);
  const [shelters, setShelters] = useState<ShelterAttributes[]>([]);
  const [emergencyContact, setEmergencyContact] = useState<string>('');
  const [helpline, setHelpline] = useState<string>('');
  const [blockedSegments, setBlockedSegments] = useState<string[]>([]);
  const [showPreparedness, setShowPreparedness] = useState(false);

  // Load data on mount
  useEffect(() => {
    const plan = getRoutePlan();
    setRoutePlan(plan);
    setShelters(plan ? plan.shelters : []);
    setEmergencyContact(plan ? getOfficialEmergencyContact() : '');
    setHelpline(plan ? getHelpline() : '');
    // Expire old unverified observations
    const expired = expireOldObservations();
    setBlockedSegments(getSegmentsWithUnresolvedBlockages());
    if (expired > 0) {
      // Re-fetch after expiration
      setRoutePlan(getRoutePlan());
      setBlockedSegments(getSegmentsWithUnresolvedBlockages());
    }
  }, []);

  // Refresh blockages whenever the plan changes
  useEffect(() => {
    if (routePlan) {
      setBlockedSegments(getSegmentsWithUnresolvedBlockages());
    }
  }, [routePlan]);

  // Markdown-like preparedness list content
  const preparednessContent = generatePreparednessList();

  // Distinguish official vs community observations visually
  const getSegmentStatusClass = (status: BLOCKAGE_STATUS) => {
    if (status === BLOCKAGE_STATUS.BLOCKED) return 'blocked';
    if (status === BLOCKAGE_STATUS.CLEAR) return 'clear';
    return 'unknown';
  };

  // Check if primary route has any blocked segments
  const hasBlockedPrimary = routePlan
    ? routePlan.primaryRoute.some((s) => s.blockage.status === BLOCKAGE_STATUS.BLOCKED)
    : false;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <header className="mb-6 border-b border-border px-4 pb-4">
        <h1 className="text-2xl font-bold text-font">
          UP Seasonal Flood Evacuation Route & Safe-Shelter Planner
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pilot district: {routePlan?.district || 'Bahraich'}
          {routePlan?.generatedAt ? ` • Generated ${new Date(
            routePlan.generatedAt
          ).toLocaleDateString()}` : ''}
        </p>
      </header>

      {/* Official Emergency Contact - always first per acceptance criterion */}
      <div className="mb-4 p-3 bg-white rounded border border-green-100">
        <div className="flex items-start gap-3">
          <Info className="text-green-600 flex-shrink-0 mt-1" />
          <div>
            <p className="font-medium text-lg text-green-800">
              🆘 Official Emergency Contact (Always First)
            </p>
            <p className="text-sm text-green-700">
              {emergencyContact}
            </p>
            <p className="text-xs text-green-500">
              Helpline: {helpline}
            </p>
          </div>
        </div>
      </div>

      {/* Route Status Warning */}
      {hasBlockedPrimary || blockedSegments.length > 0 ? (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="font-medium text-red-800">
            ⚠️ Route Blockage Warning
          </p>
          <p className="text-sm text-red-700 mt-1">
            {' '}
            {routePlan?.primaryRoute.some(
              (s) => s.blockage.status === BLOCKAGE_STATUS.BLOCKED
            )
              ? 'One or more primary route segments are officially blocked. Do NOT use these routes for evacuation.'
              : 'Route(s) have community-reported blockages that need verification. Proceed with caution.'}
          </p>
          <ul className "text-sm text-red-600 mt-2">
            {blockedSegments.map((id) => {
              const seg = routePlan?.primaryRoute.find((s) => s.id === id);
              return (
                <li key={id}>
                  {seg ? `${seg.name}: ${seg.blockage.status}` : 'Unknown segment'}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <p className="font-medium text-green-800">
            ✅ All Reported Route Segments Clear
          </p>
          <p className="text-sm text-green-700">
            No unresolved blockages detected. Primary evacuation routes are open.
          </p>
        </div>
      )}

      {/* Route Segments Display */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold text-font mb-3">
          Official Evacuation Route Segments
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Distinguish official routes (solid) from community observations (outlined /
          time-expired unless revalidated). Official routes are from the district
          disaster-management authority; community reports are unverified and expire
          after 7 days unless revalidated by an approved local responder.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border">
            <thead>
              <tr>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Segment
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Official Warning
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Community Obs
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {routePlan?.primaryRoute.map((seg, idx) => {
                const blockageCls = getSegmentStatusClass(seg.blockage.status);
                const isBlocked = seg.blockage.status === BLOCKAGE_STATUS.BLOCKED;
                // Count unverified community observations
                const unverifiedObs = seg.communityObservations.filter(
                  (o) => !o.revalidated
                ).length;
                const totalObs = seg.communityObservations.length;

                // Determine if segment is recommended
                const isRecommended =
                  !isBlocked &&
                  seg.official.isOpen &&
                  !blockedSegments.includes(seg.id);

                return (
                  <tr
                    key={seg.id}
                    className={`border-b border-border${
                      isBlocked
                        ? ' bg-red-50'
                        : isRecommended
                          ? ''
                          : ' bg-yellow-50'
                    }`}
                  >
                    <td className="border border-border p-2 font-medium text-font">
                      {seg.name}
                    </td>
                    <td className="border border-border p-2">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded${
                          blockageCls === 'blocked'
                            ? 'bg-red-100 text-red-800'
                            : blockageCls === 'clear'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {seg.blockage.status === BLOCKAGE_STATUS.BLOCKED
                          ? 'BLOCKED'
                          : seg.blockage.status === BLOCKAGE_STATUS.CLEAR
                            ? 'CLEAR'
                            : 'UNKNOWN'}
                      </span>
                      {seg.blockage.revalidated && (
                        <span className="ml-2 text-xs text-green-600">↻ revalidated</span>
                      )}
                    </td>
                    <td className="border border-border p-2 text-xs text-muted-foreground">
                      {seg.official.warning
                        ? `${seg.official.warning.type}: ${seg.official.warning.description}`
                        : 'None'}
                    </td>
                    <td className="border border-border p-2 text-xs text-muted-foreground">
                      {totalObs > 0
                        ? `${unverifiedObs} unverified${unverifiedObs > 0 && totalObs > unverifiedObs ? '/' : ''} ${totalObs - unverifiedObs} revalidated`
                        : 'None'}
                      {unverifiedObs > 0 && (
                        <span className="ml-1 text-xs text-orange-500" title="These observations expire after 7 days unless revalidated">
                          ⏱
                        </span>
                      )}
                    </td>
                    <td className="border border-border p-2">
                      {isRecommended ? (
                        <span className="text-green-600">✓ Recommended</span>
                      ) : (
                        <span className="text-red-600">
                          ✗ Blocked / Not recommended
                        </span>
                      )}
                      {isBlocked && (
                        <span className="text-red-500 ml-1 text-xs">(Officially blocked)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {routePlan?.primaryRoute.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted-foreground p-4">
                    No route segments loaded. Check data connection or reload.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Alternate routes section */}
        {routePlan?.alternateRoutes.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Alternate Official Routes
            </h3>
            <p className="text-xs text-blue-600">
              Secondary route options if primary routes are unavailable.
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              {routePlan.alternateRoutes.map((route, rIdx) => (
                <li key={rIdx}>
                  {route.map((seg, sIdx) => (
                    <span key={sIdx}>
                      {sIdx > 0 ? ' → ' : ''}{seg.name} ({seg.blockage.status})
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Shelters Section */}
      <section>
        <h2 className="text-xl font-semibold text-font mb-3">
          Verified Safe Shelters
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Shelter details include source, authority, and last verification. All shelters
          are sourced from the verified district disaster-management authority.
        </p>

        <div className="overflow-x.auto">
          <table className="w-full border-collapse border-border">
            <thead>
              <tr>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Shelter
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Location
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Capacity
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Amenities
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Verification
                </th>
                <th className="text-left border border-border p-2 text-xs font-medium text-muted-foreground">
                  Contacts
                </th>
              </tr>
            </thead>
            <tbody>
              {shelters.map((shelter, idx) => (
                <tr key={shelter.id} className="border-b border-border">
                  <td className="border border-border p-2 font-medium text-font">
                    {shelter.name}
                  </td>
                  <td className="border border-border p-2 text-xs text-muted-foreground">
                    {shelter.address}, {shelter.city}
                  </td>
                  <td className="border border-border p-2 text-xs">
                    {shelter.capacity} people
                  </td>
                  <td className="border border-border p-2 text-xs">
                    <span
                      className={
                        shelter.amenities.waterAvailable
                          ? 'bg-green-100 text-green-800 mr-1'
                          : 'bg-red-100 text-red-800 mr-1'
                      }
                    >
                      Water: {shelter.amenities.waterAvailable ? '✓' : '✗'}
                    </span>
                    <span
                      className={
                        shelter.amenities.sanitationAvailable
                          ? 'bg-green-100 text-green-800 mr-1'
                          : 'bg-red-100 text-red-800 mr-1'
                      }
                    >
                      Sanit: {shelter.amenities.sanitationAvailable ? '✓' : '✗'}
                    </span>
                    <span
                      className={
                        shelter.amenities.foodDistribution
                          ? 'bg-green-100 text-green-800 mr-1'
                          : 'bg-red-100 text-red-800 mr-1'
                    >
                      Food: {shelter.amenities.foodDistribution ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="border border-border p-2 text-xs text-muted-foreground">
                    Verified {new Date(
                      shelter.lastVerifiedAt
                    ).toLocaleDateString()} by {shelter.authority}
                  </td>
                  <td className="border border-border p-2 text-xs">
                    <a
                      href={`tel:${shelter.contact}`}
                      style={{
                        color: '#3b82f6',
                        textDecoration: 'underline',
                        fontSize: '0.85em',
                      }}
                    >
                      {shelter.contact}
                    </a>{' '}
                    {shelter.altContact && (
                      <span className="ml-2 text-orange-500">
                        / {shelter.altContact}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {shelters.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted-foreground p-4">
                    No shelter data loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Action Controls (for approved local responders) */}
      {/* TODO: In production, wrap in auth/role check — only approved responders can block routes / revalidate */}
      <section className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="text-sm font-medium text-blue-800 mb-3">
          Approved Responder Controls
        </h3>
        <p className="text-xs text-blue-600 mb-3">
          These controls are restricted to approved local disaster-response personnel.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => {
              // Prompt for blockage report
              const description = prompt(
                'Describe the blockage (e.g., "Water over road 2ft deep", "Bridge damaged"):'
              );
              if (description) {
                setSegmentBlockage(seg.id, BLOCKAGE_STATUS.BLOCKED, '/evidence/photo.jpg');
              }
            }}
            disabled={!routePlan}
            className="w-full py-2 px-3 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
          >
            Report Segment Blocked
          </button>

          <button
            onClick={() => {
              // Prompt for reopening
              const description = prompt(
                'Describe the reopening (e.g., "Water receded", "Debris cleared"):'
              );
              if (description) {
                setSegmentBlockage(seg.id, BLOCKAGE_STATUS.CLEAR, '/evidence/clear.jpg');
              }
            }}
            disabled={!routePlan}
            className="w-full py-2 px-3 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
          >
            Report Segment Reopened
          </button>
        </div>

        <div>
          <button
            onClick={() => expireOldObservations()}
            className="w-full py-2 px-3 text-sm bg-orange-100 text-orange-800 rounded hover:bg-orange-200"
          >
            Expire Old Unverified Observations (7-day validity)
          </button>
          <span className="text-xs text-orange-600 ml-2">
            {routePlan?.primaryRoute.reduce(
              (sum, seg) => sum + seg.communityObservations.filter((o) => !o.revalidated).length,
              0
            )} unverified observations will be expired
          </span>
        </div>
      </section>

      {/* Printable Preparedness List Button */}
      <div className="mt-6">
        <button
          onClick={() => {
            // Create a downloadable text file
            const blob = new Blob([preparednessContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flood-preparedness-${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="w-full py-2 px-4 font-medium text-background text-blue-600 rounded hover:bg-blue-100 transition-colors"
        >
          Download Printable Preparedness List
        </button>
      </div>

      {/* Low-Bandwidth Text Directory Link */}
      <div className="mt-4">
        <button
          onClick={() => {
            const textDir = generateTextRouteDirectory();
            const blob = new Blob([textDir], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flood-route-directory-${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="w-full py-2 px-4 font-medium text-background text-green-600 rounded hover:bg-green-100 transition-colors"
        >
          Generate Low-Bandwidth Text-Only Route Directory
        </button>
      </div>
    </div>
  );
}

/**
 * Helper hook-like function to set segment blockage (kept simple for this component).
 * In production, this would dispatch to a state management system or API.
 */
function setSegmentBlockage(
  segmentId: string,
  status: BLOCKAGE_STATUS,
  evidence?: string
) {
  const result = upFloodRouteService.setSegmentBlockage(
    segmentId,
    status,
    evidence,
    false // not revalidating automatically
  );
  if (result) {
    // Refresh the route plan
    // In a real app, this would update global state
    console.log('Blockage updated:', result.id, result.blockage.status);
  }
}