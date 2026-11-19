import { useState } from 'react';
import { validateTimeline, compareStages, formatAmount, exportTimeline } from '../../services/checkoutTimelineService.js';
const newLine = () => ({ key: crypto.randomUUID(), id: '', amount: '' });
const newStage = () => ({ key: crypto.randomUUID(), name: '', total: '', evidence: '', lines: [newLine()] });
function download(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export default function CheckoutTimeline() {
  const [stages, setStages] = useState([]);
  const errors = validateTimeline(stages);
  const comparisons = errors.length ? [] : compareStages(stages);
  function updateStage(key, changes) { setStages(s => s.map(stage => stage.key === key ? { ...stage, ...changes } : stage)); }
  function updateLine(stage, key, changes) { updateStage(stage.key, { lines: stage.lines.map(line => line.key === key ? { ...line, ...changes } : line) }); }
  function move(index, offset) { setStages(current => { const next = [...current]; const dest = index + offset; [next[index], next[dest]] = [next[dest], next[index]]; return next; }); }
  function exportReport(json) {
    const report = exportTimeline(stages);
    const text = JSON.stringify(report, null, 2);
    download(json ? 'checkout-timeline.json' : 'checkout-timeline.txt', json ? text : `Checkout price disclosure timeline\n${text}`, json ? 'application/json' : 'text/plain');
  }
  return <section><h2>Checkout price disclosure timeline</h2>
    <p>Enter stages in checkout order. Use the same line ID for the same item or charge across stages; use negative amounts for discounts. Evidence references are user-supplied, not verified. Do not enter names, payment details, order numbers or addresses. Entries stay in this page until you leave.</p>
    <button type="button" onClick={() => setStages(s => [...s, newStage()])}>Add checkout stage</button>
    {stages.map((stage, i) => <fieldset key={stage.key}><legend>Stage {i + 1}</legend>
      <label>Stage name<input value={stage.name} onChange={e => updateStage(stage.key, { name: e.target.value })} /></label>
      <label>Stated total (₹)<input inputMode="decimal" value={stage.total} onChange={e => updateStage(stage.key, { total: e.target.value })} /></label>
      <label>Evidence reference (non-sensitive description)<input value={stage.evidence} onChange={e => updateStage(stage.key, { evidence: e.target.value })} /></label>
      {stage.lines.map((line, j) => <fieldset key={line.key}><legend>Line {j + 1}</legend><label>Line ID / charge name<input value={line.id} onChange={e => updateLine(stage, line.key, { id: e.target.value })} /></label><label>Amount (₹)<input inputMode="decimal" value={line.amount} onChange={e => updateLine(stage, line.key, { amount: e.target.value })} /></label><button type="button" onClick={() => updateStage(stage.key, { lines: stage.lines.filter(l => l.key !== line.key) })}>Remove line {j + 1}</button></fieldset>)}
      <button type="button" onClick={() => updateStage(stage.key, { lines: [...stage.lines, newLine()] })}>Add line</button>{' '}
      <button type="button" disabled={i === 0} onClick={() => move(i, -1)}>Move earlier</button>{' '}<button type="button" disabled={i === stages.length - 1} onClick={() => move(i, 1)}>Move later</button>{' '}<button type="button" onClick={() => setStages(s => s.filter(x => x.key !== stage.key))}>Remove stage {i + 1}</button>
    </fieldset>)}
    {errors.length > 0 && <div role="status"><h3>Complete and reconcile the stages</h3><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div>}
    {comparisons.map((comparison, i) => <div key={i}><h3>{comparison.from} → {comparison.to}</h3><p>Total difference: {formatAmount(comparison.difference)}. Evidence: {stages[i].evidence || 'not provided'} → {stages[i + 1].evidence || 'not provided'}.</p><div style={{ overflowX: 'auto' }}><table><caption>Line changes between stages {i + 1} and {i + 2}</caption><thead><tr><th scope="col">Line ID</th><th scope="col">Change</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Difference</th></tr></thead><tbody>{comparison.changes.map(change => <tr key={change.id}><th scope="row">{change.id}</th><td>{change.kind}</td><td>{change.before === null ? 'Absent' : formatAmount(change.before)}</td><td>{change.after === null ? 'Absent' : formatAmount(change.after)}</td><td>{formatAmount(change.difference)}</td></tr>)}</tbody></table></div></div>)}
    <p>Changes are factual comparisons, not a finding that any charge is unlawful. Export removes links and some contact details only; review files for remaining personal information before sharing.</p><button type="button" disabled={!!errors.length} onClick={() => exportReport(true)}>Export JSON</button>{' '}<button type="button" disabled={!!errors.length} onClick={() => exportReport(false)}>Export text</button>
  </section>;
}
