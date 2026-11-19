// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import OfflineCacheActionCard from './OfflineCacheActionCard';
import {
  cacheServiceOffline,
  clearOfflineCache,
  isServiceCachedOffline,
} from '../../services/offlineCacheService';

describe('OfflineCacheActionCard', () => {
  beforeEach(() => {
    clearOfflineCache();
  });

  it('renders nothing when service is null or has no id', () => {
    const htmlNull = renderToStaticMarkup(<OfflineCacheActionCard service={null} />);
    expect(htmlNull).toBe('');

    const htmlEmpty = renderToStaticMarkup(<OfflineCacheActionCard service={{}} />);
    expect(htmlEmpty).toBe('');
  });

  it('renders offline visit staging card with action button and guidance', () => {
    const service = {
      id: 'pan-card',
      name: 'PAN Card New Application',
      category: 'Identity',
    };

    const html = renderToStaticMarkup(<OfflineCacheActionCard service={service} />);
    expect(html).toContain('role="region"');
    expect(html).toContain('Offline In-Office Access');
    expect(html).toContain('Save for Offline Visit');
    expect(html).toContain('Online Only');
  });

  describe('mounted service changes', () => {
    let container;
    let root;
    const firstService = { id: 'pan-card', name: 'PAN Card' };
    const secondService = { id: 'birth-certificate', name: 'Birth Certificate' };

    beforeEach(() => {
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    });

    const renderService = async (service) => {
      await act(async () => root.render(<OfflineCacheActionCard service={service} />));
    };

    it('can switch between missing and valid services while mounted', async () => {
      await renderService(null);
      expect(container.innerHTML).toBe('');

      await renderService(firstService);
      expect(container.querySelector('button').getAttribute('aria-label'))
        .toBe('Save PAN Card for offline visit');

      await renderService({});
      expect(container.innerHTML).toBe('');

      await renderService(secondService);
      expect(container.querySelector('button').getAttribute('aria-label'))
        .toBe('Save Birth Certificate for offline visit');
    });

    it('uses each service cache state and preserves Save and Remove actions after switching', async () => {
      cacheServiceOffline(firstService);
      await renderService(firstService);
      expect(container.textContent).toContain('Saved Locally');

      await renderService(secondService);
      expect(container.textContent).toContain('Online Only');
      await act(async () => container.querySelector('button').click());
      expect(isServiceCachedOffline(secondService.id)).toBe(true);
      expect(container.querySelector('button').getAttribute('aria-label'))
        .toBe('Remove Birth Certificate from offline cache');

      await renderService(firstService);
      expect(container.textContent).toContain('Saved Locally');
      await act(async () => container.querySelector('button').click());
      expect(isServiceCachedOffline(firstService.id)).toBe(false);
      expect(isServiceCachedOffline(secondService.id)).toBe(true);
      expect(container.textContent).toContain('Online Only');

      await renderService(secondService);
      expect(container.textContent).toContain('Saved Locally');
      expect(container.querySelector('button').getAttribute('aria-label'))
        .toBe('Remove Birth Certificate from offline cache');
    });
  });
});
