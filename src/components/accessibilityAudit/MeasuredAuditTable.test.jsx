import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MeasuredAuditTable from './MeasuredAuditTable.jsx';

describe('MeasuredAuditTable', () => {
  it('renders measured table with benchmarks, facilities, and inputs', () => {
    const measurements = {
      ramp_slope: 10,
      door_clear_width: 950,
    };

    const html = renderToStaticMarkup(
      <MeasuredAuditTable measurements={measurements} />
    );

    expect(html).toContain('Physical Facility Measurements (Harmonised Guidelines 2021)');
    expect(html).toContain('Ramp Slope Gradient');
    expect(html).toContain('Doorway Clear Opening Width');
    expect(html).toContain('Compliant');
    expect(html).toContain('Gap: 2 ratio');
  });
});
