import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VolumetricNgtCalculator from './VolumetricNgtCalculator.jsx';

describe('VolumetricNgtCalculator Component (#878)', () => {
  it('renders volumetric inputs and statutory callout', () => {
    const html = renderToStaticMarkup(<VolumetricNgtCalculator />);

    expect(html).toContain('Volumetric Dumping Hazard');
    expect(html).toContain('NGT Environmental Compensation Estimator');
    expect(html).toContain('Dump Site Length (meters)');
    expect(html).toContain('Dump Site Width (meters)');
    expect(html).toContain('Average Waste Pile Height / Depth (meters)');
  });

  it('renders NGT compensation summary cards', () => {
    const html = renderToStaticMarkup(<VolumetricNgtCalculator />);

    expect(html).toContain('Accumulated Volume');
    expect(html).toContain('Estimated Tonnage');
    expect(html).toContain('Bio-Mining Cost');
    expect(html).toContain('NGT Compensation Liability');
  });
});
