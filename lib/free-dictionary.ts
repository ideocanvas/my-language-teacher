/**
 * Free Dictionary API Client
 * API: https://dictionaryapi.dev/
 * No API key required, completely free
 */

export interface DictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: {
    name: string;
    url: string;
  };
}

export interface DictionaryDefinition {
  definition: string;
  synonyms: string[];
  antonyms: string[];
  example?: string;
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: DictionaryPhonetic[];
  meanings: DictionaryMeaning[];
  license?: {
    name: string;
    url: string;
  };
  sourceUrls: string[];
}

export interface DictionaryData {
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definitions: string[];
  examples: string[];
  synonyms: string[];
  antonyms: string[];
}

/**
 * Fetch word data from Free Dictionary API
 * @param word - The word to look up
 * @param language - Language code (en, es, fr, de, it, pt, ru)
 */
export async function fetchDictionaryData(
  word: string,
  language: string = "en"
): Promise<DictionaryData | null> {
  try {
    const langCode = mapLanguageCode(language);
    const url = `https://api.dictionaryapi.dev/api/v2/entries/${langCode}/${encodeURIComponent(word)}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Word "${word}" not found in dictionary`);
        return null;
      }
      throw new Error(`Dictionary API error: ${response.statusText}`);
    }

    const entries: DictionaryEntry[] = await response.json();

    if (!entries || entries.length === 0) {
      return null;
    }

    return parseDictionaryEntry(entries[0]);
  } catch (error) {
    console.error("Failed to fetch dictionary data:", error);
    return null;
  }
}

/**
 * Extract pronunciation from entry
 */
function extractPronunciation(entry: DictionaryEntry): string | undefined {
  if (entry.phonetic) {
    return entry.phonetic;
  }
  if (entry.phonetics && entry.phonetics.length > 0) {
    const phoneticWithText = entry.phonetics.find((p) => p.text);
    return phoneticWithText?.text;
  }
  return undefined;
}

/**
 * Collect definitions and examples from meanings
 */
function collectDefinitionsAndExamples(meanings: DictionaryMeaning[]): {
  definitions: string[];
  examples: string[];
} {
  const definitions: string[] = [];
  const examples: string[] = [];

  for (const meaning of meanings) {
    for (const def of meaning.definitions) {
      definitions.push(def.definition);
      if (def.example) {
        examples.push(def.example);
      }
    }
  }

  return { definitions, examples };
}

/**
 * Collect synonyms and antonyms from meanings
 */
function collectSynonymsAndAntonyms(meanings: DictionaryMeaning[]): {
  synonyms: string[];
  antonyms: string[];
} {
  const synonyms: string[] = [];
  const antonyms: string[] = [];

  for (const meaning of meanings) {
    for (const def of meaning.definitions) {
      synonyms.push(...def.synonyms);
      antonyms.push(...def.antonyms);
    }
    synonyms.push(...meaning.synonyms);
    antonyms.push(...meaning.antonyms);
  }

  return { synonyms, antonyms };
}

/**
 * Parse dictionary entry into simplified format
 */
function parseDictionaryEntry(entry: DictionaryEntry): DictionaryData {
  const data: DictionaryData = {
    word: entry.word,
    definitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
  };

  data.pronunciation = extractPronunciation(entry);

  if (entry.meanings && entry.meanings.length > 0) {
    data.partOfSpeech = entry.meanings[0].partOfSpeech;

    const { definitions, examples } = collectDefinitionsAndExamples(entry.meanings);
    const { synonyms, antonyms } = collectSynonymsAndAntonyms(entry.meanings);

    data.definitions = [...new Set(definitions)];
    data.examples = [...new Set(examples)];
    data.synonyms = [...new Set(synonyms)].slice(0, 10);
    data.antonyms = [...new Set(antonyms)].slice(0, 10);
  }

  return data;
}

/**
 * Map language codes to Free Dictionary API format
 */
function mapLanguageCode(lang: string): string {
  const mapping: Record<string, string> = {
    en: "en",
    "en-US": "en",
    "en-GB": "en",
    es: "es",
    "es-ES": "es",
    fr: "fr",
    de: "de",
    it: "it",
    pt: "pt",
    ru: "ru",
  };

  return mapping[lang] || "en";
}

/**
 * Check if a language is supported by Free Dictionary API
 */
export function isDictionarySupported(lang: string): boolean {
  const supportedLanguages = ["en", "en-US", "en-GB", "es", "es-ES", "fr", "de", "it", "pt", "ru"];
  return supportedLanguages.includes(lang);
}

/**
 * Format dictionary data for LLM context
 */
export function formatDictionaryForLLM(data: DictionaryData | null): string {
  if (!data) {
    return "";
  }

  let context = `Dictionary data for "${data.word}":\n`;

  if (data.pronunciation) {
    context += `Pronunciation (IPA): ${data.pronunciation}\n`;
  }

  if (data.partOfSpeech) {
    context += `Part of Speech: ${data.partOfSpeech}\n`;
  }

  if (data.definitions.length > 0) {
    const formattedDefinitions = data.definitions
      .slice(0, 3)
      .map((d, i) => String(i + 1) + ". " + d)
      .join("\n");
    context += "Definitions:\n" + formattedDefinitions + "\n";
  }

  if (data.examples.length > 0) {
    const formattedExamples = data.examples
      .slice(0, 2)
      .map((e, i) => String(i + 1) + ". " + e)
      .join("\n");
    context += "Examples:\n" + formattedExamples + "\n";
  }

  if (data.synonyms.length > 0) {
    context += `Synonyms: ${data.synonyms.slice(0, 5).join(", ")}\n`;
  }

  return context.trim();
}
