import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NoiseCurfewAuditorCard from './NoiseCurfewAuditorCard.jsx';

describe('NoiseCurfewAuditorCard', () => {
  it('renders Rule 5 night-time curfew auditor and equipment penalties', () => {
    const html = renderToStaticMarkup(<NoiseCurfewAuditorCard />);
    expect(html).toContain('Rule 5 Night-Time Curfew &amp; Equipment Auditor');
    expect(html).toContain('RULE 5(1) NOISE RULES, 2000');
    expect(html).toContain('Estimated Compounding Fine');
    expect(html).toContain('COGNIZABLE CURFEW INFRACTION');
  });
});
