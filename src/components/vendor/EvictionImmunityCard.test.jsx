import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvictionImmunityCard from './EvictionImmunityCard.jsx';

describe('EvictionImmunityCard Component (#892)', () => {
  it('renders Section 3(3) eviction immunity auditor', () => {
    const html = renderToStaticMarkup(<EvictionImmunityCard />);

    expect(html).toContain('Section 3(3) Absolute Statutory Eviction Immunity Auditor');
    expect(html).toContain('Vending Category');
    expect(html).toContain('Zoning Classification');
    expect(html).toContain('ABSOLUTE NON-EVICTION PROTECTION UNDER SECTION 3(3)');
    expect(html).toContain('Section 3(3) Street Vendors Act 2014');
  });

  it('triggers onImmunityChange with immunity assessment', () => {
    let captured = null;
    renderToStaticMarkup(
      <EvictionImmunityCard onImmunityChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.hasAbsoluteStatutoryImmunity).toBe(true);
    expect(captured.immunityStrength).toBeDefined();
  });
});
