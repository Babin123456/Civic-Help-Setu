/**
 * src/pages/AiHallucinationReportWorkspace.jsx
 *
 * Accessible Civic AI Hallucination and Unsupported-Claim Reporting Workspace (#1448).
 * Keeps AI-generated claims, citizen-entered reports, and official verified corrections
 * visibly distinct; supports loading, empty, error, and offline states; and exports
 * redacted regression fixtures.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Flag,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Undo2,
} from 'lucide-react';
import {
  REPORT_REASON_CODES,
  REPORT_STATUS,
} from '../services/aiHallucinationReportService.js';
import {
  loadLocalHallucinationState,
  resolveLocalHallucinationReport,
  submitLocalHallucinationReport,
  withdrawLocalHallucinationReport,
} from '../services/aiHallucinationReportStorage.js';

const REASON_LABELS = {
  [REPORT_REASON_CODES.NO_SOURCE_CITED]: 'Cites no official source',
  [REPORT_REASON_CODES.MISSTATED_REQUIREMENT]: 'Misstates requirement, fee, or deadline',
  [REPORT_REASON_CODES.OUTDATED_RULE]: 'Uses outdated / superseded rule',
  [REPORT_REASON_CODES.FABRICATED_PORTAL_OR_URL]: 'Fabricated portal, form, or URL',
  [REPORT_REASON_CODES.JURISDICTION_MISMATCH]: 'Wrong state or district jurisdiction',
};

export default function AiHallucinationReportWorkspace() {
  const initialSnapshot = (() => {
    try {
      const loaded = loadLocalHallucinationState();
      return {
        status: loaded.reports.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load AI claim reports.',
        data: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initialSnapshot.status);
  const [errorMsg, setErrorMsg] = useState(initialSnapshot.errorMsg);
  const [storeState, setStoreState] = useState(initialSnapshot.data);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  // Form state
  const [responseId, setResponseId] = useState('resp-2026-11-live');
  const [claimId, setClaimId] = useState('claim-01');
  const [serviceId, setServiceId] = useState('passport');
  const [modelVersion, setModelVersion] = useState('civic-rag-v2.4');
  const [rulesetVersion, setRulesetVersion] = useState('rules-2026.11');
  const [reasonCode, setReasonCode] = useState(REPORT_REASON_CODES.NO_SOURCE_CITED);
  const [claimText, setClaimText] = useState('');
  const [citizenNote, setCitizenNote] = useState('');
  const [jurisdiction, setJurisdiction] = useState('IN-UP');
  const [notice, setNotice] = useState('');

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

  const handleSubmitReport = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    try {
      const { report, state } = submitLocalHallucinationReport(
        {
          responseId,
          claimId,
          serviceId,
          modelVersion,
          rulesetVersion,
          reasonCode,
          claimText,
          citizenCorrectionNote: citizenNote,
          sourceSnapshot: {
            source: 'Unverified / No source cited',
            jurisdiction,
            effectiveDate: '',
            lastVerifiedAt: '',
          },
        },
        'local-citizen'
      );
      setStoreState(state);
      setViewStatus('ready');
      setClaimText('');
      setCitizenNote('');
      setNotice(`Report ${report.reportId} submitted (${report.riskLevel.toUpperCase()} risk -> ${report.routedTo}).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Could not submit report.');
    }
  };

  const handleWithdraw = (reportId) => {
    setErrorMsg('');
    try {
      const { state } = withdrawLocalHallucinationReport(reportId, {
        actorId: 'local-citizen',
        role: 'citizen',
        reason: 'Withdrawn from workspace',
      });
      setStoreState(state);
      setNotice(`Report ${reportId} withdrawn.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to withdraw report.');
    }
  };

  const handleVerifyCorrection = (report) => {
    setErrorMsg('');
    try {
      const { state, fixture } = resolveLocalHallucinationReport(report.reportId, {
        actorId: 'local-admin',
        outcome: REPORT_STATUS.CORRECTION_ISSUED,
        correctionNote:
          report.citizenFeedback?.note || 'Verified against official department circular; AI claim superseded.',
        officialSource: {
          source: `Official ${report.telemetry?.serviceId || 'Civic'} Portal`,
          jurisdiction: report.sourceSnapshot?.jurisdiction || 'IN-UP',
          effectiveDate: '2026-11-01',
          lastVerifiedAt: new Date().toISOString(),
        },
        exportFixture: true,
      });
      setStoreState(state);
      setNotice(
        `Official correction issued for ${report.reportId}${fixture ? ` and exported regression fixture ${fixture.id}` : ''}.`
      );
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to resolve report.');
    }
  };

  return (
    <main className="section" aria-labelledby="hallucination-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="hallucination-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Civic AI Hallucination &amp; Unsupported-Claim Reporting
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Flag AI guidance that cites no source, misstates requirements, or uses outdated rules. Reports capture minimal telemetry without citizen PII and route high-risk claims for official verification.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="ai_generated_claim">
                <Sparkles size={14} aria-hidden="true" /> AI Claim (Under Audit)
              </span>
              <span className="badge" data-origin="citizen_entered_report">
                <Flag size={14} aria-hidden="true" /> Citizen-Entered Report
              </span>
              <span className="badge" data-origin="official_verified_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Verified Correction
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div
            role="status"
            aria-live="polite"
            className="glass-panel"
            style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <WifiOff size={18} aria-hidden="true" />
            <span>
              <strong>Offline Mode:</strong> Claim reports are saved locally with zero PII and queued for review sync.
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="glass-panel"
            style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="glass-panel"
            style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {/* Claim Report Form */}
        <section className="glass-panel" aria-labelledby="report-form-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 id="report-form-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
            Flag an Unsupported or Inaccurate AI Claim
          </h2>
          <form onSubmit={handleSubmitReport} style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label htmlFor="hal-response-id" style={{ display: 'block', fontWeight: 600 }}>Response ID</label>
                <input id="hal-response-id" value={responseId} onChange={(e) => setResponseId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="hal-claim-id" style={{ display: 'block', fontWeight: 600 }}>Claim ID</label>
                <input id="hal-claim-id" value={claimId} onChange={(e) => setClaimId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="hal-service-id" style={{ display: 'block', fontWeight: 600 }}>Service</label>
                <input id="hal-service-id" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="hal-jurisdiction" style={{ display: 'block', fontWeight: 600 }}>Jurisdiction</label>
                <input id="hal-jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="hal-model-version" style={{ display: 'block', fontWeight: 600 }}>Model Version</label>
                <input id="hal-model-version" value={modelVersion} onChange={(e) => setModelVersion(e.target.value)} style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label htmlFor="hal-ruleset-version" style={{ display: 'block', fontWeight: 600 }}>Ruleset Version</label>
                <input id="hal-ruleset-version" value={rulesetVersion} onChange={(e) => setRulesetVersion(e.target.value)} style={{ width: '100%', padding: '0.45rem' }} />
              </div>
            </div>

            <div>
              <label htmlFor="hal-reason-code" style={{ display: 'block', fontWeight: 600 }}>Issue Type</label>
              <select
                id="hal-reason-code"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                style={{ width: '100%', padding: '0.45rem' }}
              >
                {Object.entries(REASON_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hal-claim-text" style={{ display: 'block', fontWeight: 600 }}>
                AI Claim Text (Do not include Aadhaar, PAN, OTP, password, or phone numbers)
              </label>
              <textarea
                id="hal-claim-text"
                rows={2}
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
                placeholder="Paste the specific AI claim that appears unsupported or incorrect..."
                required
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>

            <div>
              <label htmlFor="hal-citizen-note" style={{ display: 'block', fontWeight: 600 }}>
                Citizen Correction / Context (Optional)
              </label>
              <textarea
                id="hal-citizen-note"
                rows={2}
                value={citizenNote}
                onChange={(e) => setCitizenNote(e.target.value)}
                placeholder="What is the missing citation, outdated fee, or incorrect requirement?"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>

            <div>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Flag size={16} aria-hidden="true" />
                Submit Claim Report
              </button>
            </div>
          </form>
        </section>

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No AI Claim Reports Recorded</h2>
            <p>Submit a claim report above to route unsupported AI guidance for official verification.</p>
          </section>
        )}

        {viewStatus === 'ready' && storeState && (
          <>
            {/* Reports Queue */}
            <section className="glass-panel" aria-labelledby="queue-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <h2 id="queue-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Claim Reports &amp; Resolution Queue ({storeState.reports.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Claim-level reports linked to response ID, model/ruleset version, source snapshot provenance, and resolution status.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Report / Version</th>
                    <th scope="col">AI Claim &amp; Citizen Note</th>
                    <th scope="col">Source Snapshot</th>
                    <th scope="col">Risk / Routing</th>
                    <th scope="col">Resolution Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {storeState.reports.map((rep) => (
                    <tr key={rep.reportId}>
                      <th scope="row">
                        <div>{rep.reportId}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                          {rep.telemetry.modelVersion} / {rep.telemetry.rulesetVersion}
                        </div>
                      </th>
                      <td>
                        <div><strong>AI Claim:</strong> {rep.claim.text}</div>
                        {rep.citizenFeedback?.note && (
                          <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            <strong>Citizen Note:</strong> {rep.citizenFeedback.note}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{rep.sourceSnapshot.source}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                          {rep.sourceSnapshot.jurisdiction} • {rep.sourceSnapshot.verified ? `Verified (${rep.sourceSnapshot.effectiveDate})` : 'Unverified'}
                        </div>
                      </td>
                      <td>
                        <span className="badge">
                          <ShieldAlert size={13} aria-hidden="true" /> {rep.riskLevel.toUpperCase()} ({rep.routedTo})
                        </span>
                      </td>
                      <td>
                        <div><strong>{rep.status}</strong></div>
                        {rep.resolution?.correctionNote && (
                          <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                            <strong>Official Correction:</strong> {rep.resolution.correctionNote}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {(rep.status === REPORT_STATUS.OPEN || rep.status === REPORT_STATUS.UNDER_REVIEW) && (
                            <>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleVerifyCorrection(rep)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <ShieldCheck size={14} aria-hidden="true" /> Issue Correction
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleWithdraw(rep.reportId)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Undo2 size={14} aria-hidden="true" /> Withdraw
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Regression Fixtures */}
            <section className="glass-panel" aria-labelledby="fixtures-heading" style={{ padding: '1.25rem' }}>
              <h2 id="fixtures-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                Exported Regression Fixtures ({storeState.regressionFixtures.length})
              </h2>
              {storeState.regressionFixtures.length === 0 ? (
                <p style={{ marginBottom: 0 }}>No regression fixtures exported yet. Issuing a correction automatically generates a redacted eval fixture.</p>
              ) : (
                <ul style={{ marginBottom: 0 }}>
                  {storeState.regressionFixtures.map((fx) => (
                    <li key={fx.id} style={{ marginBottom: '0.4rem' }}>
                      <code>{fx.id}</code> ({fx.jurisdiction} • {fx.modelVersion}) — Prohibited claim: &ldquo;{fx.prohibitedClaim}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
