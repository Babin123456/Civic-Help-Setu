import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DecibelLoggerCard from './DecibelLoggerCard.jsx';

describe('DecibelLoggerCard', () => {
  it('renders ambient decibel logger and acoustic metrics', () => {
    const html = renderToStaticMarkup(<DecibelLoggerCard />);
    expect(html).toContain('Ambient Noise Pollution Decibel Logger');
    expect(html).toContain('Recorded Sound Level (LAeq)');
    expect(html).toContain('Statutory Zone Limit');
    expect(html).toContain('Net Decibel Exceedance (ΔdB)');
    expect(html).toContain('STATUTORY SCHEDULE COMPARISON');
  });
});
