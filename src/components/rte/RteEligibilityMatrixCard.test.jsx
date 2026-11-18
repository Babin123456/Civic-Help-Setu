import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RteEligibilityMatrixCard from './RteEligibilityMatrixCard.jsx';

describe('RteEligibilityMatrixCard Component (#889)', () => {
  it('renders RTE Section 12(1)(c) eligibility form with state thresholds and category selection', () => {
    const html = renderToStaticMarkup(<RteEligibilityMatrixCard />);

    expect(html).toContain('Section 12(1)(c) EWS / DG Quota Eligibility &amp; Catchment Matrix');
    expect(html).toContain('Annual Family Income (INR)');
    expect(html).toContain('Residence-to-School Distance (km)');
    expect(html).toContain('Statutory Verification Document Readiness');
    expect(html).toContain('STATUTORILY ELIGIBLE FOR 25% RTE QUOTA');
  });

  it('invokes onEligibilityChange callback with valid evaluation', () => {
    let captured = null;
    renderToStaticMarkup(
      <RteEligibilityMatrixCard onEligibilityChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.isEligible).toBe(true);
    expect(captured.statutoryScore).toBeGreaterThanOrEqual(0);
    expect(captured.catchment).toBeDefined();
  });
});
