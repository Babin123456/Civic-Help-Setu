import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import MgnregaEvidenceWorkspace from './MgnregaEvidenceWorkspace.jsx';

describe('MgnregaEvidenceWorkspace', () => {
  it('renders accessible low-literacy flow, official references, and no-entitlement disclaimer', () => {
    const html = renderToStaticMarkup(<MgnregaEvidenceWorkspace workerId="worker-ssr" />);
    expect(html).toContain('MGNREGA Work-Demand');
    expect(html).toContain('Step 1: Record Your Work Demand Receipt');
    expect(html).toContain('Published MGNREGA Process References (Official Record)');
    expect(html).toContain('does NOT calculate or guarantee rupee wage entitlements');
  });
});
