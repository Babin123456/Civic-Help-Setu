import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SeizureReconcilerCard from './SeizureReconcilerCard.jsx';

describe('SeizureReconcilerCard Component (#892)', () => {
  it('renders goods seizure reconciler form and financial restitution summary', () => {
    const html = renderToStaticMarkup(<SeizureReconcilerCard />);

    expect(html).toContain('Section 19 Goods Confiscation &amp; Seizure Memo Reconciler');
    expect(html).toContain('Perishable Stock Value (INR)');
    expect(html).toContain('Days Detained in Municipal Yard');
    expect(html).toContain('Total Confiscated Asset Value');
    expect(html).toContain('Total Restitution Claimable');
  });

  it('triggers onSeizureAuditChange callback with restitution details', () => {
    let captured = null;
    renderToStaticMarkup(
      <SeizureReconcilerCard onSeizureAuditChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.totalSeizedAssetValueInr).toBeGreaterThan(0);
    expect(captured.violations).toBeDefined();
  });
});
