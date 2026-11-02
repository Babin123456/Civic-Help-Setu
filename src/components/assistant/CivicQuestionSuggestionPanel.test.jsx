import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicQuestionSuggestionPanel from './CivicQuestionSuggestionPanel.jsx';

describe('CivicQuestionSuggestionPanel component', () => {
  it('exports a valid React functional component', () => {
    expect(typeof CivicQuestionSuggestionPanel).toBe('function');
  });

  describe('Generic fallback suggestions', () => {
    it('renders generic fallback suggestions when no service context is supplied', () => {
      const html = renderToStaticMarkup(<CivicQuestionSuggestionPanel />);

      expect(html).toContain('Suggested Questions');
      expect(html).toContain('Common public service questions to get started');
      expect(html).toContain('Which documents are usually needed for this service?');
      expect(html).toContain('Where can I find the official application link?');
    });

    it('renders accessible button elements for every suggestion', () => {
      const html = renderToStaticMarkup(<CivicQuestionSuggestionPanel />);

      const buttonMatches = html.match(/<button[^>]*aria-label="Ask:[^"]*"[^>]*>/g) || [];
      expect(buttonMatches.length).toBeGreaterThanOrEqual(4);

      // Verify buttons are type="button" for keyboard and form safety
      buttonMatches.forEach((btn) => {
        expect(btn).toContain('type="button"');
      });
    });

    it('displays the disclaimer notice that approvals and eligibility are not guaranteed', () => {
      const html = renderToStaticMarkup(<CivicQuestionSuggestionPanel />);

      expect(html).toContain('Official eligibility and approvals are decided solely by the designated government authorities');
      expect(html).not.toContain('your application has been approved');
      expect(html).not.toContain('guaranteed eligibility');
    });
  });

  describe('Service-specific suggestions', () => {
    const sampleService = {
      id: 'ration-card',
      name: 'Ration Card',
      category: 'Food & Civil Supplies',
      department: 'Department of Food and Public Distribution',
      steps: [{ title: 'Submit proof of residence' }],
    };

    it('adapts questions when a service object is provided', () => {
      const html = renderToStaticMarkup(
        <CivicQuestionSuggestionPanel service={sampleService} />
      );

      expect(html).toContain('Context tailored to Ration Card');
      expect(html).toContain('Which documents are usually needed for Ration Card?');
      expect(html).toContain('Where can I find the official application link for Ration Card?');
      expect(html).toContain('What are the typical fees and processing time for Ration Card?');
      expect(html).toContain('Ration Card');
    });

    it('renders service context badge with a clear context button', () => {
      const html = renderToStaticMarkup(
        <CivicQuestionSuggestionPanel service={sampleService} />
      );

      expect(html).toContain('aria-label="Clear Ration Card context"');
    });

    it('adapts questions when serviceId is provided', () => {
      const html = renderToStaticMarkup(
        <CivicQuestionSuggestionPanel serviceId="birth-certificate" />
      );

      expect(html).toContain('Birth Certificate');
      expect(html).toContain('Which documents are usually needed for Birth Certificate?');
    });
  });

  describe('Deduplication and integrity', () => {
    it('does not render duplicate question buttons in the same panel', () => {
      const html = renderToStaticMarkup(<CivicQuestionSuggestionPanel />);

      const matches = [...html.matchAll(/<span>(Which documents are usually needed for this service\?)<\/span>/g)];
      expect(matches.length).toBe(1);
    });

    it('renders disabled state when disabled prop is true', () => {
      const html = renderToStaticMarkup(<CivicQuestionSuggestionPanel disabled={true} />);

      const buttonMatches = html.match(/<button[^>]*disabled=""[^>]*>/g) || html.match(/<button[^>]*disabled[^>]*>/g) || [];
      expect(buttonMatches.length).toBeGreaterThan(0);
    });

    it('renders secondary fill-only button when onFillSuggestion prop is provided', () => {
      const htmlWithFill = renderToStaticMarkup(
        <CivicQuestionSuggestionPanel onFillSuggestion={() => {}} />
      );

      expect(htmlWithFill).toContain('aria-label="Edit in input box:');
    });
  });
});

