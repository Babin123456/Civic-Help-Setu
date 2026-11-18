import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NoisePollutionWorkspace from './NoisePollutionWorkspace.jsx';

describe('NoisePollutionWorkspace', () => {
  it('renders workspace title, statutory badges, and tabs', () => {
    const html = renderToStaticMarkup(<NoisePollutionWorkspace />);
    expect(html).toContain('Ambient Noise Pollution &amp; Statutory SDM Redressal Workspace');
    expect(html).toContain('EPA 1986 &amp; NOISE RULES 2000');
    expect(html).toContain('Decibel Logger &amp; Limits');
    expect(html).toContain('Rule 5 Curfew &amp; DG Sets');
    expect(html).toContain('Silence Zone (100m)');
    expect(html).toContain('SDM Complaint Drafter');
    expect(html).toContain('Saved Logs');
  });
});
