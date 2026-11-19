import { describe, it, expect } from 'vitest';
import {
  createSlotFeed,
  updateSlotDate,
  removeSlotDate,
  getSortedSlotDates,
  hasAvailableSlots,
  hasLimitedSlots,
  allDatesFull,
  SLOT_FEED_FRESHNESS_WINDOW_MINUTES,
  SLOT_STATUS,
} from '../data/slotFeeds';

const nowISO = new Date().toISOString().split('T')[0];

describe('Slot Feed Data Model', () => {
  describe('createSlotFeed', () => {
    it('creates a slot feed with default offline freshness', () => {
      const feed = createSlotFeed(
        'test-office',
        'test-service',
        'Test Office & Service',
        'https://example.com'
      );

      expect(feed.id).toBe('slot-test-office-test-service');
      expect(feed.officeId).toBe('test-office');
      expect(feed.serviceId).toBe('test-service');
      expect(feed.label).toBe('Test Office & Service');
      expect(feed.feedFreshness).toBe('offline');
      expect(typeof feed.sourceTimestamp).toBe('string');
      expect(feed.sourceTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(feed.officialBookingUrl).toBe('https://example.com');
      expect(feed.dates).toHaveProperty(nowISO);
      expect(feed.dates[nowISO].status).toBe('unavailable');
      expect(feed.dates[nowISO].fromLiveFeed).toBe(false);
      expect(feed.lastChecked).toBe(nowISO);
    });

    it('accepts custom initial date', () => {
      const customDate = '2024-01-15';
      const feed = createSlotFeed(
        'test-office',
        'test-service',
        'Test',
        'https://example.com',
        customDate
      );

      expect(feed.dates[customDate]).toBeDefined();
      // sourceTimestamp should match the initial date format YYYY-MM-DD
      expect(feed.sourceTimestamp).toBe(customDate);
    });
  });

  describe('updateSlotDate', () => {
    it('updates a date slot to available with count', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const newFeed = updateSlotDate(feed, '2024-01-20', 5, 'available', true);

      expect(newFeed.dates['2024-01-20'].slotCount).toBe(5);
      expect(newFeed.dates['2024-01-20'].status).toBe('available');
      expect(newFeed.dates['2024-01-20'].slotDescription).toBe('5 slots available');
      expect(newFeed.dates['2024-01-20'].fromLiveFeed).toBe(true);
      // Freshness is 'fresh' when fromLiveFeed is true (sourceTimestamp updated)
      expect(newFeed.feedFreshness).toBe('fresh');
      expect(typeof newFeed.sourceTimestamp).toBe('string');
    });

    it('updates a date slot to limited', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const newFeed = updateSlotDate(feed, '2024-01-20', 2, 'limited');

      expect(newFeed.dates['2024-01-20'].slotCount).toBe(2);
      expect(newFeed.dates['2024-01-20'].status).toBe('limited');
      expect(newFeed.dates['2024-01-20'].slotDescription).toBe('2 slots limited');
      // Freshness becomes 'stale' when fromLiveFeed is false (default) and time has passed
      expect(newFeed.feedFreshness).toBe('stale');
    });

    it('updates a date slot to full', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const newFeed = updateSlotDate(feed, '2024-01-20', 0, 'full');

      expect(newFeed.dates['2024-01-20'].slotCount).toBe(0);
      expect(newFeed.dates['2024-01-20'].status).toBe('full');
      expect(newFeed.dates['2024-01-20'].slotDescription).toBe('0 slots full');
    });

    it('updates a date slot to unavailable', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const newFeed = updateSlotDate(feed, '2024-01-20', null, 'unavailable');

      expect(newFeed.dates['2024-01-20'].slotCount).toBeNull();
      expect(newFeed.dates['2024-01-20'].status).toBe('unavailable');
      expect(newFeed.dates['2024-01-20'].slotDescription).toBe('No slot data available');
    });
  });

  describe('removeSlotDate', () => {
    it('removes a date from the feed', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const newFeed = removeSlotDate(feed, '2024-01-20');

      expect(newFeed.dates['2024-01-20']).toBeUndefined();
      expect(Object.keys(newFeed.dates)).toHaveLength(0);
    });

    it('preserves other dates when removing one', () => {
      // Use a custom initial date to avoid the default nowISO date interfering
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const afterFirstUpdate = updateSlotDate(feed, '2024-01-21', 3, 'limited');
      const newFeed = removeSlotDate(afterFirstUpdate, '2024-01-20');

      expect(newFeed.dates['2024-01-20']).toBeUndefined();
      expect(newFeed.dates['2024-01-21'].slotCount).toBe(3);
      // Only the custom initial date should remain
      expect(Object.keys(newFeed.dates)).toHaveLength(1);
    });
  });

  describe('getSortedSlotDates', () => {
    it('returns dates sorted by date string', () => {
      // Use custom initial dates and remove the original to test sorting
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const afterFirstUpdate = updateSlotDate(feed, '2024-01-18', 3, 'limited', true);
      const afterSecondUpdate = updateSlotDate(afterFirstUpdate, '2024-01-25', 0, 'full', true);
      const afterRemove = removeSlotDate(afterSecondUpdate, '2024-01-20');

      const sorted = getSortedSlotDates(afterRemove);
      expect(sorted).toHaveLength(2);
      expect(sorted[0].date).toBe('2024-01-18');
      expect(sorted[1].date).toBe('2024-01-25');
      expect(sorted[0].slotCount).toBe(3);
      expect(sorted[1].slotCount).toBe(0);
    });

    it('handles empty dates', () => {
      // Create feed with all dates removed
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const afterRemove = removeSlotDate(feed, '2024-01-20');
      const sorted = getSortedSlotDates(afterRemove);
      expect(sorted).toHaveLength(0);
    });
  });

  describe('hasAvailableSlots', () => {
    it('returns true when at least one date is available', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const afterUpdate = updateSlotDate(feed, '2024-01-20', 5, 'available', true);
      expect(hasAvailableSlots(afterUpdate)).toBe(true);
    });

    it('returns false when no dates are available', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const afterUpdate = updateSlotDate(feed, '2024-01-20', 0, 'full', true);
      expect(hasAvailableSlots(afterUpdate)).toBe(false);
    });
  });

  describe('hasLimitedSlots', () => {
    it('returns true when at least one date has limited slots', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const afterUpdate = updateSlotDate(feed, '2024-01-20', 2, 'limited', true);
      expect(hasLimitedSlots(afterUpdate)).toBe(true);
    });

    it('returns false when no dates are limited', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com');
      const afterUpdate = updateSlotDate(feed, '2024-01-20', 5, 'available', true);
      expect(hasLimitedSlots(afterUpdate)).toBe(false);
    });
  });

  describe('allDatesFull', () => {
    it('returns true when all dates are full', () => {
      // Use custom initial date to control the dataset
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const afterFirstUpdate = updateSlotDate(feed, '2024-01-20', 0, 'full', true);
      const afterSecondUpdate = updateSlotDate(afterFirstUpdate, '2024-01-21', 0, 'full', true);
      expect(allDatesFull(afterSecondUpdate)).toBe(true);
    });

    it('returns false when some dates are not full', () => {
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const afterFirstUpdate = updateSlotDate(feed, '2024-01-20', 5, 'available', true);
      const afterSecondUpdate = updateSlotDate(afterFirstUpdate, '2024-01-21', 0, 'full', true);
      expect(allDatesFull(afterSecondUpdate)).toBe(false);
    });

    it('returns false when no dates exist', () => {
      // Create feed with all dates removed
      const feed = createSlotFeed('office', 'service', 'Test', 'https://example.com', '2024-01-20');
      const afterRemove = removeSlotDate(feed, '2024-01-20');
      expect(allDatesFull(afterRemove)).toBe(false);
    });
  });

  describe('SLOT_FEED_FRESHNESS_WINDOW_MINUTES', () => {
    it('is set to 30 minutes', () => {
      expect(SLOT_FEED_FRESHNESS_WINDOW_MINUTES).toBe(30);
    });
  });
});