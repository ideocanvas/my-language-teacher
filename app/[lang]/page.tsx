"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { useVocabulary } from "@/hooks/use-vocabulary";
import {
  BookOpen,
  Brain,
  Clock,
  TrendingUp,
  ArrowRight,
  Volume2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState("en");
  const router = useRouter();
  const { vocabulary, dailyReview, loading } = useVocabulary();

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
    };
    loadParams();
  }, [params]);

  const speakWord = async (word: string) => {
    try {
      const { speakText } = await import("@/lib/tts-utils");
      await speakText(word, lang === "zh" ? "zh-CN" : "en-US");
    } catch (err) {
      console.error("Failed to speak word:", err);
      toast.error("Failed to play pronunciation");
    }
  };

  const handleStartReview = () => {
    if (!dailyReview || dailyReview.dueWords.length === 0) {
      toast.info("No words due for review!");
      return;
    }
    router.push(`/${lang}/quiz/flashcard`);
  };

  const renderDailyReviewContent = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      );
    }

    if (dailyReview && dailyReview.dueWords.length > 0) {
      return (
        <div>
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${dailyReview.progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {dailyReview.dueWords.length} words remaining for today
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleStartReview}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Brain className="w-5 h-5" />
              <span>Start Review</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">All caught up!</p>
        <p className="text-sm text-gray-500 mt-1">
          No words due for review right now
        </p>
      </div>
    );
  };

  const renderRecentWordsContent = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      );
    }

    if (vocabulary.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p>No words yet. Add your first word to get started!</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {vocabulary.slice(0, 5).map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900">{entry.word}</span>
                <button
                  onClick={() => speakWord(entry.word)}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-600">{entry.translation}</p>
            </div>
            <button
              onClick={() => router.push(`/${lang}/vocabulary/${entry.id}`)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View
            </button>
          </div>
        ))}
        {vocabulary.length > 5 && (
          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2"
          >
            View all {vocabulary.length} words →
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h1>
          <p className="text-gray-600">
            Continue your learning journey. You have {vocabulary.length} words in your vocabulary.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Words</p>
                <p className="text-2xl font-bold text-gray-900">{vocabulary.length}</p>
              </div>
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Due for Review</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : dailyReview?.dueCount || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Today's Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : `${dailyReview?.progress.toFixed(0)}%`}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Review Goal</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : dailyReview?.reviewGoal || 20}
                </p>
              </div>
              <Brain className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Daily Review Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Daily Review</h2>
            {dailyReview?.dueCount && dailyReview.dueCount > 0 && (
              <span className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full">
                {dailyReview.dueCount} words due
              </span>
            )}
          </div>

          {renderDailyReviewContent()}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => router.push(`/${lang}/vocabulary/add`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Add New Word</h3>
                <p className="text-sm text-gray-600">Learn a new vocabulary word</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </button>

          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Browse Vocabulary</h3>
                <p className="text-sm text-gray-600">View all your words</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </button>

          <button
            onClick={() => router.push(`/${lang}/quiz`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Take a Quiz</h3>
                <p className="text-sm text-gray-600">Test your knowledge</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </button>
        </div>

        {/* Recent Words */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Words</h2>
          {renderRecentWordsContent()}
        </div>
      </main>
    </div>
  );
}