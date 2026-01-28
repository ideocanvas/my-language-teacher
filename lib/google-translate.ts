import { GoogleTranslateResponse } from "./vocabulary-types";

/**
 * Google Translate API Client
 */

export interface TranslateOptions {
  source?: string;
  target: string;
  format?: "text" | "html";
}

export interface DetectedLanguage {
  language: string;
  confidence: number;
}

export async function translateText(
  text: string,
  apiKey: string,
  options: TranslateOptions
): Promise<string> {
  if (!apiKey) {
    throw new Error("Google Translate API key is required");
  }

  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.append("key", apiKey);
  url.searchParams.append("q", text);
  url.searchParams.append("target", options.target);
  if (options.source) {
    url.searchParams.append("source", options.source);
  }
  if (options.format) {
    url.searchParams.append("format", options.format);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Translation failed: ${response.statusText}`
    );
  }

  const data: GoogleTranslateResponse = await response.json();

  if (data.data?.translations?.[0]?.translatedText) {
    return data.data.translations[0].translatedText;
  }

  throw new Error("Invalid response from translation API");
}

export async function detectLanguage(
  text: string,
  apiKey: string
): Promise<DetectedLanguage> {
  if (!apiKey) {
    throw new Error("Google Translate API key is required");
  }

  const url = new URL("https://translation.googleapis.com/language/translate/v2/detect");
  url.searchParams.append("key", apiKey);
  url.searchParams.append("q", text);

  const response = await fetch(url.toString(), {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Language detection failed: ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.data?.detections?.[0]?.[0]) {
    return {
      language: data.data.detections[0][0].language,
      confidence: data.data.detections[0][0].confidence,
    };
  }

  throw new Error("Invalid response from language detection API");
}

export async function getSupportedLanguages(
  apiKey: string,
  target?: string
): Promise<Array<{ language: string; name?: string }>> {
  if (!apiKey) {
    throw new Error("Google Translate API key is required");
  }

  const url = new URL("https://translation.googleapis.com/language/translate/v2/languages");
  url.searchParams.append("key", apiKey);
  if (target) {
    url.searchParams.append("target", target);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to get languages: ${response.statusText}`
    );
  }

  const data = await response.json();

  return data.data?.languages || [];
}

// Language code mappings
export const LANGUAGE_CODES = {
  en: "English",
  zh: "Chinese (Simplified)",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  tr: "Turkish",
  uk: "Ukrainian",
  cs: "Czech",
  el: "Greek",
  he: "Hebrew",
  ro: "Romanian",
  hu: "Hungarian",
  bg: "Bulgarian",
} as const;

export type LanguageCode = keyof typeof LANGUAGE_CODES;

export function getLanguageName(code: string): string {
  return LANGUAGE_CODES[code as LanguageCode] || code;
}