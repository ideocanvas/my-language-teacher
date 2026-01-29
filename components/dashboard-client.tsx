"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { getTranslations, type Locale } from "@/lib/client-i18n";
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

interface DashboardClientProps {
  readonly lang: Locale;
}

export function DashboardClient({ lang }: DashboardClientProps) {
  const router = useRouter();
  const { vocabulary, dailyReview, loading } = useVocabulary();
  
  const t = useMemo(() => getTranslations(lang), [lang]);

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
          <p className="text-gray-600">{t('common.loading')}</p>
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
              {t('dashboard.wordsRemaining', { count: dailyReview.dueWords.length })}
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleStartReview}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Brain className="w-5 h-5" />
              <span>{t('dashboard.startReview')}</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">{t('dashboard.allCaughtUp')}</p>
        <p className="text-sm text-gray-500 mt-1">
          {t('dashboard.noWordsDue')}
        </p>
      </div>
    );
  };

  const renderRecentWordsContent = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      );
    }

    if (vocabulary.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p>{t('dashboard.noWordsYet')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 sm:space-y-3">
        {vocabulary.slice(0, 5).map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{entry.word}</span>
                <button
                  onClick={() => speakWord(entry.word)}
                  className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 truncate">{entry.translation}</p>
            </div>
            <button
              onClick={() => router.push(`/${lang}/vocabulary/${entry.id}`)}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium flex-shrink-0 ml-2"
            >
              {t('dashboard.view')}
            </button>
          </div>
        ))}
        {vocabulary.length > 5 && (
          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="w-full text-center text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium py-2"
          >
            {t('dashboard.viewAll', { count: vocabulary.length })}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {t('dashboard.welcomeBack')}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {t('dashboard.continueJourney', { count: vocabulary.length })}
            </p>
          </div>
          <LanguageSwitcher currentLocale={lang} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{t('dashboard.totalWords')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{vocabulary.length}</p>
              </div>
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{t('dashboard.dueForReview')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {loading ? "..." : dailyReview?.dueCount || 0}
                </p>
              </div>
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{t('dashboard.todaysProgress')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {loading ? "..." : `${dailyReview?.progress.toFixed(0)}%`}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{t('dashboard.reviewGoal')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {loading ? "..." : dailyReview?.reviewGoal || 20}
                </p>
              </div>
              <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Daily Review Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">{t('dashboard.dailyReview')}</h2>
            {dailyReview?.dueCount && dailyReview.dueCount > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs sm:text-sm font-medium px-3 py-1 rounded-full w-fit">
                {t('dashboard.wordsDue', { count: dailyReview.dueCount })}
              </span>
            )}
          </div>

          {renderDailyReviewContent()}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-8">
          <button
            onClick={() => router.push(`/${lang}/vocabulary/add`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t('dashboard.addNewWord')}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{t('dashboard.learnNewWord')}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-2" />
            </div>
          </button>

          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t('dashboard.browseVocabulary')}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{t('dashboard.viewAllWords')}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-2" />
            </div>
          </button>

          <button
            onClick={() => router.push(`/${lang}/quiz`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t('dashboard.takeQuiz')}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{t('dashboard.testKnowledge')}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-2" />
            </div>
          </button>
        </div>

        {/* Recent Words */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">{t('dashboard.recentWords')}</h2>
          {renderRecentWordsContent()}
        </div>
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
