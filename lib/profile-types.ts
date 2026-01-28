// Profile types for multi-user support
export type { VocabularyEntry, AppSettings, LearningStats } from "./vocabulary-types"
import type { VocabularyEntry, AppSettings, LearningStats } from "./vocabulary-types"

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
