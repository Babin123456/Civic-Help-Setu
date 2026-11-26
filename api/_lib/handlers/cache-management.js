/**
 * api/_lib/handlers/cache-management.js
 *
 * Cache Management API Handler
 * Provides administrative endpoints for the distributed cache layer.
 */

import { createCacheManagementHandler, resetCacheSystem } from '../cacheMiddleware.js';

let cacheManagementHandler = null;

/**
 * Get or create the cache management handler.
 */
export const getCacheManagementHandler = async () => {
  if (cacheManagementHandler) return cacheManagementHandler;

  cacheManagementHandler = await createCacheManagementHandler({
    requireAdmin: true,
    adminRoles: ['admin', 'reviewer', 'official'],
    onAudit: (event) => {
      console.log('[CacheManagement Audit]', JSON.stringify(event));
    },
  });

  return cacheManagementHandler;
};

/**
 * Reset handler (for testing).
 */
export const resetCacheManagementHandler = () => {
  cacheManagementHandler = null;
  resetCacheSystem();
};

/**
 * Main handler export for API dispatcher.
 */
export default async function handler(req, res) {
  const managementHandler = await getCacheManagementHandler();
  return managementHandler(req, res);
}