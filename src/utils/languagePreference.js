// Language list and saved-choice helpers. Kept free of React so the
// persistence rules can be unit tested.
import { logDiagnostic } from './diagnostics';

export const LANGUAGE_KEY = 'civicbridge_lang';
export const SOURCE_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', badge: 'EN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', badge: 'हि' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', badge: 'বা' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', badge: 'த' },
];

export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export const normalizeLanguage = (code) => (LANGUAGE_CODES.includes(code) ? code : SOURCE_LANGUAGE);

export const loadLanguage = () => {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return SOURCE_LANGUAGE;
  }
};

// Returns the language that was applied, even when storage is blocked.
export const saveLanguage = (code) => {
  const valid = normalizeLanguage(code);
  try {
    localStorage.setItem(LANGUAGE_KEY, valid);
  } catch (err) {
    logDiagnostic('Failed to save language preference', err);
  }
  return valid;
};
