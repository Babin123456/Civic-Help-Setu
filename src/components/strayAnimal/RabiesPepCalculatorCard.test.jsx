import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RabiesPepCalculatorCard from './RabiesPepCalculatorCard.jsx';

describe('RabiesPepCalculatorCard', () => {
  it('renders PEP protocol engine and wound washing alert', () => {
    const html = renderToStaticMarkup(<RabiesPepCalculatorCard />);
    expect(html).toContain('Rabies Post-Exposure Prophylaxis (PEP) Protocol Engine');
    expect(html).toContain('CRITICAL FIRST-AID RULE: 15-MINUTE SOAP');
    expect(html).toContain('Category I (No Exposure)');
    expect(html).toContain('Category II (Minor Exposure)');
    expect(html).toContain('Category III (Severe Exposure)');
  });

  it('renders Category III RIG calculation and vaccination schedule', () => {
    const html = renderToStaticMarkup(<RabiesPepCalculatorCard />);
    expect(html).toContain('MANDATORY RABIES IMMUNOGLOBULIN (RIG) DOSAGE (CATEGORY III)');
    expect(html).toContain('Calculated Anti-Rabies Vaccination (ARV) Calendar');
    expect(html).toContain('10-Day Observation Rule');
  });
});
