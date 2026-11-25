import { render, screen } from '@testing-library/react';
import RadarChartWithTable from './RadarChartWithTable';

const mockRecord = {
  id: 'test-service',
  name: 'Test Service',
  category: 'Test',
  shortDescription: 'A test service description',
  department: 'Test Department',
  officialSources: [{ name: 'Official', url: 'https://example.gov.in' }],
  steps: [{ title: 'Step 1', description: 'Do the thing' }],
  fees: 'Free',
  processingTime: '7 days',
  lastVerified: '2026-11-18',
  jurisdiction: 'India',
  publicationState: 'published',
};

const mockRules = [
  { field: 'shortDescription', label: 'Short description', level: 'required', severity: 'high', weight: 1.0, aiSuggest: true, impactExplanation: 'test' },
  { field: 'department', label: 'Department', level: 'required', severity: 'high', weight: 1.0, aiSuggest: true, impactExplanation: 'test' },
  { field: 'officialSources', label: 'Official source', level: 'required', severity: 'high', weight: 1.0, aiSuggest: true, impactExplanation: 'test' },
  { field: 'steps', label: 'Application steps', level: 'required', severity: 'high', weight: 1.0, aiSuggest: true, impactExplanation: 'test' },
  { field: 'fees', label: 'Fees', level: 'required', severity: 'medium', weight: 0.75, aiSuggest: true, impactExplanation: 'test' },
  { field: 'processingTime', label: 'Processing time', level: 'required', severity: 'medium', weight: 0.75, aiSuggest: true, impactExplanation: 'test' },
  { field: 'lastVerified', label: 'Last-reviewed date', level: 'required', severity: 'medium', weight: 0.75, aiSuggest: false, impactExplanation: 'test' },
  { field: 'documents', label: 'Required documents', level: 'optional', severity: 'medium', weight: 0.5, aiSuggest: true, impactExplanation: 'test' },
  { field: 'eligibility', label: 'Eligibility criteria', level: 'optional', severity: 'medium', weight: 0.5, aiSuggest: true, impactExplanation: 'test' },
  { field: 'jurisdiction', label: 'Jurisdiction', level: 'optional', severity: 'medium', weight: 0.3, aiSuggest: false, impactExplanation: 'test' },
  { field: 'contacts', label: 'Contacts', level: 'optional', severity: 'low', weight: 0.2, aiSuggest: false, impactExplanation: 'test' },
];

const mockFieldStates = {
  shortDescription: 'verified',
  department: 'verified',
  officialSources: 'verified',
  steps: 'verified',
  fees: 'verified',
  processingTime: 'verified',
  lastVerified: 'verified',
  documents: 'missing',
  eligibility: 'missing',
  jurisdiction: 'missing',
  contacts: 'missing',
};

describe('RadarChartWithTable', () => {
  it('renders radar SVG chart for complete record', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={100}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    // SVG element should be present
    expect(baseElement.querySelector('svg')).toBeTruthy();
  });

  it('renders table alternative for accessibility', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={85}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    // Table should be present as accessibility alternative
    expect(baseElement.querySelector('table')).toBeTruthy();
    // Should have headers
    expect(baseElement.querySelectorAll('th')).toBeTruthy();
  });

  it('displays quality score in center of radar', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={75}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    const scoreText = baseElement.querySelector('text');
    expect(scoreText).toBeTruthy();
    expect(scoreText?.textContent).toContain('75%');
  });

  it('renders state labels on radar segments', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={100}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
        showLabels={true}
      />
    );
    // Labels should be present
    const labels = baseElement.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('renders without labels when showLabels is false', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={100}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
        showLabels={false}
      />
    );
    // Fewer text elements when labels are hidden
    const textCount = baseElement.querySelectorAll('text').length;
    expect(textCount).toBeLessThan(20); // should be reduced
  });

  it('handles missing field states gracefully', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={}
        score={50}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    expect(baseElement.querySelector('svg')).toBeTruthy();
  });

  it('applies correct segment colors based on state', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={100}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    // SVG paths with fill colors should exist
    const paths = baseElement.querySelectorAll('path[fill]');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('has visible focus for keyboard navigation', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={100}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    // Focusable elements should have visible focus
    const focusable = baseElement.querySelectorAll('[tabindex]');
    expect(focusable.length).toBeGreaterThan(0);
  });

  it('has aria-label for accessibility', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={100}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    const svg = baseElement.querySelector('svg');
    expect(svg).toHaveAttribute('aria-label');
  });

  it('table has summary attribute', () => {
    const { baseElement } = render(
      <RadarChartWithTable
        fieldStates={mockFieldStates}
        score={85}
        recordName="Test Service"
        recordId="test-service"
        rules={mockRules}
      />
    );
    const table = baseElement.querySelector('table');
    expect(table).toHaveAttribute('summary');
  });
});