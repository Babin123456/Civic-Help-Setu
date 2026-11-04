import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TermExplainer from './TermExplainer.jsx';

const renderExplainer = (props = {}) => {
  return renderToStaticMarkup(<TermExplainer term="Domicile" {...props} />);
};

describe('TermExplainer (#383)', () => {
  it('renders an inline trigger button with accessible label and text', () => {
    const html = renderExplainer({ label: 'Explain this term' });
    expect(html).toContain('Explain this term');
    expect(html).toContain('aria-label="Explain &quot;Domicile&quot;"');
  });

  it('renders the icon variant with an accessible label', () => {
    const html = renderExplainer({ variant: 'icon', term: 'Affidavit' });
    expect(html).toContain('aria-label="Explain &quot;Affidavit&quot;"');
    expect(html).toContain('title="Explain term: Affidavit"');
  });

  it('renders the button variant with label text', () => {
    const html = renderExplainer({ variant: 'button', term: 'NOC' });
    expect(html).toContain('Explain this term');
  });

  it('renders without crashing when no term is provided', () => {
    const html = renderToStaticMarkup(<TermExplainer />);
    expect(html).toContain('aria-label="Explain &quot;&quot;"');
  });

  it('does not render the dialog markup when closed', () => {
    const html = renderExplainer();
    expect(html).not.toContain('aria-modal="true"');
  });
});
