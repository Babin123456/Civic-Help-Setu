/**
 * src/pages/TreePlantationSurvivalWorkspace.jsx
 *
 * Accessible Tree-Plantation Survival and Public Green Asset Registry (#1441).
 * Displays aggregate public map-grid & list views, distinguishes planted (unverified)
 * from verified surviving trees, prevents duplicates, shows evidence history, and
 * keeps Official Registry Records, Citizen Observations, and AI Advisories distinct.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Plus,
  Sparkles,
  Trees,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { aggregateGreenAssetSummary } from '../services/treePlantationSurvivalService.js';
import {
  addLocalGreenAssetEvidence,
  loadLocalGreenAssetState,
  registerLocalGreenAsset,
} from '../services/treePlantationSurvivalStorage.js';

export default function TreePlantationSurvivalWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalGreenAssetState();
      return {
        status: loaded.assets.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.assets[0]?.assetId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load green asset registry.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [assetState, setAssetState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [wardFilter, setWardFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  // Register form
  const [batchId, setBatchId] = useState('MONSOON-2026-W14');
  const [species, setSpecies] = useState('Mangifera indica (Mango)');
  const [steward, setSteward] = useState('Municipal Horticulture Wing');
  const [wardId, setWardId] = useState('ward-14');
  const [lat, setLat] = useState('26.851');
  const [lng, setLng] = useState('80.950');

  // Evidence form
  const [evNote, setEvNote] = useState('');

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

  const allAssets = assetState?.assets || [];
  const wards = Array.from(new Set(allAssets.map((a) => a.wardId)));
  const batches = Array.from(new Set(allAssets.map((a) => a.batchId)));

  const summary = aggregateGreenAssetSummary(allAssets, {
    wardId: wardFilter,
    batchId: batchFilter,
  });

  const activeAsset =
    summary.assets.find((a) => a.assetId === selectedId) || summary.assets[0] || null;

  const handleRegister = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    try {
      const { asset, state } = registerLocalGreenAsset({
        batchId,
        species,
        steward,
        wardId,
        lat: Number(lat),
        lng: Number(lng),
      });
      setAssetState(state);
      setSelectedId(asset.assetId);
      setViewStatus('ready');
      setNotice(`Registered geotagged green asset ${asset.assetId} (${asset.survivalStatus}).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to register asset.');
    }
  };

  const handleAddEvidence = (e) => {
    e.preventDefault();
    if (!activeAsset) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { state } = addLocalGreenAssetEvidence(activeAsset.assetId, { note: evNote });
      setAssetState(state);
      setEvNote('');
      setNotice(`Appended survival evidence to ${activeAsset.assetId}.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to append evidence.');
    }
  };

  return (
    <main className="section" aria-labelledby="green-registry-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="green-registry-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Tree-Plantation Survival &amp; Public Green Asset Registry
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Geotagged green-asset registry tracking planting batches, species, stewards, inspection dates, and verified survival separately from unverified sapling counts.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Registry Record
              </span>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Citizen Survival Observation
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
            <span><strong>Offline Mode:</strong> Viewing cached green-asset registry and survival evidence.</span>
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

        {/* Filters & View Switch */}
        <section className="glass-panel" aria-label="Registry Filters" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="tree-ward-filter" style={{ display: 'block', fontWeight: 600 }}>Ward</label>
              <select id="tree-ward-filter" value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} style={{ padding: '0.45rem' }}>
                <option value="all">All Wards</option>
                {wards.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tree-batch-filter" style={{ display: 'block', fontWeight: 600 }}>Planting Batch</label>
              <select id="tree-batch-filter" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} style={{ padding: '0.45rem' }}>
                <option value="all">All Batches</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
                Accessible List View
              </button>
              <button type="button" className="btn" aria-pressed={viewMode === 'map'} onClick={() => setViewMode('map')}>
                Aggregate Geo-Map View
              </button>
            </div>
          </div>
        </section>

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Green Assets Registered</h2>
            <p>Register a geotagged planting batch below to track survival.</p>
          </section>
        )}

        {viewStatus === 'ready' && (
          <>
            {/* Planted vs Verified Surviving Summary */}
            <section className="glass-panel" aria-labelledby="survival-summary-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="survival-summary-heading" style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Trees size={18} aria-hidden="true" />
                Planted vs. Verified Surviving Summary
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Total Planted</div>
                  <strong style={{ fontSize: '1.25rem' }}>{summary.totalPlantedCount}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Verified Surviving</div>
                  <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>{summary.verifiedSurvivingCount}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Planted (Unverified)</div>
                  <strong style={{ fontSize: '1.25rem', color: '#f59e0b' }}>{summary.unverifiedPlantedCount}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Verified Survival Rate</div>
                  <strong style={{ fontSize: '1.25rem' }}>{(summary.survivalRate * 100).toFixed(1)}%</strong>
                </div>
              </div>
              <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
                {summary.aiAdvisory.note}
              </p>
            </section>

            {/* Map or List */}
            {viewMode === 'map' ? (
              <section className="glass-panel" aria-labelledby="map-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h2 id="map-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>Aggregate Geo-Cluster Grid (Rounded ~110m)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {summary.assets.map((a) => (
                    <div key={a.assetId} className="glass-panel" style={{ padding: '0.85rem' }}>
                      <div style={{ fontWeight: 700 }}>{a.species}</div>
                      <div style={{ fontSize: '0.85rem' }}><MapPin size={13} aria-hidden="true" /> {a.lat}, {a.lng} ({a.wardId})</div>
                      <div style={{ fontSize: '0.85rem' }}>Status: <strong>{a.survivalStatus}</strong></div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="glass-panel" aria-labelledby="list-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
                <h2 id="list-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>Green Asset Registry ({summary.assets.length})</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                    Geotagged green assets with planting batch, steward, inspection date, survival status, and provenance.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Asset / Species</th>
                      <th scope="col">Batch</th>
                      <th scope="col">Steward</th>
                      <th scope="col">Geo Zone</th>
                      <th scope="col">Last Inspection</th>
                      <th scope="col">Survival Status</th>
                      <th scope="col">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.assets.map((a) => (
                      <tr key={a.assetId}>
                        <th scope="row">{a.species}</th>
                        <td>{a.batchId}</td>
                        <td>{a.steward}</td>
                        <td>{a.lat}, {a.lng}</td>
                        <td>{a.lastInspectionDate || 'Pending'}</td>
                        <td>{a.survivalStatus} ({a.officialSource?.verified ? 'Verified' : 'Unverified'})</td>
                        <td>
                          <button type="button" className="btn" onClick={() => setSelectedId(a.assetId)}>
                            View ({a.evidenceHistory.length})
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Evidence History & Add Observation */}
            {activeAsset && (
              <section className="glass-panel" aria-labelledby="evidence-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h2 id="evidence-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                  Evidence History — {activeAsset.species} ({activeAsset.assetId})
                </h2>
                <ul>
                  {activeAsset.evidenceHistory.map((ev) => (
                    <li key={ev.evidenceId}>
                      <strong>[{ev.origin}]</strong> {ev.date}: {ev.note}
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleAddEvidence} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  <input
                    aria-label="Survival Observation Note"
                    value={evNote}
                    onChange={(e) => setEvNote(e.target.value)}
                    placeholder="Add dated survival observation (no PII)..."
                    required
                    style={{ flex: '1 1 260px', padding: '0.45rem' }}
                  />
                  <button type="submit" className="btn btn-primary">Add Evidence</button>
                </form>
              </section>
            )}
          </>
        )}

        {/* Register Asset Form */}
        <section className="glass-panel" aria-labelledby="register-heading" style={{ padding: '1.25rem' }}>
          <h2 id="register-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
            Register Geotagged Green Asset (Duplicate-Protected)
          </h2>
          <form onSubmit={handleRegister} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label htmlFor="reg-batch" style={{ display: 'block', fontWeight: 600 }}>Batch ID</label>
              <input id="reg-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <label htmlFor="reg-species" style={{ display: 'block', fontWeight: 600 }}>Species</label>
              <input id="reg-species" value={species} onChange={(e) => setSpecies(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <label htmlFor="reg-steward" style={{ display: 'block', fontWeight: 600 }}>Steward</label>
              <input id="reg-steward" value={steward} onChange={(e) => setSteward(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <label htmlFor="reg-ward" style={{ display: 'block', fontWeight: 600 }}>Ward</label>
              <input id="reg-ward" value={wardId} onChange={(e) => setWardId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <label htmlFor="reg-lat" style={{ display: 'block', fontWeight: 600 }}>Lat</label>
              <input id="reg-lat" value={lat} onChange={(e) => setLat(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <label htmlFor="reg-lng" style={{ display: 'block', fontWeight: 600 }}>Lng</label>
              <input id="reg-lng" value={lng} onChange={(e) => setLng(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Plus size={15} aria-hidden="true" /> Register Asset
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
