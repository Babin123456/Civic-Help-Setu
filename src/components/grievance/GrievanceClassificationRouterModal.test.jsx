import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GrievanceClassificationRouterModal from './GrievanceClassificationRouterModal';

describe('GrievanceClassificationRouterModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <GrievanceClassificationRouterModal isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders modal with input and sample dropdown when open', () => {
    const html = renderToStaticMarkup(
      <GrievanceClassificationRouterModal isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Civic Grievance Classifier &amp; Department Router');
    expect(html).toContain('Describe your civic problem or issue');
    expect(html).toContain('Select common problem...');
  });

  it('renders classification report, department mandate, and evidence checklist when complaint provided', () => {
    const html = renderToStaticMarkup(
      <GrievanceClassificationRouterModal
        isOpen={true}
        initialText="Deep pothole on the main road damaging cars."
        onClose={() => {}}
      />
    );

    expect(html).toContain('Public Works Department (PWD)');
    expect(html).toContain('Statutory SLA');
    expect(html).toContain('Essential Evidence to Attach Before Filing');
    expect(html).toContain('Statutory Escalation Ladder');
  });
});
