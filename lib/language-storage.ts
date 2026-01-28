"use client";

import {
    AppSettings,
    DailyReviewInfo,
    LearningStats,
    QuizSession,
    VocabularyEntry,
    VocabularyFilters
} from "./vocabulary-types";

const DB_NAME = "LanguageTeacherDB";
const DB_VERSION = 1;

const STORES = {
  VOCABULARY: "vocabulary",
  QUIZZES: "quizzes",
  STATS: "stats",
  SETTINGS: "settings",
} as const;

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  sourceLanguage: "en",
  targetLanguage: "zh",
  dailyReviewGoal: 20,
  srsSettings: {
    easyBonus: 1.3,
    intervalModifier: 1,
  },
};

// Default stats
const DEFAULT_STATS: LearningStats = {
  totalWords: 0,
  wordsLearned: 0,
  reviewsCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  accuracy: 0,
  totalStudyTime: 0,
};

class LanguageStorage {
  private static instance: LanguageStorage;
  private db: IDBDatabase | null = null;

  static getInstance(): LanguageStorage {
    if (!LanguageStorage.instance) {
      LanguageStorage.instance = new LanguageStorage();
    }
    return LanguageStorage.instance;
  }

  async initialize(): Promise<void> {
    if (!globalThis.indexedDB) {
      throw new Error("IndexedDB is not supported in this browser");
    }

    if (this.db) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error || new Error("Failed to open database"));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Vocabulary store
        if (!db.objectStoreNames.contains(STORES.VOCABULARY)) {
          const vocabStore = db.createObjectStore(STORES.VOCABULARY, {
            keyPath: "id",
          });
          vocabStore.createIndex("word", "word", { unique: false });
          vocabStore.createIndex("tags", "tags", { unique: false, multiEntry: true });
          vocabStore.createIndex("difficulty", "difficulty", { unique: false });
          vocabStore.createIndex("nextReview", "srsData.nextReview", { unique: false });
          vocabStore.createIndex("createdAt", "createdAt", { unique: false });
          vocabStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // Quizzes store
        if (!db.objectStoreNames.contains(STORES.QUIZZES)) {
          const quizStore = db.createObjectStore(STORES.QUIZZES, {
            keyPath: "id",
          });
          quizStore.createIndex("type", "type", { unique: false });
          quizStore.createIndex("startedAt", "startedAt", { unique: false });
          quizStore.createIndex("completedAt", "completedAt", { unique: false });
        }

        // Stats store (single record)
        if (!db.objectStoreNames.contains(STORES.STATS)) {
          db.createObjectStore(STORES.STATS, { keyPath: "id" });
        }

        // Settings store (single record)
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
        }
      };
    });
  }

  // ========== VOCABULARY OPERATIONS ==========

  async addVocabulary(entry: VocabularyEntry): Promise<void> {
    await this.ensureInitialized();
    return this.putVocabulary(entry);
  }

  async updateVocabulary(entry: VocabularyEntry): Promise<void> {
    await this.ensureInitialized();
    return this.putVocabulary(entry);
  }

  private async putVocabulary(entry: VocabularyEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VOCABULARY], "readwrite");
      const store = transaction.objectStore(STORES.VOCABULARY);

      const request = store.put(entry);
      request.onerror = () => reject(request.error || new Error("Failed to save vocabulary"));
      request.onsuccess = () => resolve();
    });
  }

  async getVocabulary(id: string): Promise<VocabularyEntry | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VOCABULARY], "readonly");
      const store = transaction.objectStore(STORES.VOCABULARY);
      const request = store.get(id);

      request.onerror = () => reject(request.error || new Error("Failed to get vocabulary"));
      request.onsuccess = () => {
        resolve(request.result as VocabularyEntry | null);
      };
    });
  }

  async getAllVocabulary(): Promise<VocabularyEntry[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VOCABULARY], "readonly");
      const store = transaction.objectStore(STORES.VOCABULARY);
      const request = store.getAll();

      request.onerror = () => reject(request.error || new Error("Failed to get all vocabulary"));
      request.onsuccess = () => {
        resolve(request.result as VocabularyEntry[]);
      };
    });
  }

  async getVocabularyByFilters(filters: VocabularyFilters): Promise<VocabularyEntry[]> {
    await this.ensureInitialized();
    let entries = await this.getAllVocabulary();

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.word.toLowerCase().includes(searchLower) ||
          e.translation.toLowerCase().includes(searchLower) ||
          e.exampleSentences.some((s) => s.toLowerCase().includes(searchLower))
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      entries = entries.filter((e) =>
        filters.tags!.some((tag) => e.tags.includes(tag))
      );
    }

    if (filters.difficulty && filters.difficulty.length > 0) {
      entries = entries.filter((e) => filters.difficulty!.includes(e.difficulty));
    }

    if (filters.partOfSpeech && filters.partOfSpeech.length > 0) {
      entries = entries.filter((e) =>
        e.partOfSpeech ? filters.partOfSpeech!.includes(e.partOfSpeech) : false
      );
    }

    if (filters.onlyDueForReview) {
      const now = Date.now();
      entries = entries.filter((e) => e.srsData.nextReview <= now);
    }

    // Sort
    const sortBy = filters.sortBy || "updatedAt";
    const sortOrder = filters.sortOrder || "desc";

    entries.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "word":
          comparison = a.word.localeCompare(b.word);
          break;
        case "createdAt":
          comparison = a.createdAt - b.createdAt;
          break;
        case "updatedAt":
          comparison = a.updatedAt - b.updatedAt;
          break;
        case "nextReview":
          comparison = a.srsData.nextReview - b.srsData.nextReview;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return entries;
  }

  async deleteVocabulary(id: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VOCABULARY], "readwrite");
      const store = transaction.objectStore(STORES.VOCABULARY);
      const request = store.delete(id);

      request.onerror = () => reject(request.error || new Error("Failed to delete vocabulary"));
      request.onsuccess = () => resolve();
    });
  }

  async bulkAddVocabulary(entries: VocabularyEntry[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VOCABULARY], "readwrite");
      const store = transaction.objectStore(STORES.VOCABULARY);

      entries.forEach((entry) => {
        store.put(entry);
      });

      transaction.onerror = () => reject(transaction.error || new Error("Failed to bulk add vocabulary"));
      transaction.oncomplete = () => resolve();
    });
  }

  // ========== QUIZ OPERATIONS ==========

  async addQuizSession(session: QuizSession): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.QUIZZES], "readwrite");
      const store = transaction.objectStore(STORES.QUIZZES);

      const request = store.add(session);
      request.onerror = () => reject(request.error || new Error("Failed to add quiz session"));
      request.onsuccess = () => resolve();
    });
  }

  async getQuizSession(id: string): Promise<QuizSession | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.QUIZZES], "readonly");
      const store = transaction.objectStore(STORES.QUIZZES);
      const request = store.get(id);

      request.onerror = () => reject(request.error || new Error("Failed to get quiz session"));
      request.onsuccess = () => {
        resolve(request.result as QuizSession | null);
      };
    });
  }

  async updateQuizSession(session: QuizSession): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.QUIZZES], "readwrite");
      const store = transaction.objectStore(STORES.QUIZZES);

      const request = store.put(session);
      request.onerror = () => reject(request.error || new Error("Failed to update quiz session"));
      request.onsuccess = () => resolve();
    });
  }

  async getRecentQuizzes(limit: number = 10): Promise<QuizSession[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.QUIZZES], "readonly");
      const store = transaction.objectStore(STORES.QUIZZES);
      const index = store.index("startedAt");

      const request = index.openCursor(null, "prev");
      const results: QuizSession[] = [];

      request.onerror = () => reject(request.error || new Error("Failed to get recent quizzes"));
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value as QuizSession);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  // ========== STATS OPERATIONS ==========

  async getStats(): Promise<LearningStats> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.STATS], "readonly");
      const store = transaction.objectStore(STORES.STATS);
      const request = store.get("main");

      request.onerror = () => reject(request.error || new Error("Failed to get stats"));
      request.onsuccess = () => {
        resolve(request.result || { ...DEFAULT_STATS, id: "main" });
      };
    });
  }

  async updateStats(stats: LearningStats): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.STATS], "readwrite");
      const store = transaction.objectStore(STORES.STATS);

      const request = store.put({ id: "main", ...stats });
      request.onerror = () => reject(request.error || new Error("Failed to update stats"));
      request.onsuccess = () => resolve();
    });
  }

  // ========== SETTINGS OPERATIONS ==========

  async getSettings(): Promise<AppSettings> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SETTINGS], "readonly");
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get("main");

      request.onerror = () =>
        reject(request.error || new Error("Failed to get settings"));
      request.onsuccess = () => {
        resolve(request.result || { ...DEFAULT_SETTINGS, id: "main" });
      };
    });
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SETTINGS], "readwrite");
      const store = transaction.objectStore(STORES.SETTINGS);

      const request = store.put({ id: "main", ...settings });
      request.onerror = () => reject(request.error || new Error("Failed to update settings"));
      request.onsuccess = () => resolve();
    });
  }

  // ========== DAILY REVIEW ==========

  async getDailyReviewInfo(): Promise<DailyReviewInfo> {
    const [allVocabulary, , settings] = await Promise.all([
      this.getAllVocabulary(),
      this.getStats(),
      this.getSettings(),
    ]);

    const now = Date.now();
    const dueWords = allVocabulary.filter((e) => e.srsData.nextReview <= now);
    const todayStart = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);

    // Count reviews completed today
    const todayReviews = allVocabulary.filter(
      (e) => e.lastReviewedAt && e.lastReviewedAt >= todayStart
    ).length;

    return {
      dueWords: dueWords.slice(0, settings.dailyReviewGoal),
      dueCount: dueWords.length,
      newWordsAvailable: allVocabulary.filter((e) => e.srsData.repetition === 0).length,
      reviewGoal: settings.dailyReviewGoal,
      progress: Math.min((todayReviews / settings.dailyReviewGoal) * 100, 100),
    };
  }

  // ========== SYNC DATA ==========

  async getAllVocabularyForSync(): Promise<VocabularyEntry[]> {
    return this.getAllVocabulary();
  }

  async clearAllVocabulary(): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VOCABULARY], "readwrite");
      const store = transaction.objectStore(STORES.VOCABULARY);
      const request = store.clear();

      request.onerror = () => reject(request.error || new Error("Failed to clear vocabulary"));
      request.onsuccess = () => resolve();
    });
  }

  // ========== UTILITIES ==========

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Export/Import
  async exportData(): Promise<{
    vocabulary: VocabularyEntry[];
    quizzes: QuizSession[];
    stats: LearningStats;
    settings: AppSettings;
  }> {
    const [vocabulary, quizzes, stats, settings] = await Promise.all([
      this.getAllVocabulary(),
      this.getRecentQuizzes(1000),
      this.getStats(),
      this.getSettings(),
    ]);

    return { vocabulary, quizzes, stats, settings };
  }

  async importData(
    data: {
      vocabulary: VocabularyEntry[];
      quizzes?: QuizSession[];
      stats?: LearningStats;
      settings?: AppSettings;
    },
    clean: boolean = false
  ): Promise<void> {
    if (clean) {
      await this.clearAllVocabulary();
    }

    if (data.vocabulary && data.vocabulary.length > 0) {
      await this.bulkAddVocabulary(data.vocabulary);
    }

    if (data.quizzes && data.quizzes.length > 0) {
      for (const quiz of data.quizzes) {
        await this.addQuizSession(quiz);
      }
    }

    if (data.stats) {
      await this.updateStats(data.stats);
    }

    if (data.settings) {
      await this.updateSettings(data.settings);
    }
  }
}

export const languageStorage = LanguageStorage.getInstance();