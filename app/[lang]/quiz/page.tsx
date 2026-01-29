"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Brain, Shuffle, Book, Volume2, Keyboard, ArrowRight } from "lucide-react";

type QuizType = "flashcard" | "multiple-choice" | "fill-blank" | "typing" | "listening";

interface QuizOption {
  type: QuizType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const quizOptions: QuizOption[] = [
  {
    type: "flashcard",
    title: "Flashcards",
    description: "Classic flip cards with spaced repetition",
    icon: Brain,
    color: "bg-purple-600",
  },
  {
    type: "multiple-choice",
    title: "Multiple Choice",
    description: "Select the correct answer from options",
    icon: Book,
    color: "bg-blue-600",
  },
  {
    type: "fill-blank",
    title: "Fill in the Blank",
    description: "Complete sentences with missing words",
    icon: Shuffle,
    color: "bg-green-600",
  },
  {
    type: "typing",
    title: "Typing Practice",
    description: "Type the correct translation or word",
    icon: Keyboard,
    color: "bg-orange-600",
  },
  {
    type: "listening",
    title: "Listening Practice",
    description: "Listen and type what you hear",
    icon: Volume2,
    color: "bg-pink-600",
  },
];

export default function QuizPage({ params }: { params: Promise<{ lang: string }> }) {
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

  const handleStartQuiz = (type: QuizType) => {
    // For now, navigate to the flashcard quiz for all types
    // In a full implementation, each type would have its own page
    router.push(`/${lang}/quiz/${type}`);
  };

  const dueWordsCount = dailyReview?.dueCount || 0;
  const pluralSuffix = dueWordsCount === 1 ? "" : "s";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Quizzes</h1>
          <p className="text-sm sm:text-base text-gray-600">
            {dueWordsCount > 0
              ? `${dueWordsCount} word${pluralSuffix} due for review`
              : "Start a practice session to improve your vocabulary"}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">Loading...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {quizOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleStartQuiz(option.type)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 text-left hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${option.color} rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                  <option.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{option.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{option.description}</p>
                <div className="flex items-center mt-3 sm:mt-4 text-xs sm:text-sm text-blue-600">
                  <span className="font-medium">Start Quiz</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Info Section */}
        {vocabulary.length > 0 && (
          <div className="mt-4 sm:mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">About Quiz Modes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Spaced Repetition</h3>
                <p>
                  Words are scheduled based on how well you know them. Words you struggle with
                  appear more frequently.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Daily Goal</h3>
                <p>
                  Review your due words each day to build long-term memory and track your
                  progress streak.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No words state */}
        {!loading && vocabulary.length === 0 && (
          <div className="mt-4 sm:mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-12 text-center">
            <Brain className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">No words to quiz</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Add some vocabulary first before taking a quiz
            </p>
            <button
              onClick={() => router.push(`/${lang}/vocabulary/add`)}
              className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              Add Your First Word
            </button>
          </div>
        )}
      </main>
    </div>
  );
}