import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import NoticeOrderExplainerWorkspace from './NoticeOrderExplainerWorkspace';
import { NetworkProvider } from '../context/NetworkContext';

describe('NoticeOrderExplainerWorkspace (#1422)', () => {
  it('renders side-by-side authoritative text, plain-language summary, OCR confidence, and citations', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NetworkProvider>
          <NoticeOrderExplainerWorkspace />
        </NetworkProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Plain-Language Government Notice &amp; Order Explainer');
    expect(html).toContain('Official Text Remains Authoritative:');
    expect(html).toContain('Authoritative Official Text (Page 1, Para 1)');
    expect(html).toContain('Plain-Language Summary (Page 1, Para 1)');
    expect(html).toContain('OCR Confidence: 92%');
  });
});
