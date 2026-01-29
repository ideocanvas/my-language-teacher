// Client-side i18n utilities
import enTranslations from '../locales/en/common.json';
import zhTranslations from '../locales/zh/common.json';

export type Locale = 'en' | 'zh';

const translations = {
  en: enTranslations,
  zh: zhTranslations,
};

export const getTranslations = (locale: Locale): (key: string, params?: Record<string, string | number>) => string => {
  const t = (key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: unknown = translations[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to English if translation not found
        value = translations.en;
        for (const k of keys) {
          if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
            value = (value as Record<string, unknown>)[k];
          } else {
            return key; // Return key if translation not found
          }
        }
        break;
      }
    }
    
    if (typeof value === 'string' && params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param]?.toString() || match;
      });
    }
    
    return typeof value === 'string' ? value : key;
  };
  
  return t;
}

export const locales: Locale[] = ['en', 'zh'];
export const defaultLocale: Locale = 'en';