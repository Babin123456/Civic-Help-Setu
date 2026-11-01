import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceGuide from './ServiceGuide';
import { MOCK_SERVICES } from '../../data/services';

const service = MOCK_SERVICES.find((s) => s.id === 'birth-certificate');

const render = (focusMode) =>
  renderToStaticMarkup(
    <ServiceGuide service={service} focusMode={focusMode} onToggleFocusMode={() => {}} />
  );

// Visible text only, so class names and aria state do not count as content.
const textOf = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/Focus mode: On|Focus mode/g, '')
    .trim();

describe('ServiceGuide focus mode', () => {
  it('uses the reading layout class only when focus mode is on', () => {
    expect(render(false)).not.toContain('service-guide--focus');
    expect(render(true)).toContain('service-guide--focus');
  });

  it('keeps warnings, steps, documents and official links in both layouts', () => {
    [false, true].forEach((mode) => {
      const html = render(mode);
      service.warnings.forEach((w) => expect(html).toContain(w.replace(/'/g, '&#x27;')));
      service.steps.forEach((step) => expect(html).toContain(step.title));
      expect(html).toContain('Proof of birth from hospital');
      expect(html).toContain('href="https://services.india.gov.in/"');
      expect(html).toContain('Before you apply');
    });
  });

  it('does not change the text content, only the presentation', () => {
    expect(textOf(render(true))).toBe(textOf(render(false)));
  });

  it('keeps the same heading order in both layouts', () => {
    const headings = (html) => [...html.matchAll(/<h([2-4])[^>]*>/g)].map((m) => m[1]).join('');
    expect(headings(render(true))).toBe(headings(render(false)));
    expect(headings(render(true)).startsWith('23')).toBe(true);
  });

  it('exposes the toggle as a pressed-state button', () => {
    expect(render(false)).toContain('aria-pressed="false"');
    expect(render(true)).toContain('aria-pressed="true"');
    expect(render(true)).toMatch(/<button[^>]*type="button"/);
  });

  it('skips sections the service has no data for', () => {
    const html = renderToStaticMarkup(
      <ServiceGuide service={{ id: 'x', name: 'x' }} focusMode onToggleFocusMode={() => {}} />
    );
    expect(html).not.toContain('Before you apply');
    expect(html).not.toContain('Documents you need');
    expect(html).toContain('How to apply');
  });
});
