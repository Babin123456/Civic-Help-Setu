import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import FormFieldExplainer from './FormFieldExplainer.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const renderExplainer = (props = {}) => {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <FormFieldExplainer term="Affidavit" {...props} />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('FormFieldExplainer (#142)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('renders trigger button with accessible label and text', () => {
    const html = renderExplainer({ label: 'What is this?' });
    expect(html).toContain('What is this?');
    expect(html).toContain('form-field-explainer-trigger');
  });

  it('renders inline variant with badge style', () => {
    const html = renderExplainer({ variant: 'inline', term: 'NOC' });
    expect(html).toContain('aria-label="Explain &quot;NOC&quot;"');
    expect(html).toContain('What does this mean?');
  });

  it('renders icon variant with accessible label', () => {
    const html = renderExplainer({ variant: 'icon', term: 'Domicile' });
    expect(html).toContain('aria-label="What does Domicile mean?"');
  });
});
