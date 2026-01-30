"use client";

import { AppNavigation } from "@/components/app-navigation";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { ChatMessage } from "@/lib/vocabulary-types";
import { type Locale, getTranslations } from "@/lib/client-i18n";
import {
    Book,
    GitCompare,
    MessageSquare,
    Mic,
    Send,
    Sparkles,
    Trash2,
    Plus,
    X,
    MessageCircle
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

type AIFeature = "chat" | "sentences" | "compare" | "pronunciation";

interface AIClientProps {
  readonly lang: Locale;
}

export function AIClient({ lang }: AIClientProps) {
  const t = useMemo(() => getTranslations(lang), [lang]);
  const searchParams = useSearchParams();

  const [activeFeature, setActiveFeature] = useState<AIFeature>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Feature-specific states
  const [wordInput, setWordInput] = useState("");
  const [translationInput, setTranslationInput] = useState("");
  const [compareWords, setCompareWords] = useState<string[]>([]);
  const [compareWordInput, setCompareWordInput] = useState("");

  // Parse URL parameters on mount to pre-fill data from vocabulary list
  useEffect(() => {
    const feature = searchParams.get("feature");

    if (feature === "sentences") {
      setActiveFeature("sentences");
      const word = searchParams.get("word") || "";
      const translation = searchParams.get("translation") || "";
      setWordInput(word);
      setTranslationInput(translation);
    } else if (feature === "compare") {
      setActiveFeature("compare");
      const words = searchParams.get("words");
      if (words) {
        const wordList = words.split(",").map(w => w.trim()).filter(w => w.length > 0);
        setCompareWords(wordList);
      }
    }
  }, [searchParams]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          systemPrompt: `You are a helpful language learning assistant. Help the user practice and learn ${lang === "zh" ? "Chinese" : "English"}. Be patient, encouraging, and provide corrections when needed.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("ai.chat.error"));
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error(t("ai.chat.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    toast.info(t("ai.chat.clear"));
  };

  const handleGenerateSentences = async () => {
    if (!wordInput.trim() || !translationInput.trim()) {
      toast.error(t("ai.sentences.validationError"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/ai/sentences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: wordInput,
          translation: translationInput,
          difficulty: 2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("ai.sentences.error"));
      }

      const data = await response.json();

      if (data.sentences.length > 0) {
        const result = data.sentences
          .map((s: { sentence: string; translation: string }) => `"${s.sentence}" - ${s.translation}`)
          .join("\n\n");

        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `${t("ai.sentences.generated", { count: data.sentences.length })} for "${wordInput}":\n\n${result}`,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        toast.success(t("ai.sentences.generated", { count: data.sentences.length }));
      }
    } catch (err) {
      console.error("Failed to generate sentences:", err);
      toast.error(t("ai.sentences.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCompareWords = async () => {
    if (compareWords.length < 2) {
      toast.error(t("ai.compare.validationError"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/ai/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          words: compareWords,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("ai.compare.error"));
      }

      const data = await response.json();

      const result = [
        data.differences.length > 0 && `**Differences:**\n${data.differences.join("\n")}`,
        data.examples.length > 0 && `\n**Examples:**\n${data.examples.join("\n")}`,
        data.recommendations.length > 0 && `\n**When to use:**\n${data.recommendations.join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n");

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: result,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      toast.success(t("ai.compare.complete"));
    } catch (err) {
      console.error("Failed to compare words:", err);
      toast.error(t("ai.compare.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompareWord = () => {
    const word = compareWordInput.trim();
    if (word && !compareWords.includes(word)) {
      setCompareWords([...compareWords, word]);
      setCompareWordInput("");
    } else if (compareWords.includes(word)) {
        toast.error(t("ai.compare.uniqueError"));
    }
  };

  const handleRemoveCompareWord = (word: string) => {
    setCompareWords(compareWords.filter((w) => w !== word));
  };

  const features = [
    { id: "chat" as AIFeature, icon: MessageCircle, label: t("ai.features.chat"), color: "bg-purple-600" },
    { id: "sentences" as AIFeature, icon: Book, label: t("ai.features.sentences"), color: "bg-blue-600" },
    { id: "compare" as AIFeature, icon: GitCompare, label: t("ai.features.compare"), color: "bg-green-600" },
    { id: "pronunciation" as AIFeature, icon: Mic, label: t("ai.features.pronunciation"), color: "bg-pink-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("ai.title")}</h1>
          <p className="text-gray-600">
            {t("ai.description")}
          </p>
        </div>

        {/* Feature Tabs */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isActive = activeFeature === feature.id;
            return (
              <button
                key={feature.id}
                onClick={() => {
                  setActiveFeature(feature.id);
                  setMessages([]);
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? `${feature.color} text-white`
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{feature.label}</span>
              </button>
            );
          })}
        </div>

        {/* Chat Feature */}
        {activeFeature === "chat" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t("ai.chat.emptyTitle")}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {t("ai.chat.emptyDesc")}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t("ai.chat.emptyPrompt")}
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={t("ai.chat.placeholder")}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                    title={t("ai.chat.clear")}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span className="hidden sm:inline">{t("ai.chat.send")}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Example Sentences Feature */}
        {activeFeature === "sentences" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t("ai.sentences.title")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="word-input" className="block text-sm font-medium text-gray-700 mb-2">
                    {t("ai.sentences.wordLabel")}
                  </label>
                  <input
                    id="word-input"
                    type="text"
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    placeholder={t("ai.sentences.wordPlaceholder")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="translation-input" className="block text-sm font-medium text-gray-700 mb-2">
                    {t("ai.sentences.translationLabel")}
                  </label>
                  <input
                    id="translation-input"
                    type="text"
                    value={translationInput}
                    onChange={(e) => setTranslationInput(e.target.value)}
                    placeholder={t("ai.sentences.translationPlaceholder")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={handleGenerateSentences}
                disabled={loading || !wordInput || !translationInput}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-5 h-5" />
                <span>{loading ? t("ai.sentences.generating") : t("ai.sentences.generate")}</span>
              </button>
            </div>

            {/* Results */}
            {messages.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-gray-50 rounded-lg p-4">
                      <p className="whitespace-pre-wrap text-gray-700">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compare Words Feature */}
        {activeFeature === "compare" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t("ai.compare.title")}</h3>
              
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={compareWordInput}
                  onChange={(e) => setCompareWordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompareWord()}
                  placeholder={t("ai.compare.wordPlaceholder")}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAddCompareWord}
                  disabled={!compareWordInput.trim()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>{t("ai.compare.add")}</span>
                </button>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {compareWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                  >
                    {word}
                    <button
                      onClick={() => handleRemoveCompareWord(word)}
                      className="ml-2 focus:outline-none"
                    >
                      <X className="w-4 h-4 hover:text-blue-600" />
                    </button>
                  </span>
                ))}
              </div>

              <button
                onClick={handleCompareWords}
                disabled={loading || compareWords.length < 2}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <GitCompare className="w-5 h-5" />
                <span>{loading ? t("ai.compare.comparing") : t("ai.compare.compareButton")}</span>
              </button>
            </div>

            {/* Results */}
            {messages.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-gray-50 rounded-lg p-4">
                      <p className="whitespace-pre-wrap text-gray-700">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pronunciation Feature */}
        {activeFeature === "pronunciation" && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t("ai.pronunciation.title")}</h3>
            <p className="text-gray-600">{t("ai.pronunciation.comingSoon")}</p>
          </div>
        )}
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
