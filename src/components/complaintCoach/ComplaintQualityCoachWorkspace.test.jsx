import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ComplaintQualityCoachWorkspace from './ComplaintQualityCoachWorkspace.jsx';

describe('ComplaintQualityCoachWorkspace Component', () => {
  it('renders without throwing and displays header, notices, and form controls', () => {
    const html = renderToStaticMarkup(<ComplaintQualityCoachWorkspace />);

    expect(html).toContain('Agentic Civic Complaint Quality &amp; Completeness Coach');
    expect(html).toContain('Civic Governance Notice');
    expect(html).toContain('Select Civic Department / Category');
    expect(html).toContain('Load Synthetic Demo Complaint');
    expect(html).toContain('Describe Your Complaint / Issue');
    expect(html).toContain('Analyze Complaint Quality');
  });

  it('contains category options matching COMPLAINT_CATEGORIES', () => {
    const html = renderToStaticMarkup(<ComplaintQualityCoachWorkspace />);

    expect(html).toContain('Municipal Services &amp; Infrastructure');
    expect(html).toContain('Water Supply &amp; Sewerage');
    expect(html).toContain('Electricity &amp; Power Distribution');
    expect(html).toContain('Public Transit &amp; Road Safety');
  });

  it('renders synthetic fixture options safely', () => {
    const html = renderToStaticMarkup(<ComplaintQualityCoachWorkspace />);

    expect(html).toContain('Incomplete Pothole Complaint');
    expect(html).toContain('Complete Pothole Complaint with Reference and Landmark');
    expect(html).toContain('Prompt Injection / System Prompt Extraction Attack');
  });
});
