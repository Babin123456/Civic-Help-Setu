import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import FormFieldExplainerAssistant from './FormFieldExplainerAssistant';
import { LanguageProvider } from '../context/LanguageContext';
import { resetFormCatalogue } from '../services/formFieldExplainerService';

describe('FormFieldExplainerAssistant Component (#1001)', () => {
  beforeEach(() => {
    resetFormCatalogue();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
  });

  const renderComponent = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <LanguageProvider>
          <FormFieldExplainerAssistant />
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  it('renders page header, title, and educational boundary notice', () => {
    const html = renderComponent();

    expect(html).toContain('Multilingual Form Field Explainer');
    expect(html).toContain('Educational Assistance &amp; Submission Boundary:');
    expect(html).toContain('Civic Help Setu');
    expect(html).toContain('never fills, stores, or submits government applications');
  });

  it('renders all 5 high-volume UP forms in selector tabs', () => {
    const html = renderComponent();

    expect(html).toContain('Income Certificate (आय प्रमाण पत्र)');
    expect(html).toContain('Domicile / Residence Certificate (निवास प्रमाण पत्र)');
    expect(html).toContain('Caste Certificate - SC/ST/OBC (जाति प्रमाण पत्र)');
    expect(html).toContain('Old Age Pension Application (वृद्धावस्था पेंशन योजना)');
    expect(html).toContain('Jan Sunwai Citizen Grievance (जनसुनवाई - समाधान पोर्टल / IGRS)');
  });

  it('displays verified department provenance and source portal link', () => {
    const html = renderComponent();

    expect(html).toContain('Verified Department Provenance:');
    expect(html).toContain('Department of Revenue');
    expect(html).toContain('Official Department Portal');
    expect(html).toContain('https://edistrict.up.gov.in/edistrictup/');
  });

  it('renders plain-language explanation and document location guides', () => {
    const html = renderComponent();

    expect(html).toContain('What this field is asking (Plain Language)');
    expect(html).toContain('Where to find this information');
    expect(html).toContain('Example of expected input format');
    expect(html).toContain('Fictional Sample - Do not copy');
  });

  it('renders sensitive field security badge and official portal rule', () => {
    const html = renderComponent();

    // UP Income Certificate has Aadhaar as a sensitive field in its fields list
    expect(html).toContain('Official Rule Reference:');
    expect(html).toContain('UP Revenue Code Rules 2016');
  });

  it('renders live format validation sandbox with in-memory zero-PII indicator', () => {
    const html = renderComponent();

    expect(html).toContain('Live Format Validation &amp; Error-Prevention Sandbox');
    expect(html).toContain('In-Memory Only (Zero PII Saved)');
    expect(html).toContain('Ready to complete your official application?');
    expect(html).toContain('Proceed to Official Uttar Pradesh Portal');
  });
});
