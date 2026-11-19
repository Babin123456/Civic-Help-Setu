import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicSurveyWorkspace from './CivicSurveyWorkspace.jsx';

describe('CivicSurveyWorkspace', () => {
  it('renders the civic survey workspace header, actions, and filter controls', () => {
    const html = renderToStaticMarkup(<CivicSurveyWorkspace />);

    expect(html).toContain('Civic Survey Builder &amp; Sampling Diagnostics');
    expect(html).toContain('Create Survey Project');
    expect(html).toContain('Search by survey title, topic, or department...');
    expect(html).toContain('Ward 12 Municipal Water Supply &amp; Pipeline Reliability Survey');
    expect(html).toContain('Sampling Target');
    expect(html).toContain('Codebook');
    expect(html).toContain('Quality &amp; Bias');
  });
});

