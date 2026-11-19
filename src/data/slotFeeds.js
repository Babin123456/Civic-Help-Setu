/**
 * Service Appointment Slot Feed Data Model
 *
 * Defines the shape of verified slot feeds from government portals.
 * Only verified feed data is displayed; no-feed offices show guidance.
 *
 * Key fields:
 * - officeId: references a CIVIC_OFFICES entry
 * - serviceId: references a service from serviceCatalog (MOCK_SERVICES)
 * - dates: map of ISO date strings to slot status objects
 * - sourceTimestamp: when the feed was last refreshed (ISO string)
 * - feedFreshness: "fresh" | "stale" | "offline" based on window comparison
 * - officialBookingUrl: the authoritative portal URL for this office+service
 */

export const SLOT_FEED_FRESHNESS_WINDOW_MINUTES = 30;

/**
 * Slot status for a specific date
 */
export const SLOT_STATUS = {
  AVAILABLE: 'available',
  LIMITED: 'limited',
  FULL: 'full',
  UNAVAILABLE: 'unavailable',
};

/**
 * Slot detail object for a single date.
 * @typedef {Object} SlotDetail
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {number|null} slotCount - slot count or null if not supplied
 * @property {string} status - status from SLOT_STATUS
 * @property {string} slotDescription - human-readable slot description
 * @property {boolean} fromLiveFeed - whether this data came from a live feed
 */

/**
 * Full slot feed record for an office+service combination.
 * @typedef {Object} SlotFeed
 * @property {string} id - Unique identifier
 * @property {string} officeId - References CIVIC_OFFICES.id
 * @property {string} serviceId - References MOCK_SERVICES.id
 * @property {string} label - Human-readable label
 * @property {Record<string, SlotDetail>} dates - Slot details indexed by date
 * @property {string} sourceTimestamp - When the feed was last refreshed (ISO string)
 * @property {'fresh'|'stale'|'offline'} feedFreshness - Freshness state
 * @property {string} officialBookingUrl - Official booking portal URL
 * @property {string} lastChecked - Last checked timestamp for display
 */

/**
 * Creates a new slot feed record with default freshness state.
 * @param {string} officeId - References a CIVIC_OFFICES entry
 * @param {string} serviceId - References a MOCK_SERVICES.id
 * @param {string} label - Human-readable label
 * @param {string} officialBookingUrl - The authoritative portal URL
 * @param {string} [initialDate] - Optional initial date (YYYY-MM-DD)
 * @returns {SlotFeed} The new slot feed record
 */
export function createSlotFeed(officeId, serviceId, label, officialBookingUrl, initialDate) {
  const now = new Date().toISOString().split('T')[0];
  const initialDateStr = initialDate || now;

  return {
    id: `slot-${officeId}-${serviceId}`,
    officeId,
    serviceId,
    label: label || `${officeId}-${serviceId}`,
    dates: {
      [initialDateStr]: {
        date: initialDateStr,
        slotCount: null,
        status: SLOT_STATUS.UNAVAILABLE,
        slotDescription: 'No slot data available',
        fromLiveFeed: false,
      },
    },
    sourceTimestamp: initialDate || now,
    feedFreshness: 'offline',
    officialBookingUrl,
    lastChecked: now,
  };
}

/**
 * Updates a date's slot status in a feed.
 * Returns a new feed object (immutable update).
 * @param {SlotFeed} feed - The slot feed to update
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {number|null} slotCount - slot count or null
 * @param {string} status - status from SLOT_STATUS
 * @param {boolean} [fromLiveFeed=false] - whether this data came from a live feed
 * @returns {SlotFeed} The updated slot feed record
 */
export function updateSlotDate(feed, date, slotCount, status, fromLiveFeed = false) {
  const slotDescriptions = {
    [SLOT_STATUS.AVAILABLE]: slotCount !== null ? `${slotCount} slots available` : 'Slots available',
    [SLOT_STATUS.LIMITED]: slotCount !== null ? `${slotCount} slots limited` : 'Slots limited',
    [SLOT_STATUS.FULL]: slotCount !== null ? `${slotCount} slots full` : 'Slots full',
    [SLOT_STATUS.UNAVAILABLE]: 'No slot data available',
  };

  const slotDescription = slotDescriptions[status] || 'No slot data available';

  const newDates = {
    ...feed.dates,
    [date]: {
      date: date,
      slotCount,
      status,
      slotDescription,
      fromLiveFeed,
    },
  };

  // Compute freshness:
  // - If fromLiveFeed, always mark as 'fresh' (live feed data is always current)
  // - Otherwise, check if sourceTimestamp is within the freshness window
  let newFreshness;
  if (fromLiveFeed) {
    newFreshness = 'fresh';
  } else {
    const sourceTime = new Date(feed.sourceTimestamp).getTime();
    const now = Date.now();
    const diffMinutes = (now - sourceTime) / 60000;
    newFreshness = diffMinutes <= SLOT_FEED_FRESHNESS_WINDOW_MINUTES ? 'fresh' : 'stale';
  }

  return {
    ...feed,
    dates: newDates,
    sourceTimestamp: fromLiveFeed ? new Date().toISOString() : feed.sourceTimestamp,
    feedFreshness: newFreshness,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Removes a date from a feed's dates map (immutable update).
 * @param {SlotFeed} feed - The slot feed
 * @param {string} date - ISO date string (YYYY-MM-DD) to remove
 * @returns {SlotFeed} The updated slot feed record
 */
export function removeSlotDate(feed, date) {
  const { [date]: removed, ...newDates } = feed.dates;
  return {
    ...feed,
    dates: newDates,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Gets all dates that have slot data in a feed.
 * @param {SlotFeed} feed - The slot feed
 * @returns {string[]} Array of ISO date strings
 */
export function getDatesWithData(feed) {
  return Object.keys(feed.dates).filter(
    (date) => feed.dates[date].slotCount !== null || feed.dates[date].fromLiveFeed
  );
}

/**
 * Gets all dates and their slot status sorted by date.
 * @param {SlotFeed} feed - The slot feed
 * @returns {Array<{date, slotCount, status, slotDescription, fromLiveFeed, isFresh}>}
 */
export function getSortedSlotDates(feed) {
  const entries = Object.entries(feed.dates).map(([date, detail]) => ({
    date,
    ...detail,
    isFresh: new Date().getTime() - new Date(feed.sourceTimestamp).getTime() <=
      SLOT_FEED_FRESHNESS_WINDOW_MINUTES * 60000,
  }));

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Checks if a feed has any available slots.
 * @param {SlotFeed} feed - The slot feed
 * @returns {boolean}
 */
export function hasAvailableSlots(feed) {
  return Object.values(feed.dates).some(
    (d) => d.status === SLOT_STATUS.AVAILABLE
  );
}

/**
 * Checks if a feed has any limited slots.
 * @param {SlotFeed} feed - The slot feed
 * @returns {boolean}
 */
export function hasLimitedSlots(feed) {
  return Object.values(feed.dates).some(
    (d) => d.status === SLOT_STATUS.LIMITED
  );
}

/**
 * Checks if all dates are full.
 * @param {SlotFeed} feed - The slot feed
 * @returns {boolean}
 */
export function allDatesFull(feed) {
  const dates = Object.values(feed.dates);
  // If no dates exist, return false (no data = not fully full)
  if (dates.length === 0) return false;
  return dates.every((d) => d.status === SLOT_STATUS.FULL);
}