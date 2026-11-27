import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FirewallInspectionPanel from './FirewallInspectionPanel';

describe('FirewallInspectionPanel (#1151)', () => {
  it('renders nothing when firewall prop is null', () => {
    expect(renderToStaticMarkup(<FirewallInspectionPanel firewall={null} />)).toBe('');
  });

  it('renders accessible alert landmark and threat classes when quarantined', () => {
    const html = renderToStaticMarkup(
      <FirewallInspectionPanel
        firewall={{
          contractVersion: '1.0.0',
          decision: 'block',
          sourceType: 'uploaded_pdf',
          counts: { clean: 0, suspicious: 0, quarantined: 1, total: 1 },
          threatClasses: ['indirect_instruction_override'],
          proposalCheck: { requiresHumanApproval: true },
        }}
      />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Untrusted Document Quarantined');
    expect(html).toContain('indirect_instruction_override');
    expect(html).toContain('Human review required');
  });

  it('renders accessible status landmark when clean', () => {
    const html = renderToStaticMarkup(
      <FirewallInspectionPanel
        firewall={{
          contractVersion: '1.0.0',
          decision: 'allow',
          sourceType: 'external_web',
          counts: { clean: 2, suspicious: 0, quarantined: 0, total: 2 },
          threatClasses: [],
        }}
      />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Untrusted Evidence Isolated');
    expect(html).toContain('Clean passages: 2');
  });
});
