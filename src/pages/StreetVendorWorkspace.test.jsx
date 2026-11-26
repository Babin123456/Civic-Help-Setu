import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StreetVendorWorkspace from './StreetVendorWorkspace.jsx';

describe('StreetVendorWorkspace Page (#892)', () => {
  it('renders workspace with header, Supreme Court legal mandate, and tabs', () => {
    const html = renderToStaticMarkup(<StreetVendorWorkspace />);

    expect(html).toContain('Street Vendors Protection of Livelihood &amp; TVC Grievance Workspace');
    expect(html).toContain('Maharashtra Ekta Hawkers Union');
    expect(html).toContain('Sec 3(3) Eviction Immunity');
    expect(html).toContain('Sec 19 Seizure Reconciler');
    expect(html).toContain('Sec 18 Relocation Notice');
    expect(html).toContain('Sec 20 Appeal Drafter');
    expect(html).toContain('Confidential Vault');
  });
});
