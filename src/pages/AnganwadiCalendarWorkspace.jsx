/**
 * src/pages/AnganwadiCalendarWorkspace.jsx
 *
 * Accessible Public Anganwadi Service Availability and Nutrition-Day Calendar (#1438).
 * Displays source-backed centre records, nutrition-day schedules, stale-status expiry,
 * official escalation contacts, accessible en/hi plain language, and separate
 * official vs community status channels with strict zero-child-health-data protection.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Languages,
  Plus,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { ACCESSIBLE_LABELS } from '../services/anganwadiCalendarService.js';
import {
  loadLocalAnganwadiState,
  submitLocalCommunityStatus,
} from '../services/anganwadiCalendarStorage.js';

export default function AnganwadiCalendarWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalAnganwadiState();
      return {
        status: loaded.centres.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.centres[0]?.centreId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load Anganwadi calendar.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [awcState, setAwcState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [lang, setLang] = useState('en');
  const [statusType, setStatusType] = useState('open_normal');
  const [note, setNote] = useState('');
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

  const labels = ACCESSIBLE_LABELS[lang] || ACCESSIBLE_LABELS.en;
  const centres = awcState?.centres || [];
  const activeCentre = centres.find((c) => c.centreId === selectedId) || centres[0] || null;

  const handleSubmitStatus = (e) => {
    e.preventDefault();
    if (!activeCentre) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { state } = submitLocalCommunityStatus(activeCentre.centreId, { statusType, note });
      setAwcState(state);
      setNote('');
      setViewStatus('ready');
      setNotice(`Community status update recorded for ${activeCentre.name} (zero child health data).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to submit status.');
    }
  };

  return (
    <main className="section" aria-labelledby="awc-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="awc-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                {labels.title}
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Source-backed Anganwadi timings, Nutrition-Day (VHSND) schedules, official escalation contacts, and stale-status expiry with zero child-level health data.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label htmlFor="awc-lang" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                <Languages size={15} aria-hidden="true" /> Language
              </label>
              <select id="awc-lang" value={lang} onChange={(e) => setLang(e.target.value)} style={{ padding: '0.35rem' }}>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Centre Record
              </span>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Community Status Channel
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
            <span><strong>Offline Mode:</strong> Cached Anganwadi schedules and escalation contacts are available offline.</span>
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
            <h2>No Anganwadi Centres Found</h2>
            <p>No verified Anganwadi centre schedules are currently loaded.</p>
          </section>
        )}

        {viewStatus === 'ready' && activeCentre && (
          <>
            {/* Centre Directory Table */}
            <section className="glass-panel" aria-labelledby="awc-dir-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <h2 id="awc-dir-heading" style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Calendar size={18} aria-hidden="true" />
                Verified Anganwadi Centre Directory ({centres.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Official centre timings, nutrition-day schedules, and stale-status freshness.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Centre</th>
                    <th scope="col">Opening Hours</th>
                    <th scope="col">{labels.nutritionDay}</th>
                    <th scope="col">Freshness &amp; Provenance</th>
                    <th scope="col">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {centres.map((c) => (
                    <tr key={c.centreId}>
                      <th scope="row">{c.name}</th>
                      <td>{c.openingHours}</td>
                      <td>{c.nutritionDaySchedule}</td>
                      <td>
                        {c.officialProvenance.isStale ? (
                          <span className="badge" style={{ color: '#b45309' }}>
                            stale_expired ({labels.staleWarning})
                          </span>
                        ) : (
                          <span>
                            {c.officialProvenance.freshnessStatus} ({c.officialProvenance.source})
                          </span>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn" onClick={() => setSelectedId(c.centreId)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Selected Centre Details + Escalation */}
            <section className="glass-panel" aria-labelledby="awc-detail-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="awc-detail-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                {activeCentre.name} — Services &amp; {labels.escalation}
              </h2>
              <p><strong>Core ICDS Services:</strong> {activeCentre.services.join(' • ')}</p>
              <h3 style={{ fontSize: '1rem' }}>{labels.escalation}</h3>
              <ul>
                {activeCentre.escalationContacts.map((esc) => (
                  <li key={esc.level}>
                    <strong>{esc.level}:</strong> {esc.designation} — {esc.role}
                  </li>
                ))}
              </ul>
              {activeCentre.aiAdvisory && (
                <p style={{ marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
                  {activeCentre.aiAdvisory.note}
                </p>
              )}
            </section>

            {/* Separate Community Status Channel */}
            <section className="glass-panel" aria-labelledby="awc-comm-heading" style={{ padding: '1.25rem' }}>
              <h2 id="awc-comm-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                Community Status Channel (Zero Child-Level Health Data)
              </h2>
              <ul>
                {activeCentre.communityStatusReports.map((rep) => (
                  <li key={rep.statusId}>
                    <strong>[{rep.statusType}]</strong> {rep.note} ({rep.reportedAt})
                  </li>
                ))}
              </ul>

              <form onSubmit={handleSubmitStatus} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                <select aria-label="Status Type" value={statusType} onChange={(e) => setStatusType(e.target.value)} style={{ padding: '0.45rem' }}>
                  <option value="open_normal">Open Normally</option>
                  <option value="closed_unannounced">Closed Unannounced</option>
                  <option value="ration_available">Ration Available</option>
                  <option value="ration_unavailable">Ration Unavailable</option>
                </select>
                <input
                  aria-label="Community Status Note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Share centre timing/ration update (no child names or health data)..."
                  required
                  style={{ flex: '1 1 260px', padding: '0.45rem' }}
                />
                <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Plus size={15} aria-hidden="true" /> Post Community Status
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
