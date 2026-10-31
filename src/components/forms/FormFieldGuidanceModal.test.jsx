import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FormFieldGuidanceModal from './FormFieldGuidanceModal';

describe('FormFieldGuidanceModal Component (#403)', () => {
  const service = {
    id: 'kisan-pm',
    title: 'PM Kisan Samman Nidhi',
    documents: ['Aadhaar Card', 'Bank Passbook', 'Land Revenue Khasra'],
  };

  it('renders field guidance modal with safety guardrails and field explanation', () => {
    const html = renderToStaticMarkup(
      <FormFieldGuidanceModal service={service} isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('Application Form Field Explainer');
    expect(html).toContain('PM Kisan Samman Nidhi');
    expect(html).toContain('Safety Guardrail:');
    expect(html).toContain('never invent personal answers');
    expect(html).toContain('Meaning &amp; Purpose:');
    expect(html).toContain('Where to Find This Information:');
    expect(html).toContain('Prescribed Format Rule:');
    expect(html).toContain('Common Pitfalls to Avoid:');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <FormFieldGuidanceModal service={service} isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });
});
