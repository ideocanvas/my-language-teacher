"use client";

import { AppNavigation } from "@/components/app-navigation";
import { useQuiz } from "@/hooks/use-quiz";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Check, Home, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export default function MultipleChoiceQuizPage({ params }: { params: Promise<{ lang: string }> }) {
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

  const [options, setOptions] = useState<Option[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
    };
    loadParams();
  }, [params]);

  // Generate multiple choice options
  const generateOptions = useCallback((currentWordId: string): Option[] => {
    const currentWord = vocabulary.find((w) => w.id === currentWordId);
    if (!currentWord) return [];

    const correctAnswer = currentWord.translation;
    
    // Get other words' translations as distractors
    const otherWords = vocabulary
      .filter((w) => w.id !== currentWordId)
      .map((w) => w.translation)
      .filter((t) => t !== correctAnswer);
    
    // Shuffle and pick 3 distractors
    const shuffledDistractors = otherWords
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    // If not enough distractors, add some generic ones
    const distractors = shuffledDistractors.length >= 3 
      ? shuffledDistractors 
      : [...shuffledDistractors, "option A", "option B", "option C"].slice(0, 3);
    
    const allOptions = [
      { id: "correct", text: correctAnswer, isCorrect: true },
      ...distractors.map((text, index) => ({ 
        id: `wrong-${index}`, 
        text, 
        isCorrect: false 
      })),
    ];
    
    // Shuffle options
    return allOptions.sort(() => Math.random() - 0.5);
  }, [vocabulary]);

  useEffect(() => {
    if (!currentSession && dailyReview && dailyReview.dueWords.length > 0) {
      startQuiz("multiple-choice", dailyReview.dueWords);
      setStartTime(Date.now());
    }
  }, [currentSession, dailyReview, startQuiz]);

  // Generate new options when word changes
  useEffect(() => {
    const currentWordId = getCurrentWordId();
    if (currentWordId && !showResult) {
      setOptions(generateOptions(currentWordId));
      setSelectedOption(null);
    }
  }, [getCurrentWordId, generateOptions, showResult]);

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

  const handleSelectOption = (optionId: string) => {
    if (showResult) return;
    setSelectedOption(optionId);
    setShowResult(true);
  };

  const handleNext = async () => {
    if (!currentWordId || !selectedOption) return;

    const selectedOptionData = options.find((o) => o.id === selectedOption);
    const isCorrect = selectedOptionData?.isCorrect || false;
    const timeTaken = Date.now() - startTime;

    try {
      await recordResult(currentWordId, isCorrect, 1, timeTaken);
      
      // Update SRS with rating based on correctness
      const rating = isCorrect ? 3 : 0;
      await reviewWord(currentWordId, rating);

      if (isComplete()) {
        await completeQuiz();
        setTimeout(() => router.push(`/${lang}/quiz`), 1500);
      } else {
        setShowResult(false);
        setSelectedOption(null);
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
                  startQuiz("multiple-choice", dailyReview.dueWords);
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
              Question {Math.min(progress.current + 1, progress.total)} of {progress.total}
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

        {/* Question */}
        {currentWord && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 mb-4">Select the correct translation:</p>
              <div className="flex items-center justify-center gap-4">
                <h2 className="text-4xl font-bold text-gray-900">{currentWord.word}</h2>
                <button
                  onClick={() => speakWord(currentWord.word)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              </div>
              {currentWord.partOfSpeech && (
                <p className="text-gray-500 capitalize mt-2">{currentWord.partOfSpeech}</p>
              )}
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {options.map((option) => {
                const isSelected = selectedOption === option.id;
                const showCorrect = showResult && option.isCorrect;
                const showWrong = showResult && isSelected && !option.isCorrect;

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectOption(option.id)}
                    disabled={showResult}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      showCorrect
                        ? "border-green-500 bg-green-50"
                        : showWrong
                        ? "border-red-500 bg-red-50"
                        : isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{option.text}</span>
                      {showCorrect && <Check className="w-5 h-5 text-green-600" />}
                      {showWrong && <X className="w-5 h-5 text-red-600" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Result feedback */}
            {showResult && (
              <div className="mt-6 text-center">
                {selectedOption && options.find((o) => o.id === selectedOption)?.isCorrect ? (
                  <p className="text-green-600 font-medium">Correct! Well done!</p>
                ) : (
                  <p className="text-red-600 font-medium">
                    Incorrect. The correct answer was: {" "}
                    {options.find((o) => o.isCorrect)?.text}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Next button */}
        {showResult && (
          <div className="flex justify-center">
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {isComplete() ? "Finish" : "Next Question"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
