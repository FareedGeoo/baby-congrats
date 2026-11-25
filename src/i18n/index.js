import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { ar } from './ar.js';
import { en } from './en.js';

const LANGUAGE_KEY = 'baby-congrats-language';
const dictionaries = { en, ar };
const I18nContext = createContext(null);

function getSavedLanguage() {
  const savedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
  return Object.prototype.hasOwnProperty.call(dictionaries, savedLanguage)
    ? savedLanguage
    : 'en';
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(getSavedLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = dictionaries[language].document.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = dictionaries[language].document.description;
    window.localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key, values = {}) => {
      const translation = key.split('.').reduce(
        (valueAtKey, part) => valueAtKey?.[part],
        dictionaries[language],
      );
      if (typeof translation !== 'string') return key;
      return translation.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
    },
  }), [language]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
