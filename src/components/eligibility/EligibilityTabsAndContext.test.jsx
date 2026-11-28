import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EligibilityTabsAndContext, { ELIGIBILITY_TABS } from './EligibilityTabsAndContext';

describe('EligibilityTabsAndContext Component (#577)', () => {
  it('renders applicant context and all navigation tabs with ARIA roles', () => {
    const html = renderToStaticMarkup(
      <EligibilityTabsAndContext activeTab="wizard">
        <div id="test-child">Wizard Content</div>
      </EligibilityTabsAndContext>
    );

    expect(html).toContain('EVALUATING FOR');
    expect(html).toContain('Self (Primary)');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Wizard Content');
  });

  it('renders multiple applicants dropdown when provided', () => {
    const applicants = [
      { id: 'self', name: 'Self', relation: 'Self' },
      { id: 'parent', name: 'Mother', relation: 'Parent' }
    ];

    const html = renderToStaticMarkup(
      <EligibilityTabsAndContext applicants={applicants} activeApplicantId="parent" activeTab="matrix">
        <div>Matrix Content</div>
      </EligibilityTabsAndContext>
    );

    expect(html).toContain('Switch Applicant:');
    expect(html).toContain('Mother');
    expect(html).toContain('Parent');
    expect(html).toContain('Matrix Content');
  });

  it('defines the required tab definitions', () => {
    expect(ELIGIBILITY_TABS.length).toBe(3);
    expect(ELIGIBILITY_TABS.map((t) => t.id)).toEqual(['wizard', 'matrix', 'saved']);
  });
});
