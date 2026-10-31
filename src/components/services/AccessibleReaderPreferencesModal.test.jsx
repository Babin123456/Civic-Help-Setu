import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import AccessibleReaderPreferencesModal from './AccessibleReaderPreferencesModal';

describe('AccessibleReaderPreferencesModal', () => {
  it('returns null when closed', () => {
    const html = renderToString(<AccessibleReaderPreferencesModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders typography controls, contrast themes, and live sample preview', () => {
    const html = renderToString(
      <AccessibleReaderPreferencesModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Accessible Reader &amp; Typography Preferences');
    expect(html).toContain('Text Size Scaling');
    expect(html).toContain('Line Spacing');
    expect(html).toContain('Enable Dyslexia-Friendly Letter Spacing');
    expect(html).toContain('Reading Contrast Scheme');
    expect(html).toContain('Amber on Dark');
    expect(html).toContain('Live Reader Sample Preview');
    expect(html).toContain('Reset to Default');
  });
});
