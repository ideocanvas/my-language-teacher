// Difficulty level type
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5

// Vocabulary Entry
export interface VocabularyEntry {
  id: string
  word: string
  translation: string
  pronunciation?: string // IPA notation
  audioUrl?: string // TTS audio
  partOfSpeech?: string
  definitions: string[]
  exampleSentences: string[]
  tags: string[]
  notes?: string
  difficulty: DifficultyLevel
  createdAt: number
  updatedAt: number
  lastReviewedAt?: number
  srsData: SRSData
}

// Spaced Repetition System Data
export interface SRSData {
  interval: number // Days until next review
  repetition: number // Number of successful reviews
  efactor: number // Easiness factor (2.5 default)
  nextReview: number // Timestamp of next review
}

// Quiz Session
export interface QuizSession {
  id: string
  type: QuizType
  words: string[] // word IDs
  currentIndex: number
  results: QuizResult[]
  startedAt: number
  completedAt?: number
}

export type QuizType =
  | 'flashcard'
  | 'multiple-choice'
  | 'fill-blank'
  | 'typing'
  | 'listening'

export interface QuizResult {
  wordId: string
  correct: boolean
  attempts: number
  timeTaken: number
}

// Learning Statistics
export interface LearningStats {
  totalWords: number
  wordsLearned: number // Words reviewed successfully at least once
  reviewsCompleted: number
  currentStreak: number
  longestStreak: number
  accuracy: number // 0-1
  totalStudyTime: number // milliseconds
  lastStudyDate?: number
}

// App Settings
export interface AppSettings {
  sourceLanguage: string
  targetLanguage: string
  dailyReviewGoal: number
  srsSettings: {
    easyBonus: number // Bonus multiplier for easy cards
    intervalModifier: number // Multiplier for all intervals
  }
}

// Sync Data
export interface SyncData {
  vocabularyEntries: VocabularyEntry[]
  timestamp: number
}

export interface SyncStats {
  localAdded: number
  localUpdated: number
  remoteAdded: number
  remoteUpdated: number
  totalMerged: number
}

// Google Translate Response
export interface GoogleTranslateResponse {
  data: {
    translations: Array<{
      translatedText: string
      detectedSourceLanguage?: string
    }>
  }
}

// Enriched Translation Response
export interface EnrichedTranslationResponse {
  translatedText: string
  pronunciation?: string
  partOfSpeech?: string
  difficulty: 1 | 2 | 3 | 4 | 5
  tags: string[]
  notes?: string
}

// LLM Chat Message
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// AI Features
export interface ExampleSentencesResponse {
  word: string
  sentences: Array<{
    sentence: string
    translation: string
    difficulty: 1 | 2 | 3
  }>
}

export interface WordComparisonResponse {
  words: string[]
  differences: string[]
  examples: string[]
  recommendations: string[]
}

export interface GrammarExplanationResponse {
  topic: string
  explanation: string
  examples: string[]
  commonMistakes: string[]
}

export interface PronunciationHelpResponse {
  word: string
  ipa: string
  phoneticBreakdown: string[]
  similarSoundingWords: string[]
  commonMistakes: string[]
  audioTranscription?: string
}

// Vocabulary Filters
export interface VocabularyFilters {
  search?: string
  tags?: string[]
  difficulty?: (1 | 2 | 3 | 4 | 5)[]
  partOfSpeech?: string[]
  sortBy?: 'createdAt' | 'updatedAt' | 'word' | 'nextReview'
  sortOrder?: 'asc' | 'desc'
  onlyDueForReview?: boolean
}

// Daily Review Info
export interface DailyReviewInfo {
  dueWords: VocabularyEntry[]
  dueCount: number
  newWordsAvailable: number
  reviewGoal: number
  progress: number
}