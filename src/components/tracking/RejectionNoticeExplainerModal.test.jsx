import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RejectionNoticeExplainerModal from './RejectionNoticeExplainerModal';

const sampleApp = {
  id: 'APP-10293',
  serviceName: 'Food Security Ration Card',
  status: 'rejected',
};

describe('RejectionNoticeExplainerModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <RejectionNoticeExplainerModal isOpen={false} application={sampleApp} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with input and samples when open', () => {
    const html = renderToStaticMarkup(
      <RejectionNoticeExplainerModal isOpen={true} application={sampleApp} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Plain-Language Rejection &amp; Objection Explainer');
    expect(html).toContain('Paste Official Rejection Notice');
    expect(html).toContain('Choose sample notice...');
  });

  it('renders plain-language explanation and steps when initial notice is provided', () => {
    const html = renderToStaticMarkup(
      <RejectionNoticeExplainerModal
        isOpen={true}
        application={sampleApp}
        initialNotice="Deficiency in Annexure IV uncompleted."
        onClose={() => {}}
      />
    );

    expect(html).toContain('Plain-Language Summary');
    expect(html).toContain('Missing or Incomplete Supporting Annexure');
    expect(html).toContain('Recommended Actionable Steps to Rectify');
    expect(html).toContain('Statutory Correction Deadline &amp; Legal Recourse');
  });
});

