import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ComparisonStatePanel from './ComparisonStatePanel';

describe('ComparisonStatePanel (#824)', () => {
  it('announces loading politely with a text alternative', () => {
    const html = renderToStaticMarkup(<ComparisonStatePanel status="loading" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Loading office records');
    expect(html).toContain('No personal data is requested.');
    expect(html).toContain('comparison-state__spinner');
  });

  it('announces errors assertively and offers a retry action', () => {
    const html = renderToStaticMarkup(<ComparisonStatePanel status="error" onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('Try again');
    expect(html).toContain('open the Nearby Offices directory');
  });

  it('offers a reset action for an empty result set', () => {
    const html = renderToStaticMarkup(<ComparisonStatePanel status="empty" onReset={() => {}} />);
    expect(html).toContain('No offices match these filters');
    expect(html).toContain('Reset filters');
    expect(html).toContain('role="status"');
  });

  it('explains that GPS is optional when permission is denied', () => {
    const html = renderToStaticMarkup(
      <ComparisonStatePanel status="permission-denied" onRequestLocation={() => {}} requestLocationDisabled />
    );
    expect(html).toContain('Location access is blocked');
    expect(html).toContain('GPS is optional');
    expect(html).toContain('Try location again');
    expect(html).toContain('disabled=""');
  });

  it('renders an explicit title override and ignores unknown states', () => {
    const html = renderToStaticMarkup(
      <ComparisonStatePanel status="empty" title="No offices in this district" message="Try another district." />
    );
    expect(html).toContain('No offices in this district');
    expect(html).toContain('Try another district.');

    expect(renderToStaticMarkup(<ComparisonStatePanel status="not-a-state" />)).toBe('');
  });
});
