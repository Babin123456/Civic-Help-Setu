import { useState } from 'react';
import { CHECKS, evaluateAudit, estimatePenalty, draftAccessibilityPetition } from '../services/accessibilityAuditService.js';
import { listAudits, saveAudit, deleteAudit, verifyAudit } from '../services/accessibilityAuditStorage.js';
import './DarkPatternsWorkspace.css';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export default function AccessibilityAuditWorkspace() {
  const [answers, setAnswers] = useState({});
  const [offence, setOffence] = useState('unknown');
  const [authority, setAuthority] = useState('state');
  const [facility, setFacility] = useState('');
  const [district, setDistrict] = useState('');
  const [facts, setFacts] = useState('');
  const [records, setRecords] = useState(() => { try { return listAudits(); } catch { return []; } });
  const [status, setStatus] = useState('');
  const audit = evaluateAudit(answers);
  const petition = draftAccessibilityPetition({ authority, facility, district, facts, audit });
  async function save() { try { await saveAudit(answers); setRecords(listAudits()); setStatus('Structured audit saved locally.'); } catch (e) { setStatus(`Could not save: ${e.message}`); } }
  async function verify(record) { try { setStatus(await verifyAudit(record) ? 'Seal matches.' : 'Seal mismatch.'); } catch (e) { setStatus(e.message); } }
  function remove(id) { try { deleteAudit(id); setRecords(listAudits()); setStatus('Deleted.'); } catch (e) { setStatus(e.message); } }
  return <main className="dark-workspace">
    <h1>Universal Accessibility Audit Workspace</h1>
    <p>Screen buildings and transit facilities against selected 2021 Harmonised Guidelines benchmarks and prepare a representation under the Rights of Persons with Disabilities Act, 2016. This is a screening tool, not a legal or professional accessibility audit.</p>
    <section><h2>Accessibility checklist</h2><p>Inspect and measure the facility. Select unknown when not assessed, or not applicable where the feature is absent and not required. Seek specialist guidance on applicability.</p>
      {CHECKS.map(c => <label key={c.key}>{c.label}<select value={answers[c.key] || 'unknown'} onChange={e => setAnswers({ ...answers, [c.key]: e.target.value })}><option value="unknown">Unknown / not assessed</option><option value="yes">Meets benchmark</option><option value="no">Does not meet benchmark</option><option value="na">Not applicable</option></select></label>)}
      <p>Screening score: {audit.score === null ? 'Not available' : `${audit.score}%`} ({audit.assessed} of {CHECKS.length} checks assessed). Unknown and not-applicable checks are excluded; a high score does not establish compliance.</p>
      <p>Priority safety barriers: {audit.hazards.join('; ') || 'None reported among assessed critical checks.'}</p><p>Reported failures: {audit.failures.join('; ') || 'None reported.'} This screening does not determine compliance with Rajive Raturi or court orders.</p>
    </section>
    <section><h2>Section 89 penalty guidance</h2><label>Contravention history<select value={offence} onChange={e => setOffence(e.target.value)}><option value="unknown">Unknown</option><option value="first">First</option><option value="subsequent">Subsequent</option></select></label><p>{estimatePenalty(offence)} Section 90 concerns offences by companies. Liability and enforcement depend on facts and competent authorities.</p></section>
    <section><h2>Commissioner petition</h2><label>Authority<select value={authority} onChange={e => setAuthority(e.target.value)}><option value="state">State Commissioner</option><option value="chief">Chief Commissioner</option></select></label><label>Facility name<input value={facility} onChange={e => setFacility(e.target.value)} /></label><label>District and state<input value={district} onChange={e => setDistrict(e.target.value)} /></label><label>Facts and dates<textarea rows="4" value={facts} onChange={e => setFacts(e.target.value)} /></label><pre>{petition}</pre><button onClick={() => download('accessibility-petition.txt', petition, 'text/plain')}>Download petition</button><p>Review and add contact information before filing; this tool does not submit petitions. Petition text is not stored in the vault.</p></section>
    <section><h2>Local audit vault</h2><p>Only checklist selections are stored; names, contact details, locations, and free-text descriptions are excluded. Storage is unencrypted; the hash detects changes but does not establish authenticity. Do not put sensitive information in downloaded petitions.</p><button onClick={save}>Save structured audit</button> <span role="status">{status}</span>
      {records.map(r => <article key={r.id}><h3>Audit {r.createdAt}</h3><pre>{JSON.stringify(r, null, 2)}</pre><button onClick={() => verify(r)}>Verify seal</button> <button onClick={() => download('accessibility-audit.json', JSON.stringify(r, null, 2), 'application/json')}>Export JSON</button> <button onClick={() => download('accessibility-audit.txt', `Accessibility audit\n${JSON.stringify(r, null, 2)}`, 'text/plain')}>Export text</button> <button onClick={() => remove(r.id)}>Delete</button></article>)}
    </section>
  </main>;
}
