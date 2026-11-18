import { describe, it, expect } from 'vitest';
import { parseAmount, validateTimeline, compareStages, exportTimeline } from './checkoutTimelineService.js';
const sample = () => [
  { name: 'Offer', total: '100.10', evidence: 'Offer screenshot', lines: [{ id: 'Product', amount: '100.10' }] },
  { name: 'Checkout', total: '105.20', evidence: 'Checkout screenshot', lines: [{ id: 'Product', amount: '100.10' }, { id: 'Delivery', amount: '10.10' }, { id: 'Discount', amount: '-5.00' }] },
];
describe('checkout timeline', () => {
  it('parses precise signed amounts and rejects malformed values', () => {
    expect(parseAmount('0.01')).toBe(1); expect(parseAmount('-5.20')).toBe(-520);
    expect(parseAmount('1.001')).toBeNull(); expect(parseAmount('')).toBeNull();
  });
  it('validates missing stages, duplicates and reconciliation', () => {
    expect(validateTimeline([])).toContain('Add at least two checkout stages.');
    const stages = sample(); expect(validateTimeline(stages)).toEqual([]);
    stages[1].lines.push({ id: 'delivery', amount: '0' }); stages[1].total = '200';
    expect(validateTimeline(stages).join(' ')).toContain('duplicate');
    expect(validateTimeline(stages).join(' ')).toContain('does not match');
    stages[1].lines[0].amount = ''; expect(validateTimeline(stages).join(' ')).toContain('valid amount');
  });
  it('shows additions, changes, removals and corrected totals', () => {
    const stages = sample(); let result = compareStages(stages)[0];
    expect(result.difference).toBe(510); expect(result.changes.find(x => x.id === 'delivery').kind).toBe('Added');
    stages[1].lines = [{ id: 'Product', amount: '90.00' }]; stages[1].total = '90.00';
    result = compareStages(stages)[0]; expect(result.changes[0].kind).toBe('Changed');
    expect(compareStages([...stages, { name: 'Final', total: '0', lines: [] }])[1].changes[0].kind).toBe('Removed');
  });
  it('scrubs links and contact details without changing the underlying comparison', () => {
    const stages = sample(); stages[0].evidence = 'https://example.com/order?x=123 contact person@example.com';
    const report = exportTimeline(stages); const text = JSON.stringify(report);
    expect(text).not.toContain('example.com'); expect(report.comparisons[0].difference).toBe(510);
  });
});
