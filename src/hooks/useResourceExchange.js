/**
 * useResourceExchange.js
 * Custom hook for Neighbourhood Resource Exchange data operations.
 * Provides list, load, and refetch functionality for resource listings,
 * exchange requests, handover confirmations, and moderation flags.
 * 
 * Follows patterns from existing hooks (useQueryPatterns, useCivicServices).
 */

import { useEffect, useState, useCallback } from 'react';
import {
  listResourceListings,
  getResourceListing,
  createResourceListing,
  createExchangeRequest,
  updateExchangeRequestState,
  createHandoverConfirmation,
  createModerationFlag,
  getModerationFlagsByListing,
  isListingExpired,
  getExpiringListings,
  SCHEMA_VERSION,
} from '../services/resourceExchangeService.js';

// ----------------------
// Listing operations
// ----------------------

/**
 * Hook for resource listings.
 * @param {'listings'|'expiring'} type - What to load
 * @param {object} options - Filter options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.pageSize - Items per page (max 50)
 * @param {string} options.category - Filter by category
 * @param {string} options.state - Filter by state
 * @param {string} options.availabilityWindow - Filter by availability window
 * @returns {{ data, loading, error, refetch, hasMore, loadMore }} */
export function useResourceExchange(type = 'listings', options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (overrides = {}) => {
    const { page: overridePage = page, pageSize = 20, category, state, availabilityWindow } = {
      ...options,
      ...overrides,
    };

    setLoading(true);
    setError(null);

    try {
      let result;
      if (type === 'listings') {
        result = await listResourceListings(
          category || state || availabilityWindow ? { category, state, availabilityWindow } : {},
          overridePage,
          pageSize
        );
      } else if (type === 'expiring') {
        result = { listings: getExpiringListings() };
      }

      if (result && result.success) {
        setData(result);
        setHasMore(overridePage * pageSize < (result.pagination?.total || 0));
      } else {
        setError(result?.errors?.[0]?.reason || 'Unknown error');
      }
    } catch (e) {
      setError(e.message || 'Failed to load resource exchange data');
    } finally {
      setLoading(false);
    }
  }, [type, options]);

  const refetch = useCallback(() => {
    setPage(1);
    load({ page: 1 });
  }, [load]);

  // Initial load
  useEffect(() => {
    load({ page: 1 });
  }, [load]);

  return { data, loading, error, refetch, hasMore, setPage, page };
}

// ----------------------
// Single record operations
// ----------------------

/**
 * Hook for a single resource listing by ID.
 * @param {string} id - Listing ID
 * @returns {{ data, loading, error, refetch }} */
export function useResourceListing(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getResourceListing(id);
      if (result.success) {
        setData(result.listing);
      } else {
        setError(result.errors?.[0]?.reason || 'Listing not found');
      }
    } catch (e) {
      setError(e.message || 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refetch = useCallback(() => {
    setPage(1);
    load();
  }, [load]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  return { data, loading, error, refetch };
}

// ----------------------
// Action operations
// ----------------------

/**
 * Hook for creating a resource listing.
 * @param {object} listing - The listing data
 * @returns {{ mutate, isLoading, error, success }} */
export function useCreateResourceListing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (listing) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await createResourceListing(listing);
      if (result.success) {
        setSuccess(true);
        return { success: true, data: result.listing };
      } else {
        setError(result.errors?.[0]?.reason || 'Validation failed');
        return { success: false, errors: result.errors };
      }
    } catch (e) {
      setError(e.message || 'Failed to create listing');
      return { success: false, error: e.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error, success };
}

/**
 * Hook for creating an exchange request.
 * @param {object} request - The request data
 * @returns {{ mutate, isLoading, error, success }} */
export function useCreateExchangeRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (request) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await createExchangeRequest(request);
      if (result.success) {
        setSuccess(true);
        return { success: true, data: result.request };
      } else {
        setError(result.errors?.[0]?.reason || 'Validation failed');
        return { success: false, errors: result.errors };
      }
    } catch (e) {
      setError(e.message || 'Failed to create request');
      return { success: false, error: e.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error, success };
}

/**
 * Hook for updating an exchange request state.
 * @param {string} requestId - The request ID
 * @param {string} newState - The new state
 * @returns {{ mutate, isLoading, error, success }} */
export function useUpdateExchangeRequestState(requestId, newState) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await updateExchangeRequestState(requestId, newState);
      if (result.success) {
        setSuccess(true);
        return { success: true, data: result.request };
      } else {
        setError(result.errors?.[0]?.reason || 'Invalid state transition');
        return { success: false, errors: result.errors };
      }
    } catch (e) {
      setError(e.message || 'Failed to update request state');
      return { success: false, error: e.message };
    } finally {
      setIsLoading(false);
    }
  }, [requestId, newState]);

  return { mutate, isLoading, error, success };
}

/**
 * Hook for creating a handover confirmation.
 * @param {object} confirmation - The confirmation data
 * @returns {{ mutate, isLoading, error, success }} */
export function useCreateHandoverConfirmation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (confirmation) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await createHandoverConfirmation(confirmation);
      if (result.success) {
        setSuccess(true);
        return { success: true, data: result.confirmation };
      } else {
        setError(result.errors?.[0]?.reason || 'Validation failed');
        return { success: false, errors: result.errors };
      }
    } catch (e) {
      setError(e.message || 'Failed to create confirmation');
      return { success: false, error: e.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error, success };
}

/**
 * Hook for creating a moderation flag.
 * @param {object} flag - The flag data
 * @returns {{ mutate, isLoading, error, success }} */
export function useCreateModerationFlag() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (flag) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await createModerationFlag(flag);
      if (result.success) {
        setSuccess(true);
        return { success: true, data: result.flag };
      } else {
        setError(result.errors?.[0]?.reason || 'Validation failed');
        return { success: false, errors: result.errors };
      }
    } catch (e) {
      setError(e.message || 'Failed to create moderation flag');
      return { success: false, errors: result.errors };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error, success };
}

/**
 * Hook for getting moderation flags by listing ID.
 * @param {string} listingId - The listing ID
 * @returns {{ data, loading, error, refetch }} */
export function useModerationFlags(listingId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getModerationFlagsByListing(listingId);
      if (result.success) {
        setData(result.flags);
      } else {
        setError(result.errors?.[0]?.reason || 'Failed to load flags');
      }
    } catch (e) {
      setError(e.message || 'Failed to load moderation flags');
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (listingId) load();
  }, [listingId, load]);

  return { data, loading, error, refetch };
}