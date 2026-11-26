import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ZkAttributeVerifierView from './ZkAttributeVerifierView';

describe('ZkAttributeVerifierView Page', () => {
  it('renders verifier portal with title and prototype disclaimer', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ZkAttributeVerifierView />
      </MemoryRouter>
    );

    expect(html).toContain('Zero-Knowledge Attribute Verifier');
    expect(html).toContain('Selective-disclosure verification portal');
    expect(html).toContain('Prototype Boundary Notice:');
    expect(html).toContain('Interactive Verifier');
    expect(html).toContain('Verifier Policies');
    expect(html).toContain('Revocation Simulator');
  });

  it('renders challenge nonce and verify action buttons', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ZkAttributeVerifierView />
      </MemoryRouter>
    );

    expect(html).toContain('Challenge Nonce:');
    expect(html).toContain('Paste Proof JSON Dossier:');
    expect(html).toContain('Verify Cryptographic Proof');
    expect(html).toContain('Load Sample Valid Proof');
    expect(html).toContain('Load Tampered Proof');
  });
});
