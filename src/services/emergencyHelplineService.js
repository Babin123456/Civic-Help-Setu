import { EMERGENCY_HELPLINES, HELPLINE_CATEGORIES } from '../data/emergencyHelplines';

/**
 * Returns all verified civic emergency helplines, optionally filtered by domain
 *
 * @param {string} category
 * @returns {Object[]}
 */
export function getEmergencyHelplines(category = 'All') {
  if (!category || category === 'All') {
    return EMERGENCY_HELPLINES;
  }
  return EMERGENCY_HELPLINES.filter(
    (h) => h.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Searches emergency helplines by name, number, or keyword
 *
 * @param {string} query
 * @param {string} [category='All']
 * @returns {Object[]}
 */
export function searchEmergencyHelplines(query = '', category = 'All') {
  let list = getEmergencyHelplines(category);
  const clean = query.trim().toLowerCase();
  if (!clean) return list;

  return list.filter((h) => {
    return (
      h.name.toLowerCase().includes(clean) ||
      h.number.toLowerCase().includes(clean) ||
      h.description.toLowerCase().includes(clean) ||
      h.category.toLowerCase().includes(clean)
    );
  });
}

/**
 * Returns the list of categories for filter navigation
 */
export function getEmergencyCategories() {
  return HELPLINE_CATEGORIES;
}

/**
 * Cleans phone number for safe tel: URI link execution
 *
 * @param {string} number
 * @returns {string}
 */
export function formatDialerLink(number = '') {
  const digitsOnly = String(number).replace(/[^0-9+]/g, '');
  return `tel:${digitsOnly}`;
}
