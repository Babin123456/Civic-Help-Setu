import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import PmKisanExceptionGuideWorkspace from './PmKisanExceptionGuideWorkspace.jsx';

describe('PmKisanExceptionGuideWorkspace', () => {
  it('renders accessible decision-tree selector and zero-credential guarantee', () => {
    const html = renderToStaticMarkup(<PmKisanExceptionGuideWorkspace actorId="farmer-ssr" />);
    expect(html).toContain('PM-KISAN Installment Exception Diagnosis Guide');
    expect(html).toContain('Step 1: Select Portal Status Message');
    expect(html).toContain('Do NOT enter Aadhaar numbers, bank account numbers, OTPs, or passwords.');
  });
});
