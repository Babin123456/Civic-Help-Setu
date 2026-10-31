import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QuickFilterPresets, { QUICK_PRESETS } from './QuickFilterPresets';

describe('QuickFilterPresets', () => {
  it('renders all quick preset chips with labels', () => {
    const html = renderToStaticMarkup(
      <QuickFilterPresets activePresetId={null} onSelectPreset={() => {}} />
    );
    expect(html).toContain('Quick Presets:');
    expect(html).toContain('Fast Track (≤ 7 Days)');
    expect(html).toContain('Zero Cost (Free)');
    expect(html).toContain('100% Online Application');
    expect(html).toContain('Essential Certificates');
    expect(html).toContain('Welfare &amp; Benefits');
  });

  it('marks active preset button with aria-pressed="true"', () => {
    const html = renderToStaticMarkup(
      <QuickFilterPresets activePresetId="fast-track" onSelectPreset={() => {}} />
    );
    expect(html).toContain('aria-pressed="true"');
  });
});
