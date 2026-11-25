import { describe, it, expect, beforeEach } from 'vitest';
import {
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  AVAILABILITY_WINDOWS,
  REQUEST_STATES,
  validateResourceListing,
  validateExchangeRequest,
  validateHandoverConfirmation,
  validateModerationFlag,
  SCHEMA_VERSION,
} from '../data/resourceContract.js';
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
  RESOURCE_LISTINGS,
  EXCHANGE_REQUESTS,
  HANDOVER_CONFIRMATIONS,
  MODERATION_FLAGS,
} from './resourceExchangeService.js';

describe('resourceContract validation', () => {
  it('validates a correct resource listing', () => {
    const validListing = {
      id: 'res-101',
      title: 'Wheelchair in good condition',
      category: 'mobility_aid',
      description: 'Lightweight manual wheelchair available for borrowing',
      condition: 'good',
      availabilityWindow: 'within_3_days',
      pickupArea: 'Kothrud, Pune',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      state: 'active',
      createdBy: 'user_123',
      schemaVersion: SCHEMA_VERSION,
    };
    const errors = validateResourceListing(validListing);
    expect(errors).toHaveLength(0);
  });

  it('rejects listings with personal identifiers (zero PII)', () => {
    const piiListing = {
      id: 'res-102',
      title: 'Study books',
      category: 'book',
      description: 'Call me at 9876543210 or email me at user@example.com',
      condition: 'like_new',
      availabilityWindow: 'within_24_hours',
      pickupArea: 'Flat 402, Sunshine Apartments',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      state: 'active',
      phone: '9876543210',
      schemaVersion: SCHEMA_VERSION,
    };
    const errors = validateResourceListing(piiListing);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'phone')).toBe(true);
  });

  it('validates an exchange request', () => {
    const validRequest = {
      id: 'req-201',
      listingId: 'res-101',
      requesterId: 'user_456',
      handoverLocation: 'Near City Library entrance',
      handoverWindow: 'within_3_days',
      statusMessage: 'Need this for my grandmother for 2 weeks',
      state: 'pending',
      schemaVersion: SCHEMA_VERSION,
    };
    const errors = validateExchangeRequest(validRequest);
    expect(errors).toHaveLength(0);
  });
});

describe('resourceExchangeService', () => {
  beforeEach(() => {
    RESOURCE_LISTINGS.clear();
    EXCHANGE_REQUESTS.clear();
    HANDOVER_CONFIRMATIONS.clear();
    MODERATION_FLAGS.clear();
  });

  it('creates and retrieves a resource listing sanitizing creator PII', () => {
    const listing = {
      id: 'item-1',
      title: 'Drill Machine',
      category: 'tool',
      description: 'Cordless electric drill machine with bits',
      condition: 'good',
      availabilityWindow: 'within_1_week',
      pickupArea: 'Shivajinagar',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      state: 'active',
      createdBy: 'user_alice',
    };

    const result = createResourceListing(listing);
    expect(result.success).toBe(true);
    expect(result.listing.id).toBe('item-1');

    const fetched = getResourceListing('item-1');
    expect(fetched.success).toBe(true);
    expect(fetched.listing.id).toBe('item-1');
    expect(fetched.listing.createdBy).toBeUndefined(); // PII protected
  });

  it('manages exchange request workflow and state transitions', () => {
    createResourceListing({
      id: 'item-1',
      title: 'Drill Machine',
      category: 'tool',
      description: 'Cordless electric drill machine with bits',
      condition: 'good',
      availabilityWindow: 'within_1_week',
      pickupArea: 'Shivajinagar',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      state: 'active',
      createdBy: 'user_alice',
    });

    const request = {
      id: 'req-1',
      listingId: 'item-1',
      requesterId: 'user_bob',
      handoverLocation: 'Public garden gate',
      handoverWindow: 'within_3_days',
      statusMessage: 'Need for house repair',
      state: 'pending',
    };

    const res = createExchangeRequest(request);
    expect(res.success).toBe(true);

    const updated = updateExchangeRequestState('req-1', 'accepted', 'user_alice');
    expect(updated.success).toBe(true);
    expect(updated.request.state).toBe('accepted');
  });

  it('handles moderation flag creation', () => {
    createResourceListing({
      id: 'item-1',
      title: 'Drill Machine',
      category: 'tool',
      description: 'Cordless electric drill machine with bits',
      condition: 'good',
      availabilityWindow: 'within_1_week',
      pickupArea: 'Shivajinagar',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      state: 'active',
      createdBy: 'user_alice',
    });

    const flag = {
      id: 'flag-1',
      resourceListingId: 'item-1',
      type: 'spam',
      reason: 'Duplicate listing posted repeatedly',
    };

    const result = createModerationFlag(flag);
    expect(result.success).toBe(true);
    expect(result.flag.state).toBe('pending');
  });
});
