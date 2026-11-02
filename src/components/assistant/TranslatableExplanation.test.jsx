import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TranslatableExplanation from './TranslatableExplanation';
import { LanguageProvider } from '../../context/LanguageContext';

const renderWithProvider = (ui) =>
  renderToStaticMarkup(<LanguageProvider>{ui}</LanguageProvider>);

describe('TranslatableExplanation component', () => {
  it('returns null when text is empty or not provided', () => {
    expect(renderWithProvider(<TranslatableExplanation text="" />)).toBe('');
    expect(renderWithProvider(<TranslatableExplanation text={null} />)).toBe('');
  });

  it('renders original text and translate button by default', () => {
    const text = 'Official Fees for Birth Certificate: ₹20 - ₹100.';
    const html = renderWithProvider(<TranslatableExplanation text={text} />);

    expect(html).toContain(text);
    expect(html).toContain('Translate');
    expect(html).toContain('aria-label="Select explanation translation language"');
  });

  it('preserves amounts and URLs in rendered markup', () => {
    const text = 'Check fees at https://services.india.gov.in (₹50 fee).';
    const html = renderWithProvider(<TranslatableExplanation text={text} />);

    expect(html).toContain('https://services.india.gov.in');
    expect(html).toContain('₹50');
  });
});
