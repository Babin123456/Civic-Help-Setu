/**
 * src/pages/ParkMaintenanceScheduleWorkspace.jsx
 *
 * Accessible Public Park Maintenance and Amenity Inspection Schedule (#1440).
 * Tracks amenities separately (play_area, public_toilet, drinking_water, walking_track, lighting),
 * publishes maintenance windows & temporary closure alerts, displays source/freshness,
 * and moderates resident observation photos for personal data.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Plus,
  ShieldAlert,
  Sparkles,
  Trees,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { AMENITY_TYPES } from '../services/parkMaintenanceScheduleService.js';
import {
  addLocalParkObservation,
  loadLocalParkScheduleState,
} from '../services/parkMaintenanceScheduleStorage.js';

export default function ParkMaintenanceScheduleWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalParkScheduleState();
      return {
        status: loaded.parks.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.parks[0]?.parkId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load park schedule.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [parkState, setParkState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [amenityType, setAmenityType] = useState('drinking_water');
  const [note, setNote] = useState('');
  const [photoRef, setPhotoRef] = useState('');
  const [exifStripped, setExifStripped] = useState(true);
  const [containsFacesOrPlates, setContainsFacesOrPlates] = useState(false);
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, []);

  const activePark =
    parkState?.parks?.find((p) => p.parkId === selectedId) || parkState?.parks?.[0] || null;

  const handleSubmitObservation = (e) => {
    e.preventDefault();
    if (!activePark) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { state } = addLocalParkObservation(activePark.parkId, {
        amenityType,
        note,
        photoRef,
        exifStripped,
        containsFacesOrPlates,
      });
      setParkState(state);
      setNote('');
      setPhotoRef('');
      setViewStatus('ready');
      setNotice(`Resident observation for ${amenityType} passed photo personal-data moderation.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to submit observation.');
    }
  };

  return (
    <main className="section" aria-labelledby="park-schedule-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="park-schedule-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Public Park Maintenance &amp; Amenity Inspection Schedule
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Track park amenities separately, inspect maintenance windows and temporary closure alerts, verify source freshness, and submit photo-moderated resident observations.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Municipal Schedule
              </span>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Resident Observation
              </span>
              <span className="badge" data-origin="ai_community_suggestion">
                <Sparkles size={14} aria-hidden="true" /> AI / Community Advisory
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WifiOff size={18} aria-hidden="true" />
            <span><strong>Offline Mode:</strong> Cached park maintenance schedules and amenity statuses are available offline.</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {notice && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Park Maintenance Schedules</h2>
            <p>No municipal park inspection schedules are currently loaded.</p>
          </section>
        )}

        {viewStatus === 'ready' && activePark && (
          <>
            {/* Temporary Closure Alerts */}
            {activePark.closureAlerts?.length > 0 && (
              <section className="glass-panel" aria-label="Temporary Closure Alerts" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                <h2 style={{ marginTop: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={18} aria-hidden="true" />
                  Temporary Closure Alerts ({activePark.closureAlerts.length})
                </h2>
                <ul style={{ marginBottom: 0 }}>
                  {activePark.closureAlerts.map((al) => (
                    <li key={al.alertId}>
                      {al.message} — Active until {al.activeUntil}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Separate Amenity Status Table */}
            <section className="glass-panel" aria-labelledby="amenities-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 id="amenities-heading" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Trees size={18} aria-hidden="true" />
                  {activePark.name} ({activePark.wardId}) — Owner: {activePark.municipalOwner}
                </h2>
                <select aria-label="Select Park" value={activePark.parkId} onChange={(e) => setSelectedId(e.target.value)} style={{ padding: '0.4rem' }}>
                  {parkState.parks.map((p) => (
                    <option key={p.parkId} value={p.parkId}>{p.name}</option>
                  ))}
                </select>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Per-amenity operational status with source provenance and freshness.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Amenity</th>
                    <th scope="col">Operational Status</th>
                    <th scope="col">Last Inspected</th>
                    <th scope="col">Source &amp; Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {activePark.amenities.map((am) => (
                    <tr key={am.amenityType}>
                      <th scope="row">{am.amenityType}</th>
                      <td>{am.operationalStatus}</td>
                      <td>{am.lastInspectedAt || 'Unverified'}</td>
                      <td>
                        {am.officialSource?.source} ({am.officialSource?.status} • {am.officialSource?.freshness})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {activePark.aiAdvisory && (
                <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
                  {activePark.aiAdvisory.note}
                </p>
              )}
            </section>

            {/* Maintenance Windows */}
            <section className="glass-panel" aria-labelledby="windows-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="windows-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                Published Maintenance Windows ({activePark.maintenanceWindows.length})
              </h2>
              <ul style={{ marginBottom: 0 }}>
                {activePark.maintenanceWindows.map((mw) => (
                  <li key={mw.windowId}>
                    <strong>[{mw.amenityType}]</strong> {mw.startAt} → {mw.endAt}: {mw.reason} ({mw.officialSource?.source})
                  </li>
                ))}
              </ul>
            </section>

            {/* Resident Observations & Photo Moderation */}
            <section className="glass-panel" aria-labelledby="res-obs-heading" style={{ padding: '1.25rem' }}>
              <h2 id="res-obs-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                Resident Observations ({activePark.residentObservations.length})
              </h2>
              <ul>
                {activePark.residentObservations.map((obs) => (
                  <li key={obs.observationId}>
                    <strong>[{obs.amenityType}]</strong> {obs.note} (Moderation: {obs.photoModerationStatus})
                  </li>
                ))}
              </ul>

              <form onSubmit={handleSubmitObservation} style={{ display: 'grid', gap: '0.7rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label htmlFor="pk-amenity" style={{ display: 'block', fontWeight: 600 }}>Amenity</label>
                    <select id="pk-amenity" value={amenityType} onChange={(e) => setAmenityType(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                      {AMENITY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pk-photo-ref" style={{ display: 'block', fontWeight: 600 }}>Photo Ref (Optional)</label>
                    <input id="pk-photo-ref" value={photoRef} onChange={(e) => setPhotoRef(e.target.value)} placeholder="e.g. photo-hash-xyz" style={{ width: '100%', padding: '0.45rem' }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="pk-note" style={{ display: 'block', fontWeight: 600 }}>Observation Note (Zero PII)</label>
                  <input id="pk-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe amenity condition..." required style={{ width: '100%', padding: '0.45rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input type="checkbox" checked={exifStripped} onChange={(e) => setExifStripped(e.target.checked)} />
                    <span>Photo EXIF Metadata Stripped</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input type="checkbox" checked={containsFacesOrPlates} onChange={(e) => setContainsFacesOrPlates(e.target.checked)} />
                    <span>Contains Faces or License Plates</span>
                  </label>
                </div>
                <div>
                  <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} aria-hidden="true" /> Submit Moderated Observation
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
