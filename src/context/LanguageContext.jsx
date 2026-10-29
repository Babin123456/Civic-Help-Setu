/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DICTIONARIES } from '../utils/translationCoverage';
import { SUPPORTED_LANGUAGES, loadLanguage, saveLanguage } from '../utils/languagePreference';
import { logDiagnostic } from '../utils/diagnostics';

const en = DICTIONARIES.en;
const LanguageContext = createContext(null);
const PLAIN_LANG_KEY = 'civicbridge_plain_lang';

export { SUPPORTED_LANGUAGES };

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(loadLanguage);

  const [isPlainLanguage, setIsPlainLanguage] = useState(() => {
    try {
      return localStorage.getItem(PLAIN_LANG_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const setLanguage = useCallback((lang) => {
    setLanguageState(saveLanguage(lang));
  }, []);

  const togglePlainLanguage = useCallback(() => {
    setIsPlainLanguage((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PLAIN_LANG_KEY, String(next));
      } catch (err) {
        logDiagnostic('Failed to save plain language preference', err);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (path, fallback = '') => {
      const dict = DICTIONARIES[language] || en;
      const keys = path.split('.');
      let current = dict;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback order is documented in utils/translationCoverage.js
          let enCurrent = en;
          for (const enK of keys) {
            if (enCurrent && typeof enCurrent === 'object' && enK in enCurrent) {
              enCurrent = enCurrent[enK];
            } else {
              return fallback || path;
            }
          }
          return typeof enCurrent === 'string' ? enCurrent : fallback || path;
        }
      }

      return typeof current === 'string' ? current : fallback || path;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isPlainLanguage,
        togglePlainLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};
