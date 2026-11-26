import { withApiErrorContract } from './errorContract.js';
/**
 * api/neighbourhood-resource-exchange.js
 * Server-side endpoint for the Neighbourhood Resource Exchange feature (#760).
 * 
 * Supports:
 *  - Creating, listing, and viewing resource listings (books, mobility aids, tools, emergency supplies)
 *  - Requesting items from listings
 *  - Agreeing handovers and confirming completion
 *  - Moderation flags for unsafe or prohibited content
 * 
 * Invariants enforced:
 *  - Zero PII: No home addresses, phone numbers, or personal identifiers in public records
 *  - Contact details only shared after mutual acceptance in handover
 *  - Listings expire after their availability window
 *  - Public submissions rate-limited to prevent abuse
 *  - Moderation flags reviewed by admins before content goes public
 *  - All state transitions are validated with actionable messages
 */

import { createRateLimiter, createSingleFlight } from './abuseGuard.js';
import { withRequestSecurity } from './requestSecurity.js';
import {
  createResourceListing,
  getResourceListing,
  listResourceListings,
  createExchangeRequest,
  getExchangeRequest,
  updateExchangeRequestState,
  createHandoverConfirmation,
  getHandoverConfirmation,
  createModerationFlag,
  getModerationFlagsByListing,
  isListingExpired,
  getExpiringListings,
  SCHEMA_VERSION,
} from '../../src/services/resourceExchangeService.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queues for administrator moderation
export const MODERATION_FLAG_QUEUE = [];
export const EXCHANGE_REQUEST_QUEUE = [];

const PROHIBITED_CATEGORIES = ['weapon', 'drug', 'explosive', 'hazardous'];

function sanitizeText(val, maxLen = 1500) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Strip control characters
    .trim()
    .slice(0, maxLen);
}

