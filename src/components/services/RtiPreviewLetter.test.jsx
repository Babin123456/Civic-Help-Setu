import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RtiPreviewLetter from './RtiPreviewLetter';

describe('RtiPreviewLetter', () => {
  it('renders nothing when result has no applicationText', () => {
    const html = renderToStaticMarkup(<RtiPreviewLetter rtiResult={null} />);
    expect(html).toBe('');
  });

  it('renders application text, copy and print buttons', () => {
    const rtiResult = {
      applicationText: 'APPLICATION FOR INFORMATION UNDER SECTION 6(1)',
      audit: { issues: [] },
      isBpl: false,
    };
    const html = renderToStaticMarkup(<RtiPreviewLetter rtiResult={rtiResult} />);
    expect(html).toContain('Statutory RTI Form 6(1) Draft');
    expect(html).toContain('Copy Application');
  });

  it('renders BPL fee waiver and 48-hour life/liberty badges when applicable', () => {
    const rtiResult = {
      applicationText: 'APPLICATION FOR INFORMATION UNDER SECTION 6(1)',
      audit: { issues: [] },
      isBpl: true,
      isLifeOrLiberty: true,
      exemptionDetails: { isExempt: true },
    };
    const html = renderToStaticMarkup(<RtiPreviewLetter rtiResult={rtiResult} />);
    expect(html).toContain('BPL Fee Exempt (Sec 7(5))');
    expect(html).toContain('48-Hour Life/Liberty');
  });
});
