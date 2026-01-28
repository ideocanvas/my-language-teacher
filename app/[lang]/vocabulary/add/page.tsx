"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { useSettings } from "@/hooks/use-settings";
import { WordSuggestion } from "@/lib/vocabulary-types";
import {
  Volume2,
  Sparkles,
  BookOpen,
  ArrowRight,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export default function TranslatePage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState("en");
  const router = useRouter();
  const { addWord, vocabulary } = useVocabulary();
  const { settings } = useSettings();

  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [translating, setTranslating] = useState(false);
  const [wordSuggestions, setWordSuggestions] = useState<WordSuggestion[]>([]);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
    };
    loadParams();
  }, [params]);

  const speakText = async (text: string, langCode: string) => {
    try {
      const { speakText } = await import("@/lib/tts-utils");
      await speakText(text, langCode === "zh" ? "zh-CN" : "en-US");
    } catch (err) {
      console.error("Failed to speak text:", err);
    }
  };

  // Normalize text for consistent storage and duplicate detection
  const normalizeText = (text: string): string => {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast.error("Please enter text to translate");
      return;
    }

    // Normalize the input text
    const normalizedInput = normalizeText(sourceText);

    // Check if already exists (using normalized comparison)
    const exists = vocabulary.some(
      (v) => normalizeText(v.word) === normalizedInput
    );

    if (exists) {
      toast.info("This word is already in your vocabulary");
      return;
    }

    setTranslating(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sourceText.trim(),
          sourceLanguage: lang === "zh" ? "zh-CN" : "en",
          targetLanguage: settings.targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Translation failed");
      }

      const data = await response.json();
      setTargetText(data.translatedText);

      // Check if this is a sentence (contains spaces or is long)
      const isSentence = sourceText.trim().includes(" ") || sourceText.trim().length > 50;

      // Handle word suggestions from sentence translation
      if (isSentence) {
        // For sentences, show word suggestions but don't auto-save the sentence
        if (data.wordSuggestions && Array.isArray(data.wordSuggestions) && data.wordSuggestions.length > 0) {
          setWordSuggestions(data.wordSuggestions);
          setSavedWords(new Set());
          toast.success(`Found ${data.wordSuggestions.length} words to learn!`);
        } else {
          // No word suggestions extracted, just show the translation
          setWordSuggestions([]);
          toast.success("Sentence translated!");
        }
      } else {
        // Single word translation - auto-save
        await addWord({
          word: sourceText.trim(),
          translation: data.translatedText.trim(),
          pronunciation: data.pronunciation || undefined,
          partOfSpeech: data.partOfSpeech || undefined,
          definitions: [],
          exampleSentences: [],
          tags: data.tags && Array.isArray(data.tags) ? data.tags : [],
          notes: data.notes || undefined,
          difficulty: data.difficulty || 3,
        });

        toast.success("Translation saved to vocabulary!");
        setWordSuggestions([]);
      }
    } catch (err) {
      console.error("Translation failed:", err);
      toast.error("Translation failed. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  const saveSuggestedWord = async (suggestion: WordSuggestion) => {
    try {
      await addWord({
        word: suggestion.word,
        translation: suggestion.translation,
        pronunciation: suggestion.pronunciation,
        partOfSpeech: suggestion.partOfSpeech,
        definitions: [],
        exampleSentences: [],
        tags: suggestion.tags,
        notes: suggestion.notes,
        difficulty: suggestion.difficulty,
      });

      setSavedWords((prev) => new Set(prev).add(suggestion.word));
      toast.success(`"${suggestion.word}" saved!`);
    } catch (err) {
      console.error("Failed to save word:", err);
      toast.error("Failed to save word");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const getLanguageName = (code: string) => {
    const names: Record<string, string> = {
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
    };
    return names[code] || code;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Translation Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          {/* Language Bar */}
          <div className="relative flex items-center justify-center px-6 py-3 bg-gray-50 border-b">
            <span className="absolute left-6 text-sm font-medium text-gray-700">
              {getLanguageName(settings.sourceLanguage)}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="absolute right-6 text-sm font-medium text-gray-700">
              {getLanguageName(settings.targetLanguage)}
            </span>
          </div>

          {/* Translation Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Source Text */}
            <div className="border-r border-gray-200">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter text to translate..."
                rows={8}
                className="w-full px-6 py-4 resize-none focus:outline-none text-lg"
              />
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
                <span className="text-sm text-gray-500">
                  {sourceText.length} characters
                </span>
                {sourceText && (
                  <button
                    onClick={() => speakText(sourceText, settings.sourceLanguage)}
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Target Text */}
            <div>
              <textarea
                value={targetText}
                readOnly
                placeholder="Translation will appear here..."
                rows={8}
                className="w-full px-6 py-4 resize-none focus:outline-none text-lg bg-gray-50"
              />
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
                <span className="text-sm text-gray-500">
                  {targetText.length} characters
                </span>
                {targetText && (
                  <button
                    onClick={() => speakText(targetText, settings.targetLanguage)}
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Translate Button */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <button
              onClick={handleTranslate}
              disabled={translating || !sourceText.trim()}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <ArrowRight className="w-5 h-5" />
              <span>{translating ? "Translating..." : "Translate"}</span>
            </button>
          </div>
        </div>

        {/* Word Suggestions from Sentence Translation */}
        {wordSuggestions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Words to Learn from This Sentence</span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Click the + button to save words to your vocabulary
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {wordSuggestions.map((suggestion) => {
                  const isSaved = savedWords.has(suggestion.word);
                  return (
                    <div
                      key={suggestion.word}
                      className={`border rounded-lg p-4 transition-colors ${
                        isSaved
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-bold text-gray-900">{suggestion.word}</span>
                            <button
                              onClick={() => speakText(suggestion.word, settings.sourceLanguage)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Listen"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            {suggestion.pronunciation && (
                              <span className="text-gray-500 text-sm font-mono">
                                /{suggestion.pronunciation}/
                              </span>
                            )}
                            {suggestion.partOfSpeech && (
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                {suggestion.partOfSpeech}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700">{suggestion.translation}</p>
                          {suggestion.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {suggestion.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {suggestion.notes && (
                            <p className="text-sm text-gray-500 mt-2 italic">{suggestion.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => saveSuggestedWord(suggestion)}
                          disabled={isSaved}
                          className={`ml-3 p-2 rounded-lg transition-colors ${
                            isSaved
                              ? "bg-green-100 text-green-600 cursor-default"
                              : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                          }`}
                          title={isSaved ? "Saved" : "Save to vocabulary"}
                        >
                          {isSaved ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">View Vocabulary</h3>
                <p className="text-sm text-gray-600">
                  {vocabulary.length} word{vocabulary.length === 1 ? "" : "s"} saved
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push(`/${lang}/quiz`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Take a Quiz</h3>
                <p className="text-sm text-gray-600">Practice what you've learned</p>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
