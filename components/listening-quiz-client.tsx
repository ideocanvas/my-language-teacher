"use client";

import { AppNavigation } from "@/components/app-navigation";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { useQuiz } from "@/hooks/use-quiz";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Check, Home, Volume2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getTranslations, type Locale } from "@/lib/client-i18n";

interface ListeningQuizClientProps {
  lang: Locale;
}

export function ListeningQuizClient({ lang }: Readonly<ListeningQuizClientProps>) {
  const router = useRouter();
  const { vocabulary, reviewWord, dailyReview } = useVocabulary();
  const {
    currentSession,
    loading: quizLoading,
    startQuiz,
    recordResult,
    completeQuiz,
    cancelQuiz,
    getCurrentWordId,
    isComplete,
    getProgress,
  } = useQuiz();

  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!currentSession && dailyReview && dailyReview.dueWords.length > 0) {
      startQuiz("listening", dailyReview.dueWords);
      setStartTime(Date.now());
    }
  }, [currentSession, dailyReview, startQuiz]);

  const currentWordId = getCurrentWordId();
  const currentWord = vocabulary.find((w) => w.id === currentWordId);
  const progress = getProgress();

  const speakWord = async (text: string) => {
    try {
      const { speakText } = await import("@/lib/tts-utils");
      await speakText(text, lang === "zh" ? "zh-CN" : "en-US");
    } catch (err) {
      console.error("Failed to speak word:", err);
    }
  };

  const checkAnswer = useCallback(() => {
    if (!currentWord) return false;
    const normalizedUser = userAnswer.trim().toLowerCase();
    const normalizedCorrect = currentWord.word.trim().toLowerCase();
    return normalizedUser === normalizedCorrect;
  }, [userAnswer, currentWord]);

  // Helper function to get input className
  const getInputClassName = () => {
    if (showResult && isCorrect) {
      return "border-green-500 bg-green-50";
    }
    if (showResult && !isCorrect) {
      return "border-red-500 bg-red-50";
    }
    return "border-gray-200 focus:border-blue-500 focus:outline-none";
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    
    setAttempts((prev) => prev + 1);
    setShowResult(true);
  };

  const handleNext = async () => {
    if (!currentWordId) return;

    const isCorrect = checkAnswer();
    const timeTaken = Date.now() - startTime;

    try {
      await recordResult(currentWordId, isCorrect, attempts + 1, timeTaken);
      
      // Update SRS with rating based on correctness
      const rating = isCorrect ? 3 : 0;
      await reviewWord(currentWordId, rating);

      if (isComplete()) {
        await completeQuiz();
        setTimeout(() => router.push(`/${lang}/quiz`), 1500);
      } else {
        setUserAnswer("");
        setShowResult(false);
        setShowAnswer(false);
        setAttempts(0);
        setStartTime(Date.now());
      }
    } catch (err) {
      console.error("Failed to record result:", err);
    }
  };

  const handleCancel = async () => {
    await cancelQuiz();
    router.push(`/${lang}/quiz`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !showResult) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const t = useMemo(() => getTranslations(lang), [lang]);

  if (quizLoading || !dailyReview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t("quiz.flashcard.loading")}</p>
        </div>
      </div>
    );
  }

  if (!currentSession && dailyReview.dueWords.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <Check className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("quiz.flashcard.allCaughtUp")}</h2>
            <p className="text-gray-600 mb-6">{t("quiz.flashcard.noWordsDue")}</p>
            <button
              onClick={() => router.push(`/${lang}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {t("quiz.flashcard.goToDashboard")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <button
              onClick={() => router.push(`/${lang}`)}
              className="mb-4 text-gray-500 hover:text-gray-700"
            >
              <Home className="w-6 h-6 mx-auto" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("quiz.flashcard.noActiveQuiz")}</h2>
            <p className="text-gray-600 mb-6">
              {dailyReview.dueCount > 0
                ? t("quiz.flashcard.clickToStart")
                : t("quiz.flashcard.addVocabulary")}
            </p>
            {dailyReview.dueCount > 0 && (
              <button
                onClick={() => {
                  startQuiz("listening", dailyReview.dueWords);
                  setStartTime(Date.now());
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {t("quiz.flashcard.startReview", { count: dailyReview.dueCount })}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isCorrect = checkAnswer();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {t("quiz.flashcard.cardProgress", { current: Math.min(progress.current + 1, progress.total), total: progress.total })}
            </span>
            <button
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t("quiz.flashcard.quit")}
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Question */}
        {currentWord && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 mb-4">{t("quiz.listening.listenAndType")}</p>
              
              {/* Play button */}
              <button
                onClick={() => speakWord(currentWord.word)}
                className="w-24 h-24 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center mx-auto mb-6 transition-colors"
              >
                <Volume2 className="w-12 h-12 text-blue-600" />
              </button>

              {/* Play again hint */}
              <p className="text-sm text-gray-500 mb-4">
                {t("quiz.listening.playAudio")}
              </p>

              {/* Translation hint (optional) */}
              <p className="text-gray-600 text-sm">
                {currentWord.translation}
              </p>
            </div>

            {/* Input */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={showResult}
                  placeholder={t("quiz.fillBlank.enterWord")}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-center text-lg font-medium transition-all ${getInputClassName()}`}
                  autoFocus
                />
              </div>

              {/* Show answer toggle */}
              {!showResult && (
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center mx-auto"
                >
                  {showAnswer ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-1" /> {t("quiz.fillBlank.showAnswer")}
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" /> {t("quiz.fillBlank.showAnswer")}
                    </>
                  )}
                </button>
              )}

              {/* Show correct answer */}
              {showAnswer && !showResult && (
                <p className="mt-4 text-center text-gray-600">
                  {currentWord.word}
                  <button
                    onClick={() => speakWord(currentWord.word)}
                    className="ml-2 p-1 text-gray-400 hover:text-blue-600 transition-colors inline-flex"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </p>
              )}

              {/* Result feedback */}
              {showResult && (
                <div className="mt-6 text-center">
                  {isCorrect ? (
                    <p className="text-green-600 font-medium">{t("quiz.multipleChoice.correct")}</p>
                  ) : (
                    <div>
                      <p className="text-red-600 font-medium mb-2">{t("quiz.multipleChoice.incorrect")}</p>
                      <p className="text-gray-600">
                        {currentWord.word}
                        <button
                          onClick={() => speakWord(currentWord.word)}
                          className="ml-2 p-1 text-gray-400 hover:text-blue-600 transition-colors inline-flex"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          {showResult ? (
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {isComplete() ? t("quiz.flashcard.goToDashboard") : t("quiz.multipleChoice.nextQuestion")}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!userAnswer.trim()}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("quiz.typing.checkAnswer")}
            </button>
          )}
        </div>
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
