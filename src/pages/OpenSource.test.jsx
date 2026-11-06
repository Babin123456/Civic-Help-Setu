import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OpenSource from './OpenSource';

describe('OpenSource Contributors Hub Page (#561)', () => {
  it('renders hero with correct Civic Help Setu branding and title', () => {
    const html = renderToStaticMarkup(<OpenSource />);

    expect(html).toContain('Civic Help Setu Community Hub');
    expect(html).toContain("Building India&#x27;s Public Tech Infrastructure, Together");
    expect(html).toContain('Civic Help Setu is a 100% open-source');
    expect(html).not.toContain('CivicBridge');
  });

  it('renders verified repository, contribution guide, and issue links with safe targets', () => {
    const html = renderToStaticMarkup(<OpenSource />);

    expect(html).toContain('href="https://github.com/GoldRay19/Civic-Help-Setu"');
    expect(html).toContain('href="https://github.com/GoldRay19/Civic-Help-Setu/blob/main/CONTRIBUTING.md"');
    expect(html).toContain('href="https://github.com/GoldRay19/Civic-Help-Setu/issues"');
    expect(html).toContain('href="https://github.com/GoldRay19/Civic-Help-Setu/pulls"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders distinct contribution pathways with accessible roles', () => {
    const html = renderToStaticMarkup(<OpenSource />);

    expect(html).toContain('Code &amp; Core Engineering');
    expect(html).toContain('UI &amp; UX Design');
    expect(html).toContain('Accessibility (a11y)');
    expect(html).toContain('Civic Data &amp; Scheme Guides');
    expect(html).toContain('Testing &amp; Quality Assurance');
    expect(html).toContain('Docs &amp; Translation');

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
  });

  it('renders quick local development instructions', () => {
    const html = renderToStaticMarkup(<OpenSource />);

    expect(html).toContain('Fast-Track Local Development Setup');
    expect(html).toContain('git clone https://github.com/&lt;your-username&gt;/Civic-Help-Setu.git');
    expect(html).toContain('npm test');
    expect(html).toContain('npm run lint:security');
  });
});
