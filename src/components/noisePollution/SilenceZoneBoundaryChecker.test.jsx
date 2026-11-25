import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SilenceZoneBoundaryChecker from './SilenceZoneBoundaryChecker.jsx';

describe('SilenceZoneBoundaryChecker', () => {
  it('renders silence zone checker and 100m perimeter status', () => {
    const html = renderToStaticMarkup(<SilenceZoneBoundaryChecker />);
    expect(html).toContain('Statutory Silence Zone (100m Perimeter) Compliance Checker');
    expect(html).toContain('100-METER SILENCE ZONE PERIMETER');
    expect(html).toContain('Protected Sensitive Facility Name');
    expect(html).toContain('WITHIN 100M SILENCE ZONE');
  });
});
