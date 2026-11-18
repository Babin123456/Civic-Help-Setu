// Parse decimal rupees into integer paise without floating-point rounding.
export function parseAmount(value) {
  const text = String(value ?? '').trim();
  if (!/^-?\d{1,10}(?:\.\d{1,2})?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return negative ? -paise : paise;
}
export function formatAmount(paise) {
  const sign = paise < 0 ? '-' : '';
  const n = Math.abs(paise);
  return `${sign}₹${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`;
}
export function validateTimeline(stages) {
  const errors = [];
  if (stages.length < 2) errors.push('Add at least two checkout stages.');
  stages.forEach((stage, i) => {
    const prefix = `Stage ${i + 1}`;
    if (!stage.name.trim()) errors.push(`${prefix}: enter a stage name.`);
    if (parseAmount(stage.total) === null) errors.push(`${prefix}: enter a valid total with at most two decimals.`);
    if (!stage.lines.length) errors.push(`${prefix}: add at least one item or charge.`);
    const ids = new Set(); let sum = 0; let complete = true;
    stage.lines.forEach((line, j) => {
      const id = line.id.trim().toLowerCase();
      if (!id) errors.push(`${prefix}, line ${j + 1}: enter a line ID.`);
      if (ids.has(id)) errors.push(`${prefix}: duplicate line ID ${id}.`);
      ids.add(id);
      const amount = parseAmount(line.amount);
      if (amount === null) { complete = false; errors.push(`${prefix}, line ${j + 1}: enter a valid amount.`); }
      else sum += amount;
    });
    const total = parseAmount(stage.total);
    if (complete && total !== null && sum !== total) errors.push(`${prefix}: itemized total ${formatAmount(sum)} does not match stated total ${formatAmount(total)}.`);
  });
  return errors;
}
export function compareStages(stages) {
  return stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    const old = new Map(previous.lines.map(line => [line.id.trim().toLowerCase(), line]));
    const current = new Map(stage.lines.map(line => [line.id.trim().toLowerCase(), line]));
    const ids = [...new Set([...old.keys(), ...current.keys()])];
    const changes = ids.map(id => {
      const before = old.get(id); const after = current.get(id);
      const a = before ? parseAmount(before.amount) : 0; const b = after ? parseAmount(after.amount) : 0;
      const kind = !before ? 'Added' : !after ? 'Removed' : a !== b ? 'Changed' : 'Unchanged';
      return { id, kind, before: before ? a : null, after: after ? b : null, difference: b - a };
    });
    return { from: previous.name, to: stage.name, difference: parseAmount(stage.total) - parseAmount(previous.total), changes };
  });
}
// Descriptions and evidence references are free text. Strip common identifiers before export,
// but never claim the result is fully anonymised.
export function scrubText(value) {
  return String(value || '').replace(/https?:\/\/\S+/gi, '[link removed]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email removed]').replace(/\+?\d[\d -]{8,}\d/g, '[number removed]');
}
export function exportTimeline(stages) {
  const clean = stages.map(s => ({ name: scrubText(s.name), total: s.total, evidence: scrubText(s.evidence), lines: s.lines.map(l => ({ id: scrubText(l.id), amount: l.amount })) }));
  const comparisons = compareStages(stages).map(c => ({ ...c, from: scrubText(c.from), to: scrubText(c.to), changes: c.changes.map(change => ({ ...change, id: scrubText(change.id) })) }));
  return { note: 'User-reported information; not a legal finding. Scrubbing is best effort; review before sharing.', stages: clean, comparisons };
}
