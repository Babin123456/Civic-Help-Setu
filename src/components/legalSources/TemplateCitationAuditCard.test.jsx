import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TemplateCitationAuditCard from './TemplateCitationAuditCard.jsx';

describe('TemplateCitationAuditCard Component (#949)', () => {
  it('renders citation health score, template selector, and metrics strip', () => {
    const html = renderToStaticMarkup(<TemplateCitationAuditCard />);

    expect(html).toContain('Workspace Template Legal Source Health');
    expect(html).toContain('CITATION INTEGRITY AUDITOR');
    expect(html).toContain('Citation Health');
    expect(html).toContain('Total Citations');
    expect(html).toContain('Missing');
    expect(html).toContain('Stale Citations');
    expect(html).toContain('Superseded');
    expect(html).toContain('Jurisdiction Clashes');
    expect(html).toContain('Select Template');
    expect(html).toContain('User Circumstance / State');
  });

  it('renders citizen draft snapshot simulation trigger', () => {
    const html = renderToStaticMarkup(<TemplateCitationAuditCard />);

    expect(html).toContain('Immutable Historical Citizen Draft Binding');
    expect(html).toContain('Simulate Draft Snapshot');
  });
});
