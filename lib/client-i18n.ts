// Client-side i18n utilities
import enTranslations from '../locales/en/common.json';
import zhTranslations from '../locales/zh/common.json';

export type Locale = 'en' | 'zh';

const translations = {
  en: enTranslations,
  zh: zhTranslations,
};

// Helper function to get nested value from translations object
const getNestedValue = (keys: string[], translationSet: Record<string, unknown>): unknown => {
  let value: unknown = translationSet;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  
  return value;
};

export const getTranslations = (locale: Locale): (key: string, params?: Record<string, string | number>) => string => {
  const t = (key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    
    // Try to get value from current locale
    let value = getNestedValue(keys, translations[locale] as Record<string, unknown>);
    
    // Fallback to English if translation not found
    if (value === undefined) {
      value = getNestedValue(keys, translations.en as Record<string, unknown>);
    }
    
    // Return key if translation not found
    if (value === undefined) {
      return key;
    }
    
    if (typeof value === 'string' && params) {
      return value.replaceAll(/\{\{(\w+)\}\}/g, (match: string, param: string) => {
        return params[param]?.toString() || match;
      });
    }
    
    return typeof value === 'string' ? value : key;
  };
  
  return t;
}

export const locales: Locale[] = ['en', 'zh'];
export const defaultLocale: Locale = 'en';