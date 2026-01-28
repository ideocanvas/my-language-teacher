"use client";

import { AppNavigation } from "@/components/app-navigation";
import { useQuiz } from "@/hooks/use-quiz";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Check, Home, RotateCw, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function FlashcardQuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState("en");
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

  const [flipped, setFlipped] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
    };
    loadParams();
  }, [params]);

  useEffect(() => {
    // Start quiz when daily review is available
    if (!currentSession && dailyReview && dailyReview.dueWords.length > 0) {
      startQuiz("flashcard", dailyReview.dueWords);
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

  const handleFlip = () => {
    if (!flipped) {
      setFlipped(true);
    }
  };

  const handleRate = async (rating: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!currentWordId) return;

    const timeTaken = Date.now() - startTime;

    try {
      // Record quiz result
      const isCorrect = rating >= 3;
      await recordResult(currentWordId, isCorrect, 1, timeTaken);

      // Update SRS data
      await reviewWord(currentWordId, rating);

      // Reset for next card
      setFlipped(false);
      setStartTime(Date.now());

      // Check if quiz is complete
      if (isComplete()) {
        await completeQuiz();
        setTimeout(() => router.push(`/${lang}/quiz`), 1500);
      }
    } catch (err) {
      console.error("Failed to rate word:", err);
    }
  };

  const handleCancel = async () => {
    await cancelQuiz();
    router.push(`/${lang}/quiz`);
  };

  if (quizLoading || !dailyReview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All caught up!</h2>
            <p className="text-gray-600 mb-6">No words due for review right now</p>
            <button
              onClick={() => router.push(`/${lang}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No active quiz</h2>
            <p className="text-gray-600 mb-6">
              {dailyReview.dueCount > 0
                ? "Click below to start reviewing your due words"
                : "Add some vocabulary to start learning"}
            </p>
            {dailyReview.dueCount > 0 && (
              <button
                onClick={() => {
                  startQuiz("flashcard", dailyReview.dueWords);
                  setStartTime(Date.now());
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Start Review ({dailyReview.dueCount} words)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              Card {Math.min(progress.current + 1, progress.total)} of {progress.total}
            </span>
            <button
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Quit
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Flashcard */}
        {currentWord && (
          <div className="relative">
            <button
              onClick={handleFlip}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleFlip();
                }
              }}
              className={`w-full text-left bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 min-h-[400px] cursor-pointer transition-all duration-500 ${
                flipped ? "border-blue-300" : "hover:border-blue-200"
              }`}
            >
              {/* Front of card */}
              <div className="text-center">
                {flipped ? (
                  // Back of card
                  <div className="animate-fade-in">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      {currentWord.translation}
                    </h2>

                    {/* Pronunciation */}
                    {currentWord.pronunciation && (
                      <p className="text-gray-500 font-mono mb-4">
                        /{currentWord.pronunciation}/
                      </p>
                    )}

                    {/* Example sentence */}
                    {currentWord.exampleSentences.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-gray-700 italic">
                          "{currentWord.exampleSentences[0]}"
                        </p>
                      </div>
                    )}

                    {/* Tags */}
                    {currentWord.tags.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        {currentWord.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-gray-400 mt-4">Click to flip back</p>
                  </div>
                ) : (
                  // Front of card
                  <div className="animate-fade-in">
                    <div className="flex items-center justify-center mb-4">
                      <h2 className="text-4xl font-bold text-gray-900">
                        {currentWord.word}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(currentWord.word);
                        }}
                        className="ml-4 p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Volume2 className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Part of speech */}
                    {currentWord.partOfSpeech && (
                      <p className="text-gray-500 capitalize mb-4">
                        {currentWord.partOfSpeech}
                      </p>
                    )}

                    {/* Definitions */}
                    {currentWord.definitions.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-gray-700">{currentWord.definitions[0]}</p>
                      </div>
                    )}

                    <p className="text-sm text-gray-400 mt-8">Click to reveal answer</p>
                  </div>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Rating buttons */}
        {flipped && currentWord && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-slide-up">
            <p className="text-center text-gray-700 mb-4">How well did you know this?</p>
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              <button
                onClick={() => handleRate(0)}
                className="py-3 px-4 rounded-lg font-medium transition-colors bg-red-100 text-red-700 hover:bg-red-200"
              >
                <div className="text-sm hidden sm:inline">Again</div>
                <X className="w-5 h-5 sm:hidden mx-auto" />
              </button>
              <button
                onClick={() => handleRate(1)}
                className="py-3 px-4 rounded-lg font-medium transition-colors bg-orange-100 text-orange-700 hover:bg-orange-200"
              >
                <div className="text-sm hidden sm:inline">Hard</div>
                <RotateCw className="w-5 h-5 sm:hidden mx-auto" />
              </button>
              <button
                onClick={() => handleRate(3)}
                className="py-3 px-4 rounded-lg font-medium transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200"
              >
                <div className="text-sm hidden sm:inline">Good</div>
                <Check className="w-5 h-5 sm:hidden mx-auto" />
              </button>
              <button
                onClick={() => handleRate(5)}
                className="py-3 px-4 rounded-lg font-medium transition-colors bg-green-100 text-green-700 hover:bg-green-200"
              >
                <div className="text-sm hidden sm:inline">Easy</div>
                <Check className="w-5 h-5 sm:hidden mx-auto" />
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!flipped && (
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Click the card to reveal the answer</p>
            <p>Rate your knowledge to schedule the next review</p>
          </div>
        )}
      </main>
    </div>
  );
}