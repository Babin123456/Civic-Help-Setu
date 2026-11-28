import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import FormFieldTranslationMemoryWorkspace from './FormFieldTranslationMemoryWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

describe('FormFieldTranslationMemoryWorkspace (#1423)', () => {
  beforeEach(() => {
    memStore.clear();
  });

  it('renders lookup, terminology registry, script metadata, and legal-term human review badge', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <FormFieldTranslationMemoryWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Multilingual Civic Form Field Translation Memory');
    expect(html).toContain('Lookup Form Field Label');
    expect(html).toContain('Terminology Registry');
    expect(html).toContain('Legal Term (Human Review)');
    expect(html).toContain('Devanagari');
  });
});
