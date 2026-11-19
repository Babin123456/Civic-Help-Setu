import { useState } from 'react';
import CheckoutTimeline from '../components/darkPatterns/CheckoutTimeline.jsx';
import EvidenceManifest from '../components/darkPatterns/EvidenceManifest.jsx';
import { PATTERNS, classifyPatterns, auditPricing, draftNotice } from '../services/darkPatternsService.js';
import { listRecords, saveRecord, deleteRecord, verifyRecord, exportJson, exportText } from '../services/darkPatternsStorage.js';
import './DarkPatternsWorkspace.css';

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
export default function DarkPatternsWorkspace() {
  const [trader, setTrader] = useState('');
  const [facts, setFacts] = useState('');
  const [selected, setSelected] = useState([]);
  const [headline, setHeadline] = useState('');
  const [final, setFinal] = useState('');
  const [disclosed, setDisclosed] = useState('0');
  const [kind, setKind] = useState('notice');
  const [records, setRecords] = useState(() => { try { return listRecords(); } catch { return []; } });
  const [status, setStatus] = useState('');
  const matches = classifyPatterns(facts);
  let audit = null; try { audit = auditPricing(headline, final, disclosed); } catch { /* Await valid amounts. */ }
  const allPatterns = [...new Set([...selected, ...matches])];
  const draft = draftNotice({ trader, facts, amount: audit?.unexplained, patterns: allPatterns }, kind);
  async function save() {
    try {
      if (!audit) throw new Error('Enter valid pricing amounts before saving.');
      await saveRecord({ trader, facts, patterns: allPatterns, headline, final, disclosed });
      setRecords(listRecords()); setStatus('Saved locally with SHA-256 seal. Review the saved record for remaining personal information.');
    } catch (e) { setStatus(`Could not save: ${e.message}`); }
  }
  async function verify(record) { try { setStatus((await verifyRecord(record)) ? 'Seal matches this record.' : 'Seal mismatch: record has changed.'); } catch (e) { setStatus(e.message); } }
  function remove(id) { try { deleteRecord(id); setRecords(listRecords()); setStatus('Record deleted.'); } catch (e) { setStatus(e.message); } }
  return <main className="dark-workspace">
    <h1>Dark Patterns &amp; Consumer Redressal Workspace</h1>
    <p>Identify potential deceptive practices, audit checkout charges and prepare drafts. This is guidance, not legal advice or a finding of illegality. Review before use.</p>
    <section><h2>1. Classify the experience</h2><label>Trader or platform <input value={trader} onChange={e => setTrader(e.target.value)} /></label>
      <label>Describe what happened <textarea value={facts} onChange={e => setFacts(e.target.value)} rows="4" /></label>
      <p>Suggested matches: {matches.join(', ') || 'None yet. Keyword matching can miss patterns; select any that apply.'}</p>
      <fieldset><legend>Other potential categories</legend><div className="pattern-grid">{PATTERNS.map(([name]) => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={e => setSelected(e.target.checked ? [...selected, name] : selected.filter(x => x !== name))} /> {name}</label>)}</div></fieldset>
    </section>
    <section><h2>2. Drip pricing audit</h2><p>Enter totals for the same order. Include delivery, convenience, handling, packaging and payment fees in the final debit. Enter charges already disclosed with the headline price separately.</p>
      <div className="price-grid"><label>Headline price (₹)<input type="number" min="0" step="0.01" value={headline} onChange={e => setHeadline(e.target.value)} /></label><label>Final debit (₹)<input type="number" min="0" step="0.01" value={final} onChange={e => setFinal(e.target.value)} /></label><label>Additional charges disclosed upfront (₹)<input type="number" min="0" step="0.01" value={disclosed} onChange={e => setDisclosed(e.target.value)} /></label></div>
      {audit && <p>Difference: ₹{audit.difference.toFixed(2)}; unexplained increase: ₹{audit.unexplained.toFixed(2)} ({audit.percentage === null ? 'percentage unavailable for zero headline price' : `${audit.percentage}%`}). {audit.assessment} Not all surcharges are unlawful; compare disclosures and evidence under the 2023 Guidelines.</p>}
    </section>
    <CheckoutTimeline />
    <EvidenceManifest />
    <section><h2>3. Draft redressal</h2><label>Document <select value={kind} onChange={e => setKind(e.target.value)}><option value="notice">15-day legal notice</option><option value="ccpa">CCPA petition</option><option value="dcdrc">District Commission complaint</option></select></label><pre>{draft}</pre><button onClick={() => download('redressal-draft.txt', draft, 'text/plain')}>Download draft</button><p>Add your details and verify jurisdiction, evidence and statutory references before sending. No submission is made by this tool.</p></section>
    <section><h2>4. Local evidence vault</h2><p>Text only; do not enter card details, addresses, order numbers or contact details. Automatic scrubbing is best effort and can miss personal information. Review saved data and exports. Local storage is not encrypted and is accessible to others using this browser. A hash detects changes, not authenticity.</p><button onClick={save}>Scrub, seal and save</button> <span role="status">{status}</span>
      {records.map(record => <article key={record.id}><h3>{record.trader || 'Unnamed trader'} — {record.createdAt}</h3><pre>{exportText(record)}</pre><button onClick={() => verify(record)}>Verify seal</button> <button onClick={() => download('dossier.json', exportJson(record), 'application/json')}>Export JSON</button> <button onClick={() => download('dossier.txt', exportText(record), 'text/plain')}>Export text</button> <button onClick={() => remove(record.id)}>Delete</button></article>)}
    </section>
  </main>;
}