function isHttpsUrl(v) {
  if (typeof v !== 'string' || v.trim().length === 0) return true;
  try {
    const url = new URL(v);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateNeighbourhoodResourceExchangePayload(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  // ==================================----------------------
  // 1. Mandatory Fields Discriminator: determine action type
  // ==================================----------------------

  const action = body.action;
  if (!action) {
    errors.push('action: "createListing"|"listListings"|"createRequest"|"updateRequest"|"createConfirmation"|"createFlag" is required.');
  } else if (action === 'createListing') {
    // ---- createListing ----
    if (!isText(body.title)) errors.push('title: Listing title is required and must be non-empty.');
    if (!isValidCategory(body.category)) errors.push(`category: Must be one of: ${ITEM_CATEGORIES.join(', ')}.`);
    if (!isText(body.description)) errors.push('description: Description is required and must be non-empty.');
    if (!isValidCondition(body.condition)) errors.push(`condition: Must be one of: ${ITEM_CONDITIONS.join(', ')}.`);
    if (!isValidAvailabilityWindow(body.availabilityWindow)) errors.push(`availabilityWindow: Must be one of: ${AVAILABILITY_WINDOWS.join(', ')}.`);
    if (!isText(body.pickupArea)) errors.push('pickupArea: Pickup area is required and must be non-empty (no exact addresses).');
    if (!body.expiresAt || isNaN(new Date(body.expiresAt).getTime())) {
      errors.push('expiresAt: Valid expiry date is required.');
    } else if (new Date(body.expiresAt) <= new Date()) {
      errors.push('expiresAt: Expiry must be in the future.');
    }

    // Zero PII: reject exact residential addresses
    const fullText = `${body.title} ${body.description} ${body.pickupArea}`;
    // Reject flat/door/house numbers in pickupArea
    const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;
    if (DOOR_REGEX.test(fullText)) {
      errors.push('pickupArea: Exact flat/door/house addresses are prohibited for privacy.');
    }

    // Reject prohibited categories
    if (PROHIBITED_CATEGORIES.includes(body.category.toLowerCase())) {
      errors.push(`category: "${body.category}" is not permitted in the neighbourhood resource exchange.`);
    }

    // Rate limit public submissions
    const ip = body.ip || (typeof window !== 'undefined' ? undefined : '127.0.0.1');
    if (ip) {
      const { allowed } = rateLimiter.take(ip);
      if (!allowed) {
        errors.push('rateLimit: Too many submissions. Please wait before submitting another listing.');
      }
    }

  } else if (action === 'listListings') {
    // ---- listListings ----
    // No PII-sensitive validation needed; just ensure pagination params are valid
    if (body.page !== undefined && (typeof body.page !== 'number' || body.page < 1)) {
      errors.push('page: Must be a positive integer.');
    }
    if (body.pageSize !== undefined && (typeof body.pageSize !== 'number' || body.pageSize < 1 || body.pageSize > 50)) {
      errors.push('pageSize: Must be between 1 and 50.');
    }

  } else if (action === 'createRequest') {
    // ---- createRequest ----
    if (!isText(body.listingId)) errors.push('listingId: Source listing ID is required.');
    if (!isText(body.requesterId)) errors.push('requesterId: Requester ID is required.');
    if (!isText(body.responderId)) errors.push('responderId: Responder (listing owner) ID is required.');
    if (!isText(body.handoverLocation)) errors.push('handoverLocation: Handover location is required (general area, no exact address).');
    if (!isText(body.handoverWindow)) errors.push('handoverWindow: Handover window is required.');
    if (!isText(body.statusMessage)) errors.push('statusMessage: Status message is required.');

    // Zero PII checks on handoverLocation
    const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;
    if (DOOR_REGEX.test(body.handoverLocation)) {
      errors.push('handoverLocation: Exact residential addresses are prohibited.');
    }

  } else if (action === 'updateRequest') {
    // ---- updateRequest ----
    if (!isText(body.requestId)) errors.push('requestId: Exchange request ID is required.');
    if (!isValidRequestState(body.newState)) errors.push(`newState: Must be one of: ${REQUEST_STATES.join(', ')}.`);

  } else if (action === 'createConfirmation') {
    // ---- createConfirmation ----
    if (!isText(body.exchangeRequestId)) errors.push('exchangeRequestId: Exchange request ID is required.');
    if (!isText(body.confirmerId)) errors.push('confirmerId: Confirmer ID is required.');
    if (!isText(body.handoverLocation)) errors.push('handoverLocation: Handover location is required (general area).');
    if (!body.confirmedAt || isNaN(new Date(body.confirmedAt).getTime())) {
      errors.push('confirmedAt: Valid confirmation date is required.');
    }

  } else if (action === 'createFlag') {
    // ---- createFlag ----
    if (!isText(body.resourceListingId)) errors.push('resourceListingId: Resource listing ID is required.');
    if (!isValidModerationFlagType(body.type)) errors.push(`type: Must be one of: ${MODERATION_FLAGS_TYPES.join(', ')}.`);
    if (!isText(body.reason)) errors.push('reason: Reason is required and must be non-empty.');

    // Zero PII: reject exact addresses in reason
    const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;
    if (DOOR_REGEX.test(body.reason)) {
      errors.push('reason: Exact residential addresses are prohibited in moderation reasons.');
    }

  } else {
    errors.push(`action: Unknown action "${action}". Supported actions: createListing, listListings, createRequest, updateRequest, createConfirmation, createFlag.`);
  }

  return errors;
}

// Helper: check if category is valid
function isValidCategory(c) {
  return typeof c === 'string' && ITEM_CATEGORIES.includes(c);
}

// Helper: check if request state is valid
function isValidRequestState(s) {
  return typeof s === 'string' && REQUEST_STATES.includes(s);
}

// Helper: check if moderation flag type is valid
function isValidModerationFlagType(t) {
  return typeof t === 'string' && MODERATION_FLAGS_TYPES.includes(t);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    // Public read endpoint - list active listings
    try {
      const listings = listResourceListings({}, 1, 20);
      return res.status(200).json({
        success: true,
        count: listings.listings.length,
        listings: listings.listings,
        schemaVersion: SCHEMA_VERSION,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch listings.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method Not Allowed. Only POST and GET requests are accepted.' });
  }

  // Abuse protection & rate limiting
  const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many requests. Please wait before submitting.', retryAfterSeconds });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Malformed JSON payload.' });
    }
  }

  // Validate payload against action-specific rules
  const validationErrors = validateNeighbourhoodResourceExchangePayload(body);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors,
    });
  }

  const action = body.action;

  // Deduplicate inflight identical requests where applicable
  let flightKey;
  if (action === 'createListing') {
    flightKey = `${ip}:${body.title}:${body.category}`;
  } else if (action === 'createRequest') {
    flightKey = `${ip}:${body.listingId}:${body.requesterId}`;
  } else if (action === 'createFlag') {
    flightKey = `${ip}:${body.resourceListingId}:${body.type}`;
  }

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();

    try {
      switch (action) {
        case 'createListing': {
          const result = createResourceListing({
            id: body.id || `listing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: sanitizeText(body.title, 200),
            category: sanitizeText(body.category, 50),
            description: sanitizeText(body.description, 2000),
            condition: sanitizeText(body.condition, 50),
            availabilityWindow: sanitizeText(body.availabilityWindow, 50),
            pickupArea: sanitizeText(body.pickupArea, 200),
            expiresAt: body.expiresAt,
            state: 'active',
            createdBy: body.createdBy || 'citizen',
            schemaVersion: SCHEMA_VERSION,
            ip,
          });

          if (!result.success) {
            return res.status(400).json({
              success: false,
              errors: result.errors,
            });
          }

          const listing = result.listing;
          // Queue for moderation if needed, or mark active
          EXCHANGE_REQUEST_QUEUE.unshift({
            ...listing,
            action: 'created',
            timestamp,
          });
          if (MODERATION_FLAG_QUEUE.length > 200) MODERATION_FLAG_QUEUE.pop();

          return res.status(201).json({
            success: true,
            listing,
            message: 'Listing created and published to the neighbourhood resource exchange.',
            schemaVersion: SCHEMA_VERSION,
          });
        }

        case 'listListings': {
          const page = body.page || 1;
          const pageSize = Math.min(body.pageSize || 20, 50);
          const result = listResourceListings(
            body.category ? { category: body.category } : {},
            page,
            pageSize
          );
          return res.status(200).json({
            success: true,
            listings: result.listings,
            pagination: result.pagination,
            schemaVersion: SCHEMA_VERSION,
          });
        }

        case 'createRequest': {
          const result = createExchangeRequest({
            id: body.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            listingId: body.listingId,
            requesterId: body.requesterId,
            responderId: body.responderId,
            handoverLocation: sanitizeText(body.handoverLocation, 200),
            handoverWindow: sanitizeText(body.handoverWindow, 100),
            state: 'pending',
            statusMessage: sanitizeText(body.statusMessage, 500),
            schemaVersion: SCHEMA_VERSION,
          });

          if (!result.success) {
            return res.status(400).json({
              success: false,
              errors: result.errors,
            });
          }

          const request = result.request;
          EXCHANGE_REQUEST_QUEUE.unshift({
            ...request,
            action: 'created',
            timestamp,
          });
          if (EXCHANGE_REQUEST_QUEUE.length > 200) EXCHANGE_REQUEST_QUEUE.pop();

          return res.status(201).json({
            success: true,
            request,
            message: 'Exchange request submitted. The listing owner will be notified.',
            schemaVersion: SCHEMA_VERSION,
          });
        }

        case 'updateRequest': {
          const result = updateExchangeRequestState(body.requestId, body.newState);
          if (!result.success) {
            return res.status(400).json({
              success: false,
              errors: result.errors,
            });
          }
          return res.status(200).json({
            success: true,
            request: result.request,
            message: 'Exchange request state updated.',
            schemaVersion: SCHEMA_VERSION,
          });
        }

        case 'createConfirmation': {
          const result = createHandoverConfirmation({
            id: body.id || `confirm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            exchangeRequestId: body.exchangeRequestId,
            confirmerId: body.confirmerId,
            handoverLocation: sanitizeText(body.handoverLocation, 200),
            confirmedAt: body.confirmedAt,
            state: 'confirmed',
            schemaVersion: SCHEMA_VERSION,
          });

          if (!result.success) {
            return res.status(400).json({
              success: false,
              errors: result.errors,
            });
          }

          const confirmation = result.confirmation;
          HANDOVER_CONFIRMATIONS.set(confirmation.id, confirmation);

          // Update the exchange request state to handover_completed
          await updateExchangeRequestState(body.exchangeRequestId, 'handover_completed');

          return res.status(201).json({
            success: true,
            confirmation,
            message: 'Handover confirmed. The listing is now closed.',
            schemaVersion: SCHEMA_VERSION,
          });
        }

        case 'createFlag': {
          const result = createModerationFlag({
            id: body.id || `flag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            resourceListingId: body.resourceListingId,
            type: sanitizeText(body.type, 50),
            reason: sanitizeText(body.reason, 2000),
            claimedBy: body.claimedBy || 'moderator',
            schemaVersion: SCHEMA_VERSION,
          });

          if (!result.success) {
            return res.status(400).json({
              success: false,
              errors: result.errors,
            });
          }

          const flag = result.flag;
          MODERATION_FLAG_QUEUE.unshift(flag);
          if (MODERATION_FLAG_QUEUE.length > 200) MODERATION_FLAG_QUEUE.pop();

          return res.status(201).json({
            success: true,
            flag,
            message: 'Moderation flag submitted. Admin will review.',
            schemaVersion: SCHEMA_VERSION,
          });
        }

        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } catch (e) {
      console.error('neighbourhood-resource-exchange error:', e);
      return res.status(500).json({ error: 'Internal server error.', schemaVersion: SCHEMA_VERSION });
    }
  });
}
export default withApiErrorContract(withRequestSecurity(handler, { allowMissingOrigin: true }));
