import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LegalSourceReviewWorkspace from './LegalSourceReviewWorkspace.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'admin', fullName: 'Verified Legal Admin' },
  }),
}));

describe('LegalSourceReviewWorkspace Page (#949)', () => {
  it('renders workspace title, statutory advisory banner, and role badge', () => {
    const html = renderToStaticMarkup(<LegalSourceReviewWorkspace />);

    expect(html).toContain('Versioned Legal Source Review for Workspace Templates');
    expect(html).toContain('STATUTORY CITATION REGISTRY');
    expect(html).toContain('Authorized Legal Reviewer (Admin)');
    expect(html).toContain('Statutory Compliance &amp; Outcome Neutrality:');
    expect(html).toContain('Export JSON Dossier');
    expect(html).toContain('Reset Defaults');
  });

  it('renders summary statistics strip', () => {
    const html = renderToStaticMarkup(<LegalSourceReviewWorkspace />);

    expect(html).toContain('Total Sources');
    expect(html).toContain('Reviewed &amp; Active');
    expect(html).toContain('Unreviewed Drafts');
    expect(html).toContain('Superseded');
    expect(html).toContain('Stale Reviews');
    expect(html).toContain('Covered Templates');
  });

  it('renders navigation tabs and active registry table', () => {
    const html = renderToStaticMarkup(<LegalSourceReviewWorkspace />);

    expect(html).toContain('Legal Source Registry');
    expect(html).toContain('Template Citation Audits');
    expect(html).toContain('Historical Draft Snapshots');
    expect(html).toContain('Review Audit Log');
    expect(html).toContain('Section 18(1)');
  });
});
