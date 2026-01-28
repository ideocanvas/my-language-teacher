"use client";

import { AppNavigation } from "@/components/app-navigation";
import { useSettings } from "@/hooks/use-settings";
import { createLLMClient } from "@/lib/llm-client";
import { ChatMessage } from "@/lib/vocabulary-types";
import {
    Book,
    GitCompare,
    MessageSquare,
    Mic,
    Send,
    Settings as SettingsIcon,
    Sparkles,
    Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AIFeature = "chat" | "sentences" | "compare" | "pronunciation";

export default function AIAssistantPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState("en");
  const router = useRouter();
  const { settings } = useSettings();

  const [activeFeature, setActiveFeature] = useState<AIFeature>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Feature-specific states
  const [wordInput, setWordInput] = useState("");
  const [translationInput, setTranslationInput] = useState("");
  const [compareWords, setCompareWords] = useState<string[]>([]);
  const [compareWordInput, setCompareWordInput] = useState("");

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
    };
    loadParams();
  }, [params]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    if (!settings.llmApiKey || !settings.llmApiUrl) {
      toast.error("Please configure your LLM API settings first");
      router.push(`/${lang}/settings`);
      return;
    }

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
      const client = createLLMClient({
        baseUrl: settings.llmApiUrl,
        apiKey: settings.llmApiKey,
        model: settings.llmModel,
      });

      const response = await client.continueConversation(messages, `You are a helpful language learning assistant. Help the user practice and learn ${lang === "zh" ? "Chinese" : "English"}. Be patient, encouraging, and provide corrections when needed.`);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to get response from AI");
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    toast.info("Chat cleared");
  };

  const handleGenerateSentences = async () => {
    if (!wordInput.trim() || !translationInput.trim()) {
      toast.error("Please enter both word and translation");
      return;
    }

    if (!settings.llmApiKey || !settings.llmApiUrl) {
      toast.error("Please configure your LLM API settings first");
      router.push(`/${lang}/settings`);
      return;
    }

    setLoading(true);
    try {
      const client = createLLMClient({
        baseUrl: settings.llmApiUrl,
        apiKey: settings.llmApiKey,
        model: settings.llmModel,
      });

      const response = await client.generateExampleSentences(
        wordInput,
        translationInput,
        2
      );

      if (response.sentences.length > 0) {
        const result = response.sentences
          .map((s) => `"${s.sentence}" - ${s.translation}`)
          .join("\n\n");

        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Here are example sentences for "${wordInput}":\n\n${result}`,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        toast.success(`Generated ${response.sentences.length} sentences`);
      }
    } catch (err) {
      console.error("Failed to generate sentences:", err);
      toast.error("Failed to generate sentences");
    } finally {
      setLoading(false);
    }
  };

  const handleCompareWords = async () => {
    if (compareWords.length < 2) {
      toast.error("Please add at least 2 words to compare");
      return;
    }

    if (!settings.llmApiKey || !settings.llmApiUrl) {
      toast.error("Please configure your LLM API settings first");
      router.push(`/${lang}/settings`);
      return;
    }

    setLoading(true);
    try {
      const client = createLLMClient({
        baseUrl: settings.llmApiUrl,
        apiKey: settings.llmApiKey,
        model: settings.llmModel,
      });

      const response = await client.compareWords(compareWords);

      const result = [
        response.differences.length > 0 && `**Differences:**\n${response.differences.join("\n")}`,
        response.examples.length > 0 && `\n**Examples:**\n${response.examples.join("\n")}`,
        response.recommendations.length > 0 && `\n**When to use:**\n${response.recommendations.join("\n")}`,
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
      toast.success("Comparison complete");
    } catch (err) {
      console.error("Failed to compare words:", err);
      toast.error("Failed to compare words");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompareWord = () => {
    const word = compareWordInput.trim();
    if (word && !compareWords.includes(word)) {
      setCompareWords([...compareWords, word]);
      setCompareWordInput("");
    }
  };

  const handleRemoveCompareWord = (word: string) => {
    setCompareWords(compareWords.filter((w) => w !== word));
  };

  const features = [
    { id: "chat" as AIFeature, icon: MessageSquare, label: "Conversation", color: "bg-purple-600" },
    { id: "sentences" as AIFeature, icon: Book, label: "Example Sentences", color: "bg-blue-600" },
    { id: "compare" as AIFeature, icon: GitCompare, label: "Compare Words", color: "bg-green-600" },
    { id: "pronunciation" as AIFeature, icon: Mic, label: "Pronunciation Help", color: "bg-pink-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Assistant</h1>
          <p className="text-gray-600">
            Practice your language skills with AI-powered features
          </p>
        </div>

        {/* Feature Tabs */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
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
                    Start a conversation
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Chat with the AI to practice your language skills
                  </p>
                  {!settings.llmApiKey || !settings.llmApiUrl ? (
                    <button
                      onClick={() => router.push(`/${lang}/settings`)}
                      className="text-blue-600 hover:text-blue-700 font-medium flex items-center"
                    >
                      Configure API settings <SettingsIcon className="w-4 h-4 ml-1" />
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Type a message below to get started
                    </p>
                  )}
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
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                    title="Clear chat"
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
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Example Sentences Feature */}
        {activeFeature === "sentences" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Generate Example Sentences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="word-input" className="block text-sm font-medium text-gray-700 mb-2">
                    Word
                  </label>
                  <input
                    id="word-input"
                    type="text"
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    placeholder="e.g., hello"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="translation-input" className="block text-sm font-medium text-gray-700 mb-2">
                    Translation
                  </label>
                  <input
                    id="translation-input"
                    type="text"
                    value={translationInput}
                    onChange={(e) => setTranslationInput(e.target.value)}
                    placeholder="e.g., 你好"
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
                <span>{loading ? "Generating..." : "Generate Sentences"}</span>
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
              <h3 className="font-semibold text-gray-900 mb-4">Compare Similar Words</h3>
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={compareWordInput}
                  onChange={(e) => setCompareWordInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddCompareWord()}
                  placeholder="Add a word to compare..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAddCompareWord}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Word tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {compareWords.map((word) => (
                  <span
                    key={word}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1"
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => handleRemoveCompareWord(word)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <button
                onClick={handleCompareWords}
                disabled={loading || compareWords.length < 2}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <GitCompare className="w-5 h-5" />
                <span>{loading ? "Comparing..." : "Compare Words"}</span>
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

        {/* Pronunciation Help Feature */}
        {activeFeature === "pronunciation" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Pronunciation Help
            </h3>
            <p className="text-gray-600 mb-4">
              Get AI-powered help with word pronunciation
            </p>
            <p className="text-sm text-gray-500">
              This feature will be available in future updates
            </p>
          </div>
        )}
      </main>
    </div>
  );
}