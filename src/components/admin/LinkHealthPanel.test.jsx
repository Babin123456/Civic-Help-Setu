import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LinkHealthPanel from './LinkHealthPanel';

const services = [
  { id: 'a', name: 'Service A', officialSources: [{ name: 'Portal', url: 'https://a.gov.in/apply' }, { name: 'Bad', url: 'javascript:alert(1)' }] },
  { id: 'b', name: 'No Links', officialSources: [] },
];

describe('LinkHealthPanel', () => {
  const html = renderToStaticMarkup(<LinkHealthPanel services={services} />);

  it('lists guides that have links and skips the rest', () => {
    expect(html).toContain('Service A');
    expect(html).not.toContain('No Links');
    expect(html).toContain('Not checked yet');
  });

  it('opens portals in a new tab with a safe rel, and never links an unsafe address', () => {
    expect(html).toContain('href="https://a.gov.in/apply"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('Not a web link');
  });

  it('explains that an unverifiable result does not mean the portal is down', () => {
    expect(html).toMatch(/Unable to verify/);
    expect(html).toMatch(/rather than down/);
  });
});
