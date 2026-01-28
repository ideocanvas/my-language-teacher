// Profile types for multi-user support
import { VocabularyEntry, AppSettings, LearningStats } from "./vocabulary-types"

export interface Profile {
  id: string
  name: string
  color: string // hex color for profile avatar
  createdAt: number
  lastUsedAt: number
}

export interface ProfileData {
  vocabulary: VocabularyEntry[]
  settings: AppSettings
  learningStats: LearningStats
}

// Re-export for convenience
export type { VocabularyEntry, AppSettings, LearningStats }
