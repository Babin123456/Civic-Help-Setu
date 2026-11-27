/**
 * src/pages/AccessibilityBarrierSlaDashboard.jsx
 *
 * Accessible Accessibility Barrier Resolution SLA Dashboard (#1443).
 * Displays aggregate barrier categories, responsible authorities, report-to-resolution
 * duration, repeat incidents, ward/facility filters, verified/unverified states,
 * anonymized reporters, and small-group suppression.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import {
  BARRIER_CATEGORIES,
  aggregateBarrierSlaMetrics,
} from '../services/accessibilityBarrierSlaService.js';
import {
  addLocalBarrierSlaReport,
  loadLocalBarrierSlaState,
} from '../services/accessibilityBarrierSlaStorage.js';

export default function AccessibilityBarrierSlaDashboard() {
  const initial = (() => {
    try {
      const loaded = loadLocalBarrierSlaState();
      return {
        status: loaded.reports.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load barrier SLA dashboard.',
        data: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [slaState, setSlaState] = useState(initial.data);
  const [wardFilter, setWardFilter] = useState('all');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  // New report form
  const [newCategory, setNewCategory] = useState(BARRIER_CATEGORIES.RAMP_MISSING_OR_BLOCKED);
  const [newWard, setNewWard] = useState('ward-14');
  const [newFacility, setNewFacility] = useState('tehsil-office-gate');
  const [newSummary, setNewSummary] = useState('');

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

  const reports = slaState?.reports || [];
  const wards = Array.from(new Set(reports.map((r) => r.wardId)));
  const facilities = Array.from(new Set(reports.map((r) => r.facilityId)));

  const summary = aggregateBarrierSlaMetrics(reports, {
    wardId: wardFilter,
    facilityId: facilityFilter,
    verificationState: verificationFilter,
  });

  const handleAddReport = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    try {
      const { report, state } = addLocalBarrierSlaReport({
        category: newCategory,
        wardId: newWard,
        facilityId: newFacility,
        summary: newSummary,
        verificationState: 'unverified',
      });
      setSlaState(state);
      setViewStatus('ready');
      setNewSummary('');
      setNotice(`Recorded anonymized barrier report ${report.reportId} (${report.reporterRef}).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to record barrier report.');
    }
  };

  return (
    <main className="section" aria-labelledby="barrier-sla-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="barrier-sla-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Accessibility Barrier Resolution SLA Dashboard
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Aggregate visibility into barrier categories, responsible authorities, report-to-resolution duration, and repeat incidents with anonymized reporters and small-group suppression.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Citizen-Entered Barrier Report
              </span>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official SLA Rule
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
            <span><strong>Offline Mode:</strong> Displaying cached anonymized barrier SLA aggregates.</span>
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

        {/* Filters */}
        <section className="glass-panel" aria-label="Ward and Facility Filters" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div>
              <label htmlFor="sla-ward-filter" style={{ display: 'block', fontWeight: 600 }}>Ward Filter</label>
              <select id="sla-ward-filter" value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                <option value="all">All Wards</option>
                {wards.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sla-facility-filter" style={{ display: 'block', fontWeight: 600 }}>Facility Filter</label>
              <select id="sla-facility-filter" value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                <option value="all">All Facilities</option>
                {facilities.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sla-verification-filter" style={{ display: 'block', fontWeight: 600 }}>Verification State</label>
              <select id="sla-verification-filter" value={verificationFilter} onChange={(e) => setVerificationFilter(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                <option value="all">All States</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
          </div>
        </section>

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Barrier SLA Reports Recorded</h2>
            <p>Submit an anonymized accessibility barrier report below to track resolution SLAs.</p>
          </section>
        )}

        {viewStatus === 'ready' && (
          <>
            {/* Transparent Summary Metrics */}
            <section className="glass-panel" aria-labelledby="metrics-summary-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="metrics-summary-heading" style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ShieldCheck size={18} aria-hidden="true" />
                Transparent Aggregate SLA Metrics
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Total Reports</div>
                  <strong style={{ fontSize: '1.25rem' }}>{summary.totalReports}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Avg Resolution Duration</div>
                  <strong style={{ fontSize: '1.25rem' }}>{summary.avgResolutionHours} hrs</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>SLA Compliance</div>
                  <strong style={{ fontSize: '1.25rem' }}>{(summary.slaComplianceRate * 100).toFixed(1)}%</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Repeat Incident Locations</div>
                  <strong style={{ fontSize: '1.25rem' }}>{summary.repeatIncidentLocations}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Suppressed Small Groups</div>
                  <strong style={{ fontSize: '1.25rem' }}>{summary.suppressedGroupCount}</strong>
                </div>
              </div>
              <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
                {summary.aiTriageAdvisory.note}
              </p>
            </section>

            {/* Accessible Breakdown Table */}
            <section className="glass-panel" aria-labelledby="breakdown-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <h2 id="breakdown-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Barrier Category &amp; Authority SLA Breakdown
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Aggregate barrier resolution metrics by category and responsible authority; groups below n = {summary.minGroupSize} are suppressed to protect reporter anonymity.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Barrier Category</th>
                    <th scope="col">Responsible Authority</th>
                    <th scope="col">SLA Target</th>
                    <th scope="col">Reports (n)</th>
                    <th scope="col">Avg Duration</th>
                    <th scope="col">SLA Met %</th>
                    <th scope="col">Verified / Unverified</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categoryBreakdown.map((row) => (
                    <tr key={row.category}>
                      <th scope="row">{row.category}</th>
                      <td>{row.authority}</td>
                      <td>{row.slaTargetHours} hrs</td>
                      <td>{row.count}</td>
                      {row.suppressed ? (
                        <td colSpan={3}>
                          <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <EyeOff size={14} aria-hidden="true" />
                            Suppressed ({row.suppressionReason})
                          </span>
                        </td>
                      ) : (
                        <>
                          <td>{row.metrics.avgResolutionHours} hrs</td>
                          <td>{(row.metrics.slaComplianceRate * 100).toFixed(1)}%</td>
                          <td>{row.metrics.verifiedCount} / {row.metrics.unverifiedCount}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {/* Submit Anonymized Report */}
        <section className="glass-panel" aria-labelledby="submit-barrier-heading" style={{ padding: '1.25rem' }}>
          <h2 id="submit-barrier-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
            Log Anonymized Accessibility Barrier Report (Zero PII)
          </h2>
          <form onSubmit={handleAddReport} style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label htmlFor="sla-new-cat" style={{ display: 'block', fontWeight: 600 }}>Category</label>
                <select id="sla-new-cat" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                  {Object.values(BARRIER_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sla-new-ward" style={{ display: 'block', fontWeight: 600 }}>Ward ID</label>
                <input id="sla-new-ward" value={newWard} onChange={(e) => setNewWard(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="sla-new-fac" style={{ display: 'block', fontWeight: 600 }}>Facility ID</label>
                <input id="sla-new-fac" value={newFacility} onChange={(e) => setNewFacility(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
            </div>
            <div>
              <label htmlFor="sla-new-sum" style={{ display: 'block', fontWeight: 600 }}>Barrier Summary</label>
              <input
                id="sla-new-sum"
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="Describe the physical accessibility barrier (no personal details)..."
                required
                style={{ width: '100%', padding: '0.45rem' }}
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={16} aria-hidden="true" />
                Submit Anonymized Report
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
