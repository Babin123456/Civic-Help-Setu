import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ElectricityConsumerWorkspace from './ElectricityConsumerWorkspace.jsx';

describe('ElectricityConsumerWorkspace Page (#891)', () => {
  it('renders workspace with header, legal notice, and all tabs', () => {
    const html = renderToStaticMarkup(<ElectricityConsumerWorkspace />);

    expect(html).toContain('Electricity Consumers Rights &amp; CGRF Compensation Workspace');
    expect(html).toContain('Electricity (Rights of Consumers) Rules 2020');
    expect(html).toContain('SoP Outage Compensation');
    expect(html).toContain('Disconnection Legality');
    expect(html).toContain('Defective Meter Diagnostics');
    expect(html).toContain('CGRF Petition Drafter');
    expect(html).toContain('Confidential Vault');
  });
});
