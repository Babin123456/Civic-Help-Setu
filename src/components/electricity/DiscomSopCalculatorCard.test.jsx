import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DiscomSopCalculatorCard from './DiscomSopCalculatorCard.jsx';

describe('DiscomSopCalculatorCard Component (#891)', () => {
  it('renders standard of performance outage compensation calculator form', () => {
    const html = renderToStaticMarkup(<DiscomSopCalculatorCard />);

    expect(html).toContain('Guaranteed Standard of Performance (SoP) Outage Compensation Calculator');
    expect(html).toContain('Unscheduled Outage Duration (Hours)');
    expect(html).toContain('Burnt Transformer Replacement Delay (Days)');
    expect(html).toContain('Total Compensation Credit');
  });

  it('triggers onSopChange callback on initial calculation', () => {
    let captured = null;
    renderToStaticMarkup(
      <DiscomSopCalculatorCard onSopChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.totalCompensationInr).toBeGreaterThan(0);
    expect(captured.breakdown).toBeDefined();
  });
});
