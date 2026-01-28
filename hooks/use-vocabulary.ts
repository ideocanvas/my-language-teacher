"use client";

import { languageStorage } from "@/lib/language-storage";
import { calculateNextReview, createInitialSRSData } from "@/lib/srs-algorithm";
import {
    DailyReviewInfo,
    VocabularyEntry,
    VocabularyFilters,
} from "@/lib/vocabulary-types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function useVocabulary() {
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyReview, setDailyReview] = useState<DailyReviewInfo | null>(null);

  // Load vocabulary on mount
  useEffect(() => {
    loadVocabulary();
    loadDailyReview();
  }, []);

  const loadVocabulary = useCallback(async () => {
    try {
      setLoading(true);
      const entries = await languageStorage.getAllVocabulary();
      setVocabulary(entries);
      setError(null);
    } catch (err) {
      setError("Failed to load vocabulary");
      console.error("Failed to load vocabulary:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDailyReview = useCallback(async () => {
    try {
      const info = await languageStorage.getDailyReviewInfo();
      setDailyReview(info);
    } catch (err) {
      console.error("Failed to load daily review:", err);
    }
  }, []);

  const addWord = useCallback(
    async (entry: Omit<VocabularyEntry, "id" | "createdAt" | "updatedAt" | "srsData">) => {
      try {
        const now = Date.now();
        const newEntry: VocabularyEntry = {
          ...entry,
          id: `${now}-${Math.random().toString(36).slice(2, 11)}`,
          srsData: createInitialSRSData(),
          createdAt: now,
          updatedAt: now,
        };

        await languageStorage.addVocabulary(newEntry);
        setVocabulary((prev) => [newEntry, ...prev]);
        await loadDailyReview();
        toast.success("Word added successfully");
        return newEntry;
      } catch (err) {
        setError("Failed to add word");
        console.error("Failed to add word:", err);
        toast.error("Failed to add word");
        throw err;
      }
    },
    [loadDailyReview]
  );

  const updateWord = useCallback(
    async (id: string, updates: Partial<VocabularyEntry>) => {
      try {
        const existing = vocabulary.find((e) => e.id === id);
        if (!existing) {
          throw new Error("Word not found");
        }

        const updated: VocabularyEntry = {
          ...existing,
          ...updates,
          id, // Ensure ID is not changed
          updatedAt: Date.now(),
        };

        await languageStorage.updateVocabulary(updated);
        setVocabulary((prev) => prev.map((e) => (e.id === id ? updated : e)));
        await loadDailyReview();
        toast.success("Word updated successfully");
        return updated;
      } catch (err) {
        setError("Failed to update word");
        console.error("Failed to update word:", err);
        toast.error("Failed to update word");
        throw err;
      }
    },
    [vocabulary, loadDailyReview]
  );

  const deleteWord = useCallback(
    async (id: string) => {
      try {
        await languageStorage.deleteVocabulary(id);
        setVocabulary((prev) => prev.filter((e) => e.id !== id));
        await loadDailyReview();
        toast.success("Word deleted");
      } catch (err) {
        setError("Failed to delete word");
        console.error("Failed to delete word:", err);
        toast.error("Failed to delete word");
        throw err;
      }
    },
    [loadDailyReview]
  );

  const reviewWord = useCallback(
    async (id: string, rating: 0 | 1 | 2 | 3 | 4 | 5) => {
      try {
        const existing = vocabulary.find((e) => e.id === id);
        if (!existing) {
          throw new Error("Word not found");
        }

        const settings = await languageStorage.getSettings();
        const newSRSData = calculateNextReview(
          existing.srsData,
          rating,
          settings.srsSettings
        );

        const updated: VocabularyEntry = {
          ...existing,
          srsData: newSRSData,
          lastReviewedAt: Date.now(),
          updatedAt: Date.now(),
        };

        await languageStorage.updateVocabulary(updated);
        setVocabulary((prev) => prev.map((e) => (e.id === id ? updated : e)));
        await loadDailyReview();

        const ratingLabels: Record<number, string> = {
          0: "Again",
          1: "Hard",
          2: "Good",
          3: "Good",
          4: "Good",
          5: "Easy",
        };
        toast.success(`Reviewed: ${ratingLabels[rating]}`);

        return updated;
      } catch (err) {
        setError("Failed to review word");
        console.error("Failed to review word:", err);
        toast.error("Failed to review word");
        throw err;
      }
    },
    [vocabulary, loadDailyReview]
  );

  const filterVocabulary = useCallback(
    async (filters: VocabularyFilters): Promise<VocabularyEntry[]> => {
      try {
        return await languageStorage.getVocabularyByFilters(filters);
      } catch (err) {
        setError("Failed to filter vocabulary");
        console.error("Failed to filter vocabulary:", err);
        return [];
      }
    },
    []
  );

  const searchVocabulary = useCallback(
    (query: string) => {
      if (!query.trim()) {
        return vocabulary;
      }

      const lowerQuery = query.toLowerCase();
      return vocabulary.filter(
        (entry) =>
          entry.word.toLowerCase().includes(lowerQuery) ||
          entry.translation.toLowerCase().includes(lowerQuery) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
          entry.exampleSentences.some((s) => s.toLowerCase().includes(lowerQuery))
      );
    },
    [vocabulary]
  );

  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>();
    vocabulary.forEach((entry) => {
      entry.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [vocabulary]);

  const bulkAddWords = useCallback(
    async (entries: Omit<VocabularyEntry, "id" | "createdAt" | "updatedAt" | "srsData">[]) => {
      try {
        const now = Date.now();
        const newEntries: VocabularyEntry[] = entries.map((entry, index) => ({
          ...entry,
          id: `${now}-${index}-${Math.random().toString(36).slice(2, 11)}`,
          srsData: createInitialSRSData(),
          createdAt: now,
          updatedAt: now,
        }));

        await languageStorage.bulkAddVocabulary(newEntries);
        setVocabulary((prev) => [...newEntries, ...prev]);
        await loadDailyReview();
        toast.success(`Added ${newEntries.length} words`);
        return newEntries;
      } catch (err) {
        setError("Failed to add words");
        console.error("Failed to add words:", err);
        toast.error("Failed to add words");
        throw err;
      }
    },
    [loadDailyReview]
  );

  const refresh = useCallback(async () => {
    await loadVocabulary();
    await loadDailyReview();
  }, [loadVocabulary, loadDailyReview]);

  return {
    vocabulary,
    loading,
    error,
    dailyReview,
    addWord,
    updateWord,
    deleteWord,
    reviewWord,
    filterVocabulary,
    searchVocabulary,
    getAllTags,
    bulkAddWords,
    refresh,
  };
}