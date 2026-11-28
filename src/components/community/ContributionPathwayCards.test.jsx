import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContributionPathwayCards, { CONTRIBUTION_PATHWAYS } from './ContributionPathwayCards';

describe('ContributionPathwayCards Component (#572)', () => {
  it('renders all contribution pathway cards with accessible metadata', () => {
    const html = renderToStaticMarkup(<ContributionPathwayCards />);

    expect(html).toContain('FIRST-TIME CONTRIBUTOR PATHWAYS');
    expect(html).toContain('Find Your Entry Point into Public Tech');
    expect(html).toContain('role="list"');
    expect(html).toContain('role="listitem"');

    // Verify all 6 core disciplines are present
    expect(html).toContain('Frontend &amp; UI Engineering');
    expect(html).toContain('Accessibility &amp; Screen Readers');
    expect(html).toContain('Civic Service Data &amp; Schemas');
    expect(html).toContain('AI Policy &amp; Safe Guidance');
    expect(html).toContain('Testing &amp; Chaos Automation');
    expect(html).toContain('Documentation &amp; Guides');
  });

  it('links each card to GitHub issue search and repository tree with safe attributes', () => {
    const html = renderToStaticMarkup(<ContributionPathwayCards />);

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Good First Issues');
    expect(html).toContain('Explore Code');
    
    // Check specific query params
    expect(html).toContain('label%3Agood-first-issue');
    expect(html).toContain('tree/main/src/components');
  });

  it('contains expected structured data models', () => {
    expect(CONTRIBUTION_PATHWAYS.length).toBe(6);
    CONTRIBUTION_PATHWAYS.forEach((item) => {
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.skills.length).toBeGreaterThan(0);
      expect(item.repoPath).toBeDefined();
    });
  });
});
