import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Checklist from './Checklist';

describe('Checklist markup', () => {
  const html = renderToStaticMarkup(
    <Checklist items={['Aadhaar Card', 'Affidavit']} checklistId="SRV-TEST" label="Docs" />
  );

  it('renders a labelled list of real checkboxes', () => {
    expect(html).toContain('<ul class="cl-list" aria-label="Docs"');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain('<label class="cl-label">');
  });

  it('states completion in text, not only colour', () => {
    expect(html).toContain('0 of 2 completed');
    expect(html).toContain('To do');
  });

  it('has a polite live region for save status', () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('shows no error or conflict message initially', () => {
    expect(html).not.toContain('role="alert"');
  });

  it('renders just the summary for an empty list', () => {
    expect(renderToStaticMarkup(<Checklist />)).toContain('0 of 0 completed');
  });
});

describe('Checklist requirement states and empty state', () => {
  const requirements = {
    'Aadhaar Card': { type: 'required', condition: null, source: null },
    'Affidavit': { type: 'conditional', condition: 'you are a tenant', source: null },
    'Passport photo': { type: 'optional', condition: null, source: null },
    'Old receipt': { type: 'unverified', condition: null, source: null },
  };
  const html = renderToStaticMarkup(
    <Checklist
      items={['Aadhaar Card', 'Affidavit', 'Passport photo', 'Old receipt']}
      requirements={requirements}
      checklistId="SRV-REQ"
      label="Docs"
    />
  );

  it('tags each item with its requirement type so it can be styled by more than colour', () => {
    expect(html).toContain('cl-item cl-item--required');
    expect(html).toContain('cl-item cl-item--conditional');
    expect(html).toContain('cl-item cl-item--optional');
    expect(html).not.toContain('cl-item--undefined');
  });

  it('writes each type out in text', () => {
    expect(html).toContain('Official requirement');
    expect(html).toContain('Conditional requirement');
    expect(html).toContain('Optional suggestion');
    expect(html).toContain('Not verified');
  });

  it('shows an explicit message instead of a blank list when no documents exist', () => {
    const empty = renderToStaticMarkup(<Checklist items={[]} checklistId="SRV-EMPTY" />);
    expect(empty).toContain('No documents are listed for this service yet');
    expect(empty).not.toContain('<ul');
  });
});
