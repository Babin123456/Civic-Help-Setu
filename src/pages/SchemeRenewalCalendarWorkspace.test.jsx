import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import SchemeRenewalCalendarWorkspace from './SchemeRenewalCalendarWorkspace.jsx';

describe('SchemeRenewalCalendarWorkspace', () => {
  it('renders accessible renewal calendar form and no-auto-completion notice', () => {
    const html = renderToStaticMarkup(<SchemeRenewalCalendarWorkspace actorId="citizen-ssr" />);
    expect(html).toContain('Government Scheme Renewal');
    expect(html).toContain('Add Scheme to Your Renewal Calendar');
    expect(html).toContain('never automatically claims that an official renewal has been completed');
    expect(html).toContain('Export Calendar (.ics)');
  });
});
