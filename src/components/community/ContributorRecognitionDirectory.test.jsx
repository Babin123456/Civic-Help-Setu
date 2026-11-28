import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContributorRecognitionDirectory, { CONTRIBUTION_CATEGORIES } from './ContributorRecognitionDirectory';

describe('ContributorRecognitionDirectory Component (#573)', () => {
  const mockContributors = [
    {
      login: 'alice-dev',
      name: 'Alice Dev',
      avatar_url: 'https://github.com/alice.png',
      contributions: 42,
      areas: ['frontend', 'a11y']
    },
    {
      login: 'bob-data',
      name: 'Bob Data',
      avatar_url: 'https://github.com/bob.png',
      contributions: 18,
      areas: ['data']
    }
  ];

  it('renders filter controls and all contributor cards in default unfiltered state', () => {
    const html = renderToStaticMarkup(
      <ContributorRecognitionDirectory contributors={mockContributors} />
    );

    expect(html).toContain('CONTRIBUTOR DIRECTORY &amp; RECOGNITION');
    expect(html).toContain('Recognizing Community Contributors');
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('role="radiogroup"');
    
    // Check contributor cards
    expect(html).toContain('Alice Dev');
    expect(html).toContain('@alice-dev');
    expect(html).toContain('Bob Data');
    expect(html).toContain('@bob-data');
    expect(html).toContain('View Complete Contributor Graph on GitHub');
  });

  it('renders empty state when no contributors match the criteria', () => {
    const html = renderToStaticMarkup(
      <ContributorRecognitionDirectory contributors={[]} />
    );

    expect(html).toContain('No contributors found in this category');
    expect(html).toContain('Clear Filter');
  });

  it('verifies categories metadata', () => {
    expect(CONTRIBUTION_CATEGORIES.length).toBe(7);
    expect(CONTRIBUTION_CATEGORIES[0].id).toBe('all');
  });
});
