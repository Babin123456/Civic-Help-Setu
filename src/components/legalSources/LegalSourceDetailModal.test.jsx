import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LegalSourceDetailModal from './LegalSourceDetailModal.jsx';
import { INITIAL_LEGAL_SOURCES } from '../../services/legalSourceStorage.js';

describe('LegalSourceDetailModal Component (#949)', () => {
  const sampleSource = INITIAL_LEGAL_SOURCES.find((s) => s.id === 'src-mwpsc-sec4');

  it('renders modal with title, provision, reviewer metadata and official links', () => {
    const html = renderToStaticMarkup(
      <LegalSourceDetailModal source={sampleSource} onClose={() => {}} canReview={true} />
    );

    expect(html).toContain('Section 4 &amp; Section 9');
    expect(html).toContain('Maintenance and Welfare of Parents and Senior Citizens Act, 2007');
    expect(html).toContain('Plain-Language Legal Summary');
    expect(html).toContain('Canonical Statutory Provision Text');
    expect(html).toContain('View Gazette / Code');
    expect(html).toContain('STATUTORY CITATION NOTICE');
  });

  it('renders revision history list and rollback options', () => {
    const html = renderToStaticMarkup(
      <LegalSourceDetailModal source={sampleSource} onClose={() => {}} canReview={true} onRollback={() => {}} />
    );

    expect(html).toContain('Historical Revisions &amp; Rollback Log');
    expect(html).toContain('v1.0.0');
    expect(html).toContain('Rollback to v1.0.0');
  });

  it('returns null when no source is selected', () => {
    const html = renderToStaticMarkup(
      <LegalSourceDetailModal source={null} onClose={() => {}} />
    );
    expect(html).toBe('');
  });
});
