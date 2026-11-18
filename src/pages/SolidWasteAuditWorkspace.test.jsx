import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SolidWasteAuditWorkspace from './SolidWasteAuditWorkspace.jsx';

describe('SolidWasteAuditWorkspace Page (#878)', () => {
  it('renders workspace banner and tab navigation', () => {
    const html = renderToStaticMarkup(<SolidWasteAuditWorkspace />);

    expect(html).toContain('Municipal Solid Waste Dumping &amp; NGT Compensation Workspace');
    expect(html).toContain('Bulk Waste Generator Audit');
    expect(html).toContain('Tonnage &amp; NGT Fine Estimator');
    expect(html).toContain('C&amp;D Waste Tracker');
    expect(html).toContain('Statutory Notice Drafter');
    expect(html).toContain('Evidentiary Checklist');
    expect(html).toContain('Saved Audits Vault');
  });

  it('renders statutory authority footer citation', () => {
    const html = renderToStaticMarkup(<SolidWasteAuditWorkspace />);

    expect(html).toContain('Solid Waste Management Rules, 2016');
    expect(html).toContain('Construction &amp; Demolition Waste Management Rules, 2016');
    expect(html).toContain('National Green Tribunal');
  });
});
