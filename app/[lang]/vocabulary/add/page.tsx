"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { useSettings } from "@/hooks/use-settings";
import {
  Volume2,
  Sparkles,
  BookOpen,
  X,
  Save,
  ArrowRight,
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
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);

  // Save panel state
  const [pronunciation, setPronunciation] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [exampleSentences, setExampleSentences] = useState<string[]>([]);

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

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast.error("Please enter text to translate");
      return;
    }

    if (!settings.googleTranslateApiKey) {
      toast.error("Google Translate API key is required");
      return;
    }

    setTranslating(true);
    try {
      const { translateText } = await import("@/lib/google-translate");
      const result = await translateText(
        sourceText,
        settings.googleTranslateApiKey,
        {
          source: lang === "zh" ? "zh-CN" : "en",
          target: settings.targetLanguage,
        }
      );
      setTargetText(result);
      setShowSavePanel(true);
    } catch (err) {
      console.error("Translation failed:", err);
      toast.error("Translation failed. Please check your API key.");
    } finally {
      setTranslating(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!sourceText.trim() || !targetText.trim()) {
      toast.error("Please translate first to generate example sentences");
      return;
    }

    if (!settings.llmApiKey || !settings.llmApiUrl) {
      toast.error("LLM API key and URL are required");
      return;
    }

    setGeneratingAI(true);
    try {
      const { createLLMClient } = await import("@/lib/llm-client");
      const client = createLLMClient({
        baseUrl: settings.llmApiUrl,
        apiKey: settings.llmApiKey,
        model: settings.llmModel,
      });

      let sentenceDifficulty: 1 | 2 | 3;
      if (difficulty <= 2) {
        sentenceDifficulty = 1;
      } else if (difficulty <= 4) {
        sentenceDifficulty = 2;
      } else {
        sentenceDifficulty = 3;
      }
      const response = await client.generateExampleSentences(
        sourceText,
        targetText,
        sentenceDifficulty
      );

      const newSentences = response.sentences.map((s) => s.sentence);
      setExampleSentences((prev) => [...prev, ...newSentences]);
      toast.success(`Generated ${newSentences.length} example sentences`);
    } catch (err) {
      console.error("AI generation failed:", err);
      toast.error("Failed to generate example sentences");
    } finally {
      setGeneratingAI(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!sourceText.trim() || !targetText.trim()) {
      toast.error("Please translate first");
      return;
    }

    // Check if already exists
    const exists = vocabulary.some(
      (v) => v.word.toLowerCase() === sourceText.toLowerCase().trim()
    );

    if (exists) {
      toast.error("This word is already in your vocabulary");
      return;
    }

    try {
      await addWord({
        word: sourceText.trim(),
        translation: targetText.trim(),
        pronunciation: pronunciation.trim() || undefined,
        partOfSpeech: partOfSpeech.trim() || undefined,
        definitions: [],
        exampleSentences,
        tags,
        notes: notes.trim() || undefined,
        difficulty,
      });

      // Reset form
      setSourceText("");
      setTargetText("");
      setPronunciation("");
      setPartOfSpeech("");
      setNotes("");
      setDifficulty(3);
      setTags([]);
      setExampleSentences([]);
      setShowSavePanel(false);

      toast.success("Word saved successfully!");
    } catch (err) {
      console.error("Failed to save word:", err);
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
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b">
            <span className="text-sm font-medium text-gray-700">
              {getLanguageName(settings.sourceLanguage)}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
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

        {/* Save to Vocabulary Panel */}
        {showSavePanel && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
              <div className="flex items-center space-x-3">
                <Save className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Save to Vocabulary</h3>
              </div>
              <button
                onClick={() => setShowSavePanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Word Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{getLanguageName(settings.sourceLanguage)}</p>
                    <p className="text-xl font-bold text-gray-900">{sourceText}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{getLanguageName(settings.targetLanguage)}</p>
                    <p className="text-xl font-bold text-gray-900">{targetText}</p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pronunciation */}
                <div>
                  <label htmlFor="pronunciation" className="block text-sm font-medium text-gray-700 mb-2">
                    Pronunciation (IPA)
                  </label>
                  <input
                    id="pronunciation"
                    type="text"
                    value={pronunciation}
                    onChange={(e) => setPronunciation(e.target.value)}
                    placeholder="e.g., /həˈləʊ/"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Part of Speech */}
                <div>
                  <label htmlFor="partOfSpeech" className="block text-sm font-medium text-gray-700 mb-2">
                    Part of Speech
                  </label>
                  <select
                    id="partOfSpeech"
                    value={partOfSpeech}
                    onChange={(e) => setPartOfSpeech(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    <option value="noun">Noun</option>
                    <option value="verb">Verb</option>
                    <option value="adjective">Adjective</option>
                    <option value="adverb">Adverb</option>
                    <option value="pronoun">Pronoun</option>
                    <option value="preposition">Preposition</option>
                  </select>
                </div>
              </div>

              {/* Difficulty */}
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-4">
                  Difficulty Level
                </legend>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((level) => {
                    let buttonClass = "bg-gray-100 text-gray-700 hover:bg-gray-200";
                    if (difficulty === level) {
                      if (level <= 2) {
                        buttonClass = "bg-green-600 text-white";
                      } else if (level === 3) {
                        buttonClass = "bg-yellow-500 text-white";
                      } else {
                        buttonClass = "bg-red-600 text-white";
                      }
                    }
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDifficulty(level as 1 | 2 | 3 | 4 | 5)}
                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${buttonClass}`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Tags */}
              <div>
                <label htmlFor="tagInput" className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex space-x-2 mb-3">
                  <input
                    id="tagInput"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add a tag..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* AI Generate Example Sentences */}
              {settings.llmApiKey && settings.llmApiUrl && (
                <div>
                  <button
                    onClick={handleAIGenerate}
                    disabled={generatingAI}
                    className="flex items-center space-x-2 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{generatingAI ? "Generating..." : "AI Generate Example Sentences"}</span>
                  </button>

                  {/* Example Sentences */}
                  {exampleSentences.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {exampleSentences.map((sentence) => (
                        <div
                          key={sentence}
                          className="flex items-start justify-between bg-purple-50 p-3 rounded-lg"
                        >
                          <p className="text-gray-700 italic text-sm">"{sentence}"</p>
                          <button
                            type="button"
                            onClick={() => setExampleSentences(exampleSentences.filter((s) => s !== sentence))}
                            className="text-gray-400 hover:text-purple-600 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Save className="w-5 h-5" />
                <span>Save to Vocabulary</span>
              </button>
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