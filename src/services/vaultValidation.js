import { minimizeDocumentNumber } from './dataMinimization';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 120;
export const MAX_TEXT_LENGTH = 100;
export const MAX_NOTES_LENGTH = 300;

export const ALLOWED_FILE_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
};

export const ALLOWED_TYPES_HINT = 'PDF, JPG or PNG, up to 5 MB';

const getExtension = (name = '') => {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
};

export const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * Check a picked file. Returns { valid, error }.
 * The picker's accept attribute is only a hint, so type, size and
 * extension are checked here.
 */
export const validateFile = (file) => {
  if (!file) return { valid: false, error: 'Please choose a file.' };
  if (!file.size) return { valid: false, error: 'This file is empty. Choose a file with content.' };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File is too large (${formatFileSize(file.size)}). Maximum is 5 MB.` };
  }
  if ((file.name || '').length > MAX_FILE_NAME_LENGTH) {
    return { valid: false, error: `File name is too long. Keep it under ${MAX_FILE_NAME_LENGTH} characters.` };
  }
  const extensions = ALLOWED_FILE_TYPES[file.type];
  if (!extensions) {
    return { valid: false, error: 'Unsupported file type. Only PDF, JPG and PNG files are allowed.' };
  }
  if (!extensions.includes(getExtension(file.name))) {
    return { valid: false, error: 'The file extension does not match its content type.' };
  }
  return { valid: true, error: '' };
};

const normalise = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '');

/**
 * True if another saved document looks like the same one. Stored numbers keep only their last four
 * characters (#212), so two different Aadhaar/PAN numbers can share them. When the number was cut
 * down, issuer and expiry date must match as well, otherwise the user could not save a legitimate
 * second document. Numbers of four characters or fewer are stored whole and match on their own.
 */
export const isDuplicateDocument = (form, existingDocs = []) => {
  const type = normalise(form.type);
  const number = normalise(minimizeDocumentNumber(form.number));
  if (!type || !number) return false;
  const truncated = number.startsWith('xxxx');
  return existingDocs.some((d) => {
    if (d.id === form.id || normalise(d.type) !== type) return false;
    if (normalise(minimizeDocumentNumber(d.number)) !== number) return false;
    if (!truncated) return true;
    return normalise(d.issuer) === normalise(form.issuer) && String(d.expiryDate || '') === String(form.expiryDate || '');
  });
};

/** Validate the Add Document form. Returns { valid, errors } keyed by field. */
export const validateDocumentForm = (form, existingDocs = []) => {
  const errors = {};
  const type = (form.type || '').trim();
  const number = (form.number || '').trim();

  if (!type) errors.type = 'Document type is required (e.g. Passport, Voter ID).';
  else if (type.length > MAX_TEXT_LENGTH) errors.type = `Keep this under ${MAX_TEXT_LENGTH} characters.`;

  if (!number) errors.number = 'Document number or identifier is required.';
  else if (number.length > MAX_TEXT_LENGTH) errors.number = `Keep this under ${MAX_TEXT_LENGTH} characters.`;

  if ((form.issuer || '').trim().length > MAX_TEXT_LENGTH) {
    errors.issuer = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
  }
  if ((form.notes || '').length > MAX_NOTES_LENGTH) {
    errors.notes = `Keep notes under ${MAX_NOTES_LENGTH} characters.`;
  }
  if (form.expiryDate && Number.isNaN(new Date(form.expiryDate).getTime())) {
    errors.expiryDate = 'Enter a valid expiry date.';
  }
  if (!errors.type && !errors.number && isDuplicateDocument(form, existingDocs)) {
    errors.number = 'A document with this type and number is already in your vault.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/** Minimal shape check for records read from an imported backup. */
export const isValidVaultRecord = (rec) =>
  Boolean(
    rec &&
      typeof rec === 'object' &&
      !Array.isArray(rec) &&
      typeof rec.id === 'string' &&
      rec.id &&
      typeof rec.type === 'string' &&
      rec.type.trim() &&
      typeof rec.number === 'string' &&
      rec.number.trim()
  );

/** Label for a document's verification state. Verified is self-declared. */
export const getVerificationLabel = (doc) =>
  doc && doc.verified ? 'Self-declared verified' : 'Not verified';
