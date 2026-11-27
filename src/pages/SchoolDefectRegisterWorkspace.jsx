/**
 * src/pages/SchoolDefectRegisterWorkspace.jsx
 *
 * Accessible Public School Infrastructure Defect and Follow-Up Register (#1437).
 * Displays school/ward aggregates, facility categories, department routing,
 * evidence moderation status, status history, and strict child-privacy controls
 * (no student names, faces, minor photos, or PII).
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileCheck2,
  Plus,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { UP_SCHOOL_FACILITY_CATEGORIES } from '../services/upSchoolFacilityGapService.js';
import { aggregateSchoolAndWardDefects } from '../services/schoolDefectRegisterService.js';
import {
  addLocalSchoolDefectReport,
  loadLocalSchoolDefectState,
} from '../services/schoolDefectRegisterStorage.js';

export default function SchoolDefectRegisterWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalSchoolDefectState();
      return {
        status: loaded.reports.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.reports[0]?.defectId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load school defect register.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [defectState, setDefectState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [wardFilter, setWardFilter] = useState('all');

  // Form state
  const [schoolId, setSchoolId] = useState('UDISE-09150101');
  const [schoolName, setSchoolName] = useState('Government Primary School, Chinhat Ward 14');
  const [wardId, setWardId] = useState('ward-14');
  const [category, setCategory] = useState('DRINKING_WATER');
  const [summary, setSummary] = useState('');
  const [evidencePhotoRef, setEvidencePhotoRef] = useState('');
  const [exifStripped, setExifStripped] = useState(true);
  const [containsStudentFacesOrMinors, setContainsStudentFacesOrMinors] = useState(false);
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

  const allReports = defectState?.reports || [];
  const wards = Array.from(new Set(allReports.map((r) => r.wardId)));
  const summaryData = aggregateSchoolAndWardDefects(allReports, { wardId: wardFilter });
  const activeReport =
    summaryData.reports.find((r) => r.defectId === selectedId) || summaryData.reports[0] || null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    try {
      const { report, state } = addLocalSchoolDefectReport({
        schoolId,
        schoolName,
        wardId,
        category,
        summary,
        evidencePhotoRef,
        exifStripped,
        containsStudentFacesOrMinors,
      });
      setDefectState(state);
      setSelectedId(report.defectId);
      setSummary('');
      setEvidencePhotoRef('');
      setViewStatus('ready');
      setNotice(`Non-identifying defect ${report.defectId} routed to ${report.routedDepartment} (pending moderation).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to submit defect report.');
    }
  };

  return (
    <main className="section" aria-labelledby="school-defect-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="school-defect-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Public School Infrastructure Defect &amp; Follow-Up Register
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Non-identifying school facility defect tracking (drinking water, toilets, ramps, classrooms, electricity) with department routing, evidence moderation, status history, and strict child privacy (no student names or faces).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Parent / Community Report
              </span>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official School / Dept Record
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
            <span><strong>Offline Mode:</strong> Cached school/ward defect aggregates and status histories are available offline.</span>
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

        {/* School / Ward Aggregates */}
        <section className="glass-panel" aria-labelledby="agg-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <h2 id="agg-heading" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Building2 size={18} aria-hidden="true" />
              School &amp; Ward Public Progress Summary
            </h2>
            <select aria-label="Filter by Ward" value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} style={{ padding: '0.4rem' }}>
              <option value="all">All Wards</option>
              {wards.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', marginTop: '0.85rem' }}>
            <div><div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Total Defects</div><strong>{summaryData.totalReports}</strong></div>
            <div><div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Open</div><strong>{summaryData.openCount}</strong></div>
            <div><div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Verified Resolved</div><strong>{summaryData.resolvedCount}</strong></div>
            <div><div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Pending Moderation</div><strong>{summaryData.pendingModerationCount}</strong></div>
          </div>
          <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
            {summaryData.aiAdvisory.note}
          </p>
        </section>

        {viewStatus === 'empty' ? (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
            <h2>No School Infrastructure Defects Recorded</h2>
            <p>Submit a non-identifying facility defect report below.</p>
          </section>
        ) : (
          <>
            {/* Defect Register Table */}
            <section className="glass-panel" aria-labelledby="register-table-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <h2 id="register-table-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                School Defect Register &amp; Department Routing ({summaryData.reports.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Non-identifying school infrastructure defect reports with department routing, moderation status, and provenance.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">School (UDISE)</th>
                    <th scope="col">Category</th>
                    <th scope="col">Routed Department</th>
                    <th scope="col">Moderation / Status</th>
                    <th scope="col">Provenance</th>
                    <th scope="col">History</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.reports.map((r) => (
                    <tr key={r.defectId}>
                      <th scope="row">{r.schoolName} ({r.schoolId})</th>
                      <td>{r.category}</td>
                      <td>{r.routedDepartment}</td>
                      <td>{r.moderationStatus} / {r.defectStatus}</td>
                      <td>{r.officialProvenance?.source} ({r.officialProvenance?.status})</td>
                      <td>
                        <button type="button" className="btn" onClick={() => setSelectedId(r.defectId)}>
                          View ({r.statusHistory.length})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Status History */}
            {activeReport && (
              <section className="glass-panel" aria-labelledby="history-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h2 id="history-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                  Status History — {activeReport.schoolName} ({activeReport.defectId})
                </h2>
                <ul style={{ marginBottom: 0 }}>
                  {activeReport.statusHistory.map((h, i) => (
                    <li key={i}>
                      <strong>[{h.status}]</strong> ({h.origin}) — {h.note} ({h.timestamp})
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Submit Non-Identifying Defect */}
        <section className="glass-panel" aria-labelledby="submit-defect-heading" style={{ padding: '1.25rem' }}>
          <h2 id="submit-defect-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
            Report Non-Identifying School Facility Defect (No Student Names or Faces)
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label htmlFor="sch-id" style={{ display: 'block', fontWeight: 600 }}>School UDISE ID</label>
                <input id="sch-id" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="sch-name" style={{ display: 'block', fontWeight: 600 }}>School Name</label>
                <input id="sch-name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="sch-ward" style={{ display: 'block', fontWeight: 600 }}>Ward ID</label>
                <input id="sch-ward" value={wardId} onChange={(e) => setWardId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="sch-cat" style={{ display: 'block', fontWeight: 600 }}>Facility Category</label>
                <select id="sch-cat" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                  {Object.keys(UP_SCHOOL_FACILITY_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="sch-sum" style={{ display: 'block', fontWeight: 600 }}>Defect Summary (Zero Student Names/PII)</label>
              <input id="sch-sum" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe facility repair needed..." required style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div>
              <label htmlFor="sch-photo" style={{ display: 'block', fontWeight: 600 }}>Facility Photo Ref (Optional, No Faces)</label>
              <input id="sch-photo" value={evidencePhotoRef} onChange={(e) => setEvidencePhotoRef(e.target.value)} placeholder="e.g. photo-facility-01" style={{ width: '100%', padding: '0.45rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <input type="checkbox" checked={exifStripped} onChange={(e) => setExifStripped(e.target.checked)} />
                <span>Photo EXIF Metadata Stripped</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <input type="checkbox" checked={containsStudentFacesOrMinors} onChange={(e) => setContainsStudentFacesOrMinors(e.target.checked)} />
                <span>Contains Student Faces or Minors</span>
              </label>
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Plus size={16} aria-hidden="true" /> Submit Defect Report
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
