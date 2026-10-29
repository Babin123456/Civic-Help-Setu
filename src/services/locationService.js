import { CIVIC_OFFICES } from '../data/locationOffices';
import { logDiagnostic } from '../utils/diagnostics';
import { minimizeAppointments, minimizePhoneNumber } from './dataMinimization';

const APPOINTMENTS_STORAGE_KEY = 'civicbridge_office_tokens';
const USER_LOCATION_CACHE_KEY = 'civicbridge_user_coords';

const isValidLat = (v) => Number.isFinite(v) && v >= -90 && v <= 90;
const isValidLng = (v) => Number.isFinite(v) && v >= -180 && v <= 180;
const asText = (v) => (typeof v === 'string' ? v.trim() : '');
const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/**
 * Cleans one raw office record. Returns null when it can't be shown safely
 * (missing id, name or usable coordinates). Text and list fields fall back to
 * empty values so later string/array calls never throw.
 */
export const normalizeOffice = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = asText(raw.id);
  const name = asText(raw.name);
  const lat = raw.coordinates?.lat;
  const lng = raw.coordinates?.lng;
  if (!id || !name || !isValidLat(lat) || !isValidLng(lng)) return null;

  return {
    ...raw,
    id,
    name,
    category: asText(raw.category),
    type: asText(raw.type),
    state: asText(raw.state),
    district: asText(raw.district),
    city: asText(raw.city),
    pincode: asText(raw.pincode),
    address: asText(raw.address),
    landmark: asText(raw.landmark),
    channels: asList(raw.channels),
    serviceIds: asList(raw.serviceIds),
    features: asList(raw.features),
    coordinates: { lat, lng },
  };
};

/**
 * Normalizes a list of offices: drops unusable records and removes duplicates
 * (same id, or same name + pincode). The first record wins.
 */
export const normalizeOffices = (list) => {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenNamePin = new Set();
  const result = [];
  for (const raw of list) {
    const office = normalizeOffice(raw);
    if (!office) continue;
    const namePin = `${office.name.toLowerCase()}|${office.pincode}`;
    if (seenIds.has(office.id) || seenNamePin.has(namePin)) continue;
    seenIds.add(office.id);
    seenNamePin.add(namePin);
    result.push(office);
  }
  return result;
};

const OFFICES = normalizeOffices(CIVIC_OFFICES);

/**
 * Calculates straight line distance in km between two lat/lng pairs using the Haversine formula.
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
};

/**
 * Formats a distance in kilometers into a human-friendly string.
 */
export const formatDistance = (distanceKm) => {
  if (distanceKm == null) return 'Distance unavailable';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
};

/**
 * Request user's current GPS location with explicit consent and accuracy fallback.
 */
export const requestUserCoordinates = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err = new Error('Geolocation is not supported by your browser.');
      err.kind = 'unsupported';
      reject(err);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        };
        try {
          sessionStorage.setItem(USER_LOCATION_CACHE_KEY, JSON.stringify(coords));
        } catch {
          // ignore session storage fail
        }
        resolve(coords);
      },
      (error) => {
        let message = 'Unable to retrieve location.';
        let kind = 'unavailable';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access was denied. You can select your state and district manually.';
            kind = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is currently unavailable.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again or select manually.';
            kind = 'timeout';
            break;
          default:
            message = error.message;
        }
        const err = new Error(message);
        err.kind = kind;
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
};

/**
 * Retrieves cached user coordinates from current session if available.
 */
