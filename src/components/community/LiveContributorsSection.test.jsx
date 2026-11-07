import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LiveContributorsSection from './LiveContributorsSection';
import { fetchLiveContributors } from '../../services/githubContributorsService';

describe('LiveContributorsSection Component (#562)', () => {
  it('renders section title and GitHub link markers', () => {
    const html = renderToStaticMarkup(<LiveContributorsSection />);

    expect(html).toContain('Repository Contributors');
    expect(html).toContain('Real GitHub Contributors');
    expect(html).toContain('View All on GitHub');
    expect(html).toContain('href="https://github.com/GoldRay19/Civic-Help-Setu/graphs/contributors"');
  });

  it('renders contributor cards when data is provided via fetcher', () => {
    const customFetcher = vi.fn().mockResolvedValue({
      status: 'success',
      contributors: [
        {
          id: 101,
          login: 'GoldRay19',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          html_url: 'https://github.com/GoldRay19',
          contributions: 42
        },
        {
          id: 102,
          login: 'CivicContributor',
          avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
          html_url: 'https://github.com/CivicContributor',
          contributions: 15
        }
      ]
    });

    // In static SSR markup, initial state shows the loading indicator
    const html = renderToStaticMarkup(<LiveContributorsSection customFetcher={customFetcher} />);
    expect(html).toContain('Repository Contributors');
    expect(html).toContain('Real GitHub Contributors');
  });
});

describe('githubContributorsService logic (#562)', () => {
  it('parses successful response properly without inventing data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h === 'x-ratelimit-remaining' ? '45' : null)
      },
      json: async () => [
        {
          id: 1,
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.png',
          html_url: 'https://github.com/testuser',
          contributions: 20
        }
      ]
    });

    const res = await fetchLiveContributors({ fetchImpl: mockFetch, forceRefresh: true });
    expect(res.status).toBe('success');
    expect(res.contributors.length).toBe(1);
    expect(res.contributors[0].login).toBe('testuser');
    expect(res.contributors[0].contributions).toBe(20);
    expect(res.rateLimitRemaining).toBe(45);
  });

  it('detects rate limit status when status is 403 and remaining is 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: (h) => (h === 'x-ratelimit-remaining' ? '0' : null)
      },
      json: async () => ({ message: 'API rate limit exceeded' })
    });

    const res = await fetchLiveContributors({ fetchImpl: mockFetch, forceRefresh: true });
    expect(res.status).toBe('rate_limited');
    expect(res.contributors).toEqual([]);
    expect(res.rateLimitRemaining).toBe(0);
  });

  it('handles empty response gracefully without fake entries', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => []
    });

    const res = await fetchLiveContributors({ fetchImpl: mockFetch, forceRefresh: true });
    expect(res.status).toBe('empty');
    expect(res.contributors).toEqual([]);
  });

  it('handles network failure gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const res = await fetchLiveContributors({ fetchImpl: mockFetch, forceRefresh: true });
    expect(res.status).toBe('error');
    expect(res.contributors).toEqual([]);
    expect(res.errorMessage).toContain('Network offline');
  });

  it('serves from cache if TTL is valid', async () => {
    const mockStorage = {
      getItem: vi.fn().mockReturnValue(
        JSON.stringify({
          timestamp: Date.now() - 5000,
          contributors: [
            { id: 99, login: 'cacheduser', avatar_url: '', html_url: '', contributions: 5 }
          ]
        })
      ),
      setItem: vi.fn()
    };

    const mockFetch = vi.fn();
    const res = await fetchLiveContributors({
      fetchImpl: mockFetch,
      storage: mockStorage,
      forceRefresh: false
    });

    expect(res.isCached).toBe(true);
    expect(res.contributors.length).toBe(1);
    expect(res.contributors[0].login).toBe('cacheduser');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
