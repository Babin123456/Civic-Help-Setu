import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ExplainableServiceRankerWorkspace from './ExplainableServiceRankerWorkspace';
import { NetworkProvider } from '../context/NetworkContext';

describe('ExplainableServiceRankerWorkspace (#1430)', () => {
  it('renders ranker controls, fairness invariance status, and explanation factors', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NetworkProvider>
          <ExplainableServiceRankerWorkspace />
        </NetworkProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Explainable Civic Service Recommendation Ranker');
    expect(html).toContain('Fairness Invariance:');
    expect(html).toContain('PASSED');
    expect(html).toContain('Query Relevance');
    expect(html).toContain('Verified Freshness');
  });
});
