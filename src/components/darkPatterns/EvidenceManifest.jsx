import { useState } from 'react';
import { createManifest, parseManifest, verifyManifest, duplicateGroups, MAX_MANIFEST_BYTES } from '../../services/evidenceManifestService.js';

function downloadManifest(manifest) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'evidence-manifest.json'; link.click(); URL.revokeObjectURL(url);
}
export default function EvidenceManifest() {
  const [files, setFiles] = useState([]);
  const [descriptions, setDescriptions] = useState({});
  const [manifest, setManifest] = useState(null);
  const [verifyFiles, setVerifyFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const progress = (done, total) => setMessage(`Processed ${done} of ${total} files.`);
  async function create() {
    setBusy(true); setMessage('Creating manifest…');
    try { const next = await createManifest(files, descriptions, progress); setManifest(next); setVerifyFiles([]); setResults(null); setMessage('Manifest created. Review it before exporting.'); }
    catch (error) { setManifest(null); setResults(null); setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function load(event) {
    const file = event.target.files[0]; if (!file) return;
    setBusy(true); setResults(null);
    try {
      if (file.size > MAX_MANIFEST_BYTES) throw new Error('Manifest exceeds the 1 MiB limit.');
      const next = parseManifest(await file.text()); setManifest(next); setVerifyFiles([]); setMessage('Manifest loaded; select files to verify.');
    } catch (error) { setManifest(null); setMessage(error.message); }
    finally { event.target.value = ''; setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMessage('Verifying files…');
    try { setResults(await verifyManifest(manifest, verifyFiles, progress)); setMessage('Verification complete.'); }
    catch (error) { setResults(null); setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section><h2>Evidence dossier integrity</h2>
    <p>Files are read locally and are not uploaded or stored. A matching hash detects changes, but does not prove authenticity or when evidence was captured. The manifest contains filenames, file timestamps and descriptions: avoid personal details and review it before sharing.</p>
    <p>Select up to 20 files, each no larger than 20 MiB. Supported extensions: PDF, PNG, JPG, JPEG and TXT. File extensions are not proof of file type. Keep your original files separately.</p>
    <fieldset disabled={busy}><legend>Create manifest</legend><label>Evidence files<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={e => { setFiles(Array.from(e.target.files)); setDescriptions({}); }} /></label>
      {files.map((file, index) => <label key={`${file.name}-${index}`}>Description for {file.name}<input maxLength="500" value={descriptions[file.name] || ''} onChange={e => setDescriptions({ ...descriptions, [file.name]: e.target.value })} /></label>)}
      <button type="button" onClick={create}>Create manifest</button></fieldset>
    <fieldset disabled={busy}><legend>Load and verify manifest</legend><label>Load JSON manifest<input type="file" accept=".json,application/json" onChange={load} /></label>
      {manifest && <><p>Manifest created: {manifest.createdAt}. Contains {manifest.entries.length} files.</p><ul>{manifest.entries.map(entry => <li key={entry.name}>{entry.name} — {entry.size} bytes — {entry.description || 'No description'} — SHA-256: {entry.sha256}</li>)}</ul>
        {duplicateGroups(manifest.entries).map((names, i) => <p key={i}>Duplicate content: {names.join(', ')}</p>)}
        <button type="button" onClick={() => downloadManifest(manifest)}>Export manifest</button>
        <label>Files to verify against manifest<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={e => { setVerifyFiles(Array.from(e.target.files)); setResults(null); }} /></label><button type="button" onClick={verify}>Verify selected files</button></>}
    </fieldset>
    <p role="status" aria-live="polite">{message}</p>
    {results && <div><h3>Verification results</h3><ul>{results.results.map(item => <li key={item.name}>{item.name}: {item.status}</li>)}</ul>{results.extra.length > 0 && <p>Not in manifest: {results.extra.join(', ')}</p>}</div>}
  </section>;
}
