import { sortEventsChronologically } from '../../services/applicationEventService';

export const filterTimelineEvents = (
  events = [],
  { category = 'all', source = 'all' } = {}
) =>
  sortEventsChronologically(events).filter((event) => {
    if (category !== 'all' && event.category !== category) return false;
    if (source !== 'all' && event.sourceType !== source) return false;
    return true;
  });

export const toggleSelectedEvent = (current = [], eventId) => {
  if (current.includes(eventId)) return current.filter((id) => id !== eventId);
  if (current.length >= 2) return [current[1], eventId];
  return [...current, eventId];
};
