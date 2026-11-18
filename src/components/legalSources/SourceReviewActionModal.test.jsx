import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SourceReviewActionModal from './SourceReviewActionModal.jsx';
import { INITIAL_LEGAL_SOURCES } from '../../services/legalSourceStorage.js';

describe('SourceReviewActionModal Component (#949)', () => {
  const sampleSource = INITIAL_LEGAL_SOURCES[0];

  it('renders review and publish form for authorized reviewer', () => {
    const html = renderToStaticMarkup(
      <SourceReviewActionModal
        source={sampleSource}
        actionType="review"
        allSources={INITIAL_LEGAL_SOURCES}
        canReview={true}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(html).toContain('Review &amp; Publish Legal Source');
    expect(html).toContain('Published Version (SemVer)');
    expect(html).toContain('Official Reviewer Notes');
    expect(html).toContain('Confirm Statutory Transition');
  });

  it('renders supersede form with replacement source selector', () => {
    const html = renderToStaticMarkup(
      <SourceReviewActionModal
        source={sampleSource}
        actionType="supersede"
        allSources={INITIAL_LEGAL_SOURCES}
        canReview={true}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(html).toContain('Supersede Legal Source');
    expect(html).toContain('Replacement Legal Source (Optional)');
    expect(html).toContain('Statutory Reason for Supersession');
  });

  it('renders rollback form with historical revision selector', () => {
    const mwpsc = INITIAL_LEGAL_SOURCES.find((s) => s.id === 'src-mwpsc-sec4');
    const html = renderToStaticMarkup(
      <SourceReviewActionModal
        source={mwpsc}
        actionType="rollback"
        allSources={INITIAL_LEGAL_SOURCES}
        canReview={true}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(html).toContain('Rollback Version');
    expect(html).toContain('Target Historical Revision to Restore');
    expect(html).toContain('Justification / High Court Precedent for Rollback');
    expect(html).toContain('v1.0.0');
  });

  it('displays RBAC privilege warning when user is unauthorized', () => {
    const html = renderToStaticMarkup(
      <SourceReviewActionModal
        source={sampleSource}
        actionType="review"
        allSources={INITIAL_LEGAL_SOURCES}
        canReview={false}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(html).toContain('Privilege Check:');
    expect(html).toContain('legalSources.review');
  });
});