export const getCachedUserCoordinates = () => {
  try {
    const raw = sessionStorage.getItem(USER_LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !isValidLat(parsed.lat) || !isValidLng(parsed.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Returns a list of unique states present in the offices registry.
 */
export const getAvailableStates = () => {
  const states = Array.from(new Set(OFFICES.map((o) => o.state))).filter(Boolean);
  return states.sort();
};

/**
 * Returns a list of districts belonging to a specific state.
 */
export const getDistrictsByState = (state) => {
  if (!state) return [];
  const districts = Array.from(
    new Set(
      OFFICES.filter((o) => o.state.toLowerCase() === state.toLowerCase()).map(
        (o) => o.district
      )
    )
  ).filter(Boolean);
  return districts.sort();
};

/**
 * Evaluates whether an office is currently open based on current local time.
 */
export const isOfficeOpenNow = (office) => {
  if (!office?.officeHours) return false;
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 6 is Saturday

  // Sunday closed for government offices unless 7 days
  if (day === 0 && !office.officeHours.days.toLowerCase().includes('7 days')) {
    return false;
  }

  // Saturday check
  if (day === 6 && !office.officeHours.openSaturdays) {
    return false;
  }

  const currentHour = now.getHours() + now.getMinutes() / 60;
  // Typical gov timings: 9.5 (9:30 AM) to 17.5 (5:30 PM)
  return currentHour >= 9.5 && currentHour <= 17.5;
};

/**
 * Filters and ranks civic offices based on multi-factor location & preference criteria.
 */
export const filterCivicOffices = ({
  userCoords = null,
  searchQuery = '',
  state = '',
  district = '',
  channel = 'all', // 'all' | 'in-person' | 'online' | 'phone'
  maxRadiusKm = 100,
  serviceId = '',
  onlyOpenNow = false,
  onlyWheelchairAccessible = false,
  offices = OFFICES,
}) => {
  const cleanQuery = (searchQuery || '').trim().toLowerCase();

  return normalizeOffices(offices).map((office) => {
    let distance = null;
    if (userCoords && Number.isFinite(userCoords.lat) && Number.isFinite(userCoords.lng)) {
      distance = calculateDistanceKm(
        userCoords.lat,
        userCoords.lng,
        office.coordinates.lat,
        office.coordinates.lng
      );
    }

    const openNow = isOfficeOpenNow(office);
    const hasWheelchair = office.features?.includes('wheelchair_accessible') || false;

    return {
      ...office,
      distanceKm: distance,
      isOpenNow: openNow,
      isWheelchairAccessible: hasWheelchair,
    };
  })
    .filter((office) => {
      // Service ID filter (e.g. from service details page)
      if (serviceId && !office.serviceIds?.includes(serviceId)) {
        return false;
      }

      // State filter
      if (state && office.state.toLowerCase() !== state.toLowerCase()) {
        return false;
      }

      // District filter
      if (district && office.district.toLowerCase() !== district.toLowerCase()) {
        return false;
      }

      // Channel filter
      if (channel !== 'all' && !office.channels.includes(channel)) {
        return false;
      }

      // Radius filter when user coordinates exist
      if (userCoords && office.distanceKm != null && office.distanceKm > maxRadiusKm) {
        return false;
      }

      // Open now filter
      if (onlyOpenNow && !office.isOpenNow) {
        return false;
      }

      // Accessibility filter
      if (onlyWheelchairAccessible && !office.isWheelchairAccessible) {
        return false;
      }

      // Text query match
      if (cleanQuery) {
        const matchesName = office.name.toLowerCase().includes(cleanQuery);
        const matchesAddress = office.address.toLowerCase().includes(cleanQuery);
        const matchesCity = office.city.toLowerCase().includes(cleanQuery);
        const matchesPin = office.pincode.includes(cleanQuery);
        const matchesCategory = office.category.toLowerCase().includes(cleanQuery);
        const matchesLandmark = office.landmark.toLowerCase().includes(cleanQuery);

        if (
          !matchesName &&
          !matchesAddress &&
          !matchesCity &&
          !matchesPin &&
          !matchesCategory &&
          !matchesLandmark
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Closest offices first if distance is known
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.name.localeCompare(b.name);
    });
};

/**
 * Local appointment and visit token booking storage helpers.
 */
export const getOfficeAppointments = () => {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw);
    // Older bookings kept the full mobile number, cut them down once (#212)
    const minimized = minimizeAppointments(stored);
    if (minimized !== stored) {
      try {
        localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(minimized));
      } catch {
        // still return the minimized copy
      }
    }
    return minimized;
  } catch {
    return [];
  }
};

export const bookOfficeAppointment = ({
  officeId,
  officeName,
  address,
  city,
  state,
  directionsUrl,
  serviceName,
  applicantName,
  contactNumber,
  appointmentDate,
  timeSlot,
}) => {
  const appointments = getOfficeAppointments();
  const tokenNumber = `TKN-${Math.floor(100000 + Math.random() * 900000)}`;
  const newAppointment = {
    id: `apt_${Date.now()}`,
    tokenNumber,
    officeId,
    officeName,
    address: address || '',
    city: city || '',
    state: state || '',
    directionsUrl: directionsUrl || '',
    serviceName,
    applicantName,
    contactNumber: minimizePhoneNumber(contactNumber),
    appointmentDate,
    timeSlot,
    status: 'Confirmed',
    bookedAt: new Date().toISOString(),
  };

  appointments.unshift(newAppointment);
  try {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
  } catch (err) {
    logDiagnostic('Failed to store appointment', err);
  }
  return newAppointment;
};

export const cancelOfficeAppointment = (appointmentId) => {
  const appointments = getOfficeAppointments();
  const filtered = appointments.filter((a) => a.id !== appointmentId);
  try {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    logDiagnostic('Failed to update appointments', err);
  }
  return filtered;
};
