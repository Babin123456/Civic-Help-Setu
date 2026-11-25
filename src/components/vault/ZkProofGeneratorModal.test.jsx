import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ZkProofGeneratorModal from './ZkProofGeneratorModal';

describe('ZkProofGeneratorModal Component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(<ZkProofGeneratorModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders modal dialog when isOpen is true', () => {
    const html = renderToStaticMarkup(<ZkProofGeneratorModal isOpen={true} onClose={() => {}} />);
    expect(html).toContain('Zero-Knowledge Attribute Proof Generator');
    expect(html).toContain('Selective Disclosure Prototype');
    expect(html).toContain('Select Civic Verification Policy:');
    expect(html).toContain('Zero-Knowledge Guarantee:');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('contains prototype disclaimer banner and accessibility attributes', () => {
    const html = renderToStaticMarkup(<ZkProofGeneratorModal isOpen={true} onClose={() => {}} />);
    expect(html).toContain('Cryptographic Prototype:');
    expect(html).toContain('PROTOTYPE ZERO-KNOWLEDGE PROOF');
    expect(html).toContain('Compute Attribute Proof in Browser');
  });
});
