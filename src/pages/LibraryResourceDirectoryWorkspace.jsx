/**
 * src/pages/LibraryResourceDirectoryWorkspace.jsx
 *
 * Accessible Public Library and Community Learning Resource Availability Directory (#1439).
 * Provides searchable directory with official provenance, last-verified time, accessible
 * filters (wheelchair, Braille, screen readers, digital lab), opening-hour exceptions,
 * membership requirements, and moderated community updates.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck2,
  Plus,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { searchLearningFacilities } from '../services/libraryResourceDirectoryService.js';
import {
  loadLocalLibraryDirectoryState,
  submitLocalLibraryUpdate,
} from '../services/libraryResourceDirectoryStorage.js';

export default function LibraryResourceDirectoryWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalLibraryDirectoryState();
      return {
        status: loaded.facilities.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.facilities[0]?.facilityId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load library directory.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [dirState, setDirState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [query, setQuery] = useState('');
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [brailleOnly, setBrailleOnly] = useState(false);
  const [screenReaderOnly, setScreenReaderOnly] = useState(false);
  const [digitalLabOnly, setDigitalLabOnly] = useState(false);
  const [updateField, setUpdateField] = useState('hours_or_amenity');
  const [updateNote, setUpdateNote] = useState('');
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

  const filtered = searchLearningFacilities(dirState?.facilities || [], {
    query,
    wheelchairOnly,
    brailleOnly,
    screenReaderOnly,
    digitalLabOnly,
  });

  const activeFacility =
    filtered.find((f) => f.facilityId === selectedId) || filtered[0] || null;

  const handleSubmitUpdate = (e) => {
    e.preventDefault();
    if (!activeFacility) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { state } = submitLocalLibraryUpdate(activeFacility.facilityId, {
        field: updateField,
        note: updateNote,
      });
      setDirState(state);
      setUpdateNote('');
      setViewStatus('ready');
      setNotice(`Community correction submitted to moderation queue for ${activeFacility.name}.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to submit correction.');
    }
  };

  return (
    <main className="section" aria-labelledby="library-dir-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="library-dir-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Public Library &amp; Community Learning Resource Directory
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Discover public libraries, reading rooms, digital learning labs, accessibility features, membership rules, and opening-hour exceptions with official provenance and moderated community updates.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Library Record
              </span>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Moderated Community Update
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
            <span><strong>Offline Mode:</strong> Cached library hours, amenities, and provenance are available offline.</span>
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

        {/* Search & Accessible Filters */}
        <section className="glass-panel" aria-label="Search and Accessibility Filters" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label htmlFor="lib-search" style={{ display: 'block', fontWeight: 600 }}>Search Libraries &amp; Learning Centers</label>
              <input
                id="lib-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, ward, or membership..."
                style={{ width: '100%', padding: '0.45rem' }}
              />
            </div>
            <fieldset style={{ border: '1px solid rgba(148,163,184,0.3)', borderRadius: '0.5rem', padding: '0.7rem' }}>
              <legend style={{ fontWeight: 600 }}>Accessible &amp; Digital Filters</legend>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input type="checkbox" checked={wheelchairOnly} onChange={(e) => setWheelchairOnly(e.target.checked)} />
                  <span>Wheelchair Accessible</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input type="checkbox" checked={brailleOnly} onChange={(e) => setBrailleOnly(e.target.checked)} />
                  <span>Braille Collection</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input type="checkbox" checked={screenReaderOnly} onChange={(e) => setScreenReaderOnly(e.target.checked)} />
                  <span>Screen Reader Workstation</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input type="checkbox" checked={digitalLabOnly} onChange={(e) => setDigitalLabOnly(e.target.checked)} />
                  <span>Digital Learning Lab</span>
                </label>
              </div>
            </fieldset>
          </div>
        </section>

        {viewStatus === 'empty' || filtered.length === 0 ? (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Matching Libraries Found</h2>
            <p>Adjust your search or accessibility filters to view available learning facilities.</p>
          </section>
        ) : (
          <>
            <section className="glass-panel" aria-labelledby="facilities-table-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <h2 id="facilities-table-heading" style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <BookOpen size={18} aria-hidden="true" />
                Verified Learning Facilities ({filtered.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Public libraries and learning rooms with hours, amenities, provenance, and last-verified timestamp.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Facility</th>
                    <th scope="col">Ward</th>
                    <th scope="col">Regular Hours</th>
                    <th scope="col">Provenance &amp; Last Verified</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={f.facilityId}>
                      <th scope="row">{f.name}</th>
                      <td>{f.wardId}</td>
                      <td>{f.regularHours}</td>
                      <td>
                        {f.officialProvenance?.source} ({f.officialProvenance?.status} • {f.officialProvenance?.lastVerifiedAt || 'Unverified'})
                      </td>
                      <td>
                        <button type="button" className="btn" onClick={() => setSelectedId(f.facilityId)}>
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {activeFacility && (
              <section className="glass-panel" aria-labelledby="detail-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h2 id="detail-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                  {activeFacility.name} — Amenities, Membership &amp; Hour Exceptions
                </h2>
                <p><strong>Membership:</strong> {activeFacility.membership?.summary}</p>
                <p>
                  <strong>Amenities:</strong>{' '}
                  {Object.entries(activeFacility.amenities)
                    .filter(([, v]) => Boolean(v))
                    .map(([k]) => k)
                    .join(', ')}
                </p>

                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={15} aria-hidden="true" /> Opening-Hour Exceptions ({activeFacility.openingHourExceptions.length})
                </h3>
                {activeFacility.openingHourExceptions.length === 0 ? (
                  <p>No active opening-hour exceptions.</p>
                ) : (
                  <ul>
                    {activeFacility.openingHourExceptions.map((ex) => (
                      <li key={ex.exceptionId}>
                        <strong>{ex.dateRange}:</strong> {ex.adjustedHours} — {ex.reason}
                      </li>
                    ))}
                  </ul>
                )}

                <h3 style={{ fontSize: '1rem' }}>Moderated Community Updates ({activeFacility.communityUpdates.length})</h3>
                <ul>
                  {activeFacility.communityUpdates.map((u) => (
                    <li key={u.updateId}>
                      <strong>[{u.moderationStatus}]</strong> {u.field}: {u.note}
                    </li>
                  ))}
                </ul>

                <form onSubmit={handleSubmitUpdate} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                  <select aria-label="Update Field" value={updateField} onChange={(e) => setUpdateField(e.target.value)} style={{ padding: '0.45rem' }}>
                    <option value="hours_or_amenity">Hours or Amenity</option>
                    <option value="membership">Membership Rule</option>
                    <option value="accessibility">Accessibility Feature</option>
                  </select>
                  <input
                    aria-label="Community Correction Note"
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                    placeholder="Suggest a factual correction (no PII)..."
                    required
                    style={{ flex: '1 1 240px', padding: '0.45rem' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Plus size={15} aria-hidden="true" /> Submit for Moderation
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
