import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GovernedToolRegistryPanel from './GovernedToolRegistryPanel.jsx';
import { createGovernedToolRegistry } from '../../services/toolRegistry/governedToolRegistry.js';
import { SYNTHETIC_SIGNING_SECRET } from '../../services/toolRegistry/__fixtures__/syntheticToolFixtures.js';

describe('GovernedToolRegistryPanel (#1146)', () => {
  it('renders accessible headings, metrics, tool table, revocation form, and audit section', () => {
    const registry = createGovernedToolRegistry({ secret: SYNTHETIC_SIGNING_SECRET });
    const html = renderToStaticMarkup(<GovernedToolRegistryPanel registry={registry} />);

    expect(html).toContain('Governed Agent Tool Registry');
    expect(html).toContain('aria-label="Tool Registry Security Metrics"');
    expect(html).toContain('Registered Tool Contracts');
    expect(html).toContain('lookupServiceDetails');
    expect(html).toContain('saveApplicationDraft');
    expect(html).toContain('Emergency Capability / User Revocation');
    expect(html).toContain('Sanitized Tool Invocation Audit Log');
  });
});
