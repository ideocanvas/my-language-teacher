"use client";

import { useState, useCallback } from "react";
import { QuizSession, QuizType, QuizResult, VocabularyEntry } from "@/lib/vocabulary-types";
import { languageStorage } from "@/lib/language-storage";
import { toast } from "sonner";

export function useQuiz() {
  const [currentSession, setCurrentSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = useCallback(
    async (type: QuizType, words: VocabularyEntry[]) => {
      try {
        setLoading(true);

        const wordIds = words.map((w) => w.id);

        const session: QuizSession = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type,
          words: wordIds,
          currentIndex: 0,
          results: [],
          startedAt: Date.now(),
        };

        await languageStorage.addQuizSession(session);
        setCurrentSession(session);
        setError(null);

        return session;
      } catch (err) {
        setError("Failed to start quiz");
        console.error("Failed to start quiz:", err);
        toast.error("Failed to start quiz");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const recordResult = useCallback(
    async (wordId: string, correct: boolean, attempts: number, timeTaken: number) => {
      if (!currentSession) {
        throw new Error("No active quiz session");
      }

      try {
        const result: QuizResult = {
          wordId,
          correct,
          attempts,
          timeTaken,
        };

        const updatedSession: QuizSession = {
          ...currentSession,
          results: [...currentSession.results, result],
          currentIndex: currentSession.currentIndex + 1,
        };

        await languageStorage.updateQuizSession(updatedSession);
        setCurrentSession(updatedSession);

        return updatedSession;
      } catch (err) {
        setError("Failed to record result");
        console.error("Failed to record result:", err);
        throw err;
      }
    },
    [currentSession]
  );

  const completeQuiz = useCallback(async () => {
    if (!currentSession) {
      throw new Error("No active quiz session");
    }

    try {
      const completedSession: QuizSession = {
        ...currentSession,
        completedAt: Date.now(),
      };

      await languageStorage.updateQuizSession(completedSession);
      setCurrentSession(completedSession);

      const correctCount = completedSession.results.filter((r) => r.correct).length;
      const accuracy = (correctCount / completedSession.results.length) * 100;

      toast.success(
        `Quiz completed! Score: ${correctCount}/${completedSession.results.length} (${accuracy.toFixed(0)}%)`
      );

      return completedSession;
    } catch (err) {
      setError("Failed to complete quiz");
      console.error("Failed to complete quiz:", err);
      throw err;
    }
  }, [currentSession]);

  const cancelQuiz = useCallback(async () => {
    if (!currentSession) {
      return;
    }

    try {
      const cancelledSession: QuizSession = {
        ...currentSession,
        completedAt: Date.now(),
      };

      await languageStorage.updateQuizSession(cancelledSession);
      setCurrentSession(null);

      toast.info("Quiz cancelled");
    } catch (err) {
      console.error("Failed to cancel quiz:", err);
    }
  }, [currentSession]);

  const getCurrentWordId = useCallback((): string | null => {
    if (!currentSession) {
      return null;
    }

    if (currentSession.currentIndex >= currentSession.words.length) {
      return null;
    }

    return currentSession.words[currentSession.currentIndex];
  }, [currentSession]);

  const isComplete = useCallback((): boolean => {
    if (!currentSession) {
      return false;
    }

    return currentSession.currentIndex >= currentSession.words.length;
  }, [currentSession]);

  const getProgress = useCallback((): { current: number; total: number; percentage: number } => {
    if (!currentSession) {
      return { current: 0, total: 0, percentage: 0 };
    }

    const current = currentSession.currentIndex;
    const total = currentSession.words.length;
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return { current, total, percentage };
  }, [currentSession]);

  const getResults = useCallback((): QuizResult[] => {
    return currentSession?.results || [];
  }, [currentSession]);

  return {
    currentSession,
    loading,
    error,
    startQuiz,
    recordResult,
    completeQuiz,
    cancelQuiz,
    getCurrentWordId,
    isComplete,
    getProgress,
    getResults,
  };
}