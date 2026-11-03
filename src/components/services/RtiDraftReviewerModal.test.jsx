import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RtiDraftReviewerModal from './RtiDraftReviewerModal';

describe('RtiDraftReviewerModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <RtiDraftReviewerModal isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with input fields and sample select when open', () => {
    const html = renderToStaticMarkup(
      <RtiDraftReviewerModal isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('AI RTI Draft Clarity &amp; Section 2(f) Compliance Reviewer');
    expect(html).toContain('Target Public Authority / Department');
    expect(html).toContain('Select sample draft...');
  });

  it('renders Section 2(f) rewording suggestions when "why" questions provided', () => {
    const html = renderToStaticMarkup(
      <RtiDraftReviewerModal
        isOpen={true}
        defaultAuthority="Municipal Corporation"
        initialQuestions={['Why was the tender for road repair delayed?']}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Section 2(f) Rejection Risk &amp; Recommended Material Rewording');
    expect(html).toContain('Suggested Record-Based Phrasing');
    expect(html).toContain('certified copies of file notings');
    expect(html).toContain('Adopt This Rewording');
  });
});
