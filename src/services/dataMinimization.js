// Data minimisation for records kept in localStorage (#212).
// Anything on the device can be read by the next person who uses it, or by a script running on
// the page, so identity numbers and phone numbers are cut down to their last four characters
// before they are written. The full value is never needed again by the app.

const LAST = 4;

const alnum = (value) => String(value ?? '').replace(/[^a-z0-9]/gi, '');

/**
 * Document numbers (Aadhaar, PAN, passport, licence...). Keeps the last four letters or digits.
 * "1234 5678 9012" -> "XXXX 9012", "ABCDE1234F" -> "XXXX 234F". Already-masked values stay the same.
 */
export const minimizeDocumentNumber = (value) => {
  const chars = alnum(value);
  if (!chars) return '';
  // Four characters or fewer is already not an identity number, nothing to cut
  if (chars.length <= LAST) return String(value).trim();
  return `XXXX ${chars.slice(-LAST).toUpperCase()}`;
};

/** Phone numbers. "98765 43210" -> "XXXXXX3210". Already-masked values stay the same. */
export const minimizePhoneNumber = (value) => {
  const chars = alnum(value);
  if (!chars) return '';
  if (chars.length <= LAST) return 'X'.repeat(chars.length);
  return `XXXXXX${chars.slice(-LAST)}`;
};

/** Returns the same array when nothing changed, so callers can skip a write. */
export const minimizeVaultDocuments = (docs) => {
  if (!Array.isArray(docs)) return docs;
  let changed = false;
  const next = docs.map((doc) => {
    if (!doc || typeof doc.number !== 'string') return doc;
    const number = minimizeDocumentNumber(doc.number);
    if (number === doc.number) return doc;
    changed = true;
    return { ...doc, number };
  });
  return changed ? next : docs;
};

export const minimizeAppointments = (appointments) => {
  if (!Array.isArray(appointments)) return appointments;
  let changed = false;
  const next = appointments.map((apt) => {
    if (!apt || typeof apt.contactNumber !== 'string') return apt;
    const contactNumber = minimizePhoneNumber(apt.contactNumber);
    if (contactNumber === apt.contactNumber) return apt;
    changed = true;
    return { ...apt, contactNumber };
  });
  return changed ? next : appointments;
};
