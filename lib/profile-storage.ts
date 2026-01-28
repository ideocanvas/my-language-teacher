/**
 * Profile Storage Manager
 * Manages multiple user profiles with separate data
 */

import { Profile, ProfileData, VocabularyEntry, AppSettings, LearningStats } from "./profile-types";
import { createInitialSRSData } from "./srs-algorithm";

const PROFILES_KEY = "language-teacher-profiles";
const CURRENT_PROFILE_KEY = "language-teacher-current-profile";

// Default settings
const defaultSettings: AppSettings = {
  sourceLanguage: "en",
  targetLanguage: "zh-CN",
  dailyReviewGoal: 20,
  srsSettings: {
    easyBonus: 1.3,
    intervalModifier: 1.0,
  },
};

// Default learning stats
const defaultLearningStats: LearningStats = {
  totalWords: 0,
  wordsLearned: 0,
  reviewsCompleted: 0,
  currentStreak: 0,
  longestStreak: 0,
  accuracy: 0,
  totalStudyTime: 0,
};

/**
 * Get all profiles
 */
export function getAllProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  const profiles = localStorage.getItem(PROFILES_KEY);
  return profiles ? JSON.parse(profiles) : [];
}

/**
 * Save all profiles
 */
export function saveAllProfiles(profiles: Profile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/**
 * Get current profile ID
 */
export function getCurrentProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_PROFILE_KEY);
}

/**
 * Set current profile ID
 */
export function setCurrentProfileId(profileId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENT_PROFILE_KEY, profileId);
  
  // Update lastUsedAt for the profile
  const profiles = getAllProfiles();
  const updatedProfiles = profiles.map((p) =>
    p.id === profileId ? { ...p, lastUsedAt: Date.now() } : p
  );
  saveAllProfiles(updatedProfiles);
}

/**
 * Create a new profile
 */
export function createProfile(name: string, color: string = "#3B82F6"): Profile {
  const now = Date.now();
  const profile: Profile = {
    id: `profile-${now}-${Math.random().toString(36).slice(2, 11)}`,
    name,
    color,
    createdAt: now,
    lastUsedAt: now,
  };

  const profiles = getAllProfiles();
  profiles.push(profile);
  saveAllProfiles(profiles);

  // Initialize profile data with empty vocabulary and default settings
  const profileData: ProfileData = {
    vocabulary: [],
    settings: defaultSettings,
    learningStats: defaultLearningStats,
  };
  saveProfileData(profile.id, profileData);

  // Set as current profile if it's the first one
  if (profiles.length === 1) {
    setCurrentProfileId(profile.id);
  }

  return profile;
}

/**
 * Delete a profile (with confirmation required)
 */
export function deleteProfile(profileId: string): boolean {
  const profiles = getAllProfiles();
  const profile = profiles.find((p) => p.id === profileId);
  
  if (!profile) return false;

  // Remove profile from list
  const updatedProfiles = profiles.filter((p) => p.id !== profileId);
  saveAllProfiles(updatedProfiles);

  // Delete profile data
  if (typeof window !== "undefined") {
    localStorage.removeItem(getProfileDataKey(profileId));
  }

  // If this was the current profile, switch to another one
  const currentId = getCurrentProfileId();
  if (currentId === profileId) {
    if (updatedProfiles.length > 0) {
      setCurrentProfileId(updatedProfiles[0].id);
    } else {
      localStorage.removeItem(CURRENT_PROFILE_KEY);
    }
  }

  return true;
}

/**
 * Update profile name or color
 */
export function updateProfile(profileId: string, updates: Partial<Pick<Profile, "name" | "color">>): Profile | null {
  const profiles = getAllProfiles();
  const profileIndex = profiles.findIndex((p) => p.id === profileId);
  
  if (profileIndex === -1) return null;

  profiles[profileIndex] = { ...profiles[profileIndex], ...updates };
  saveAllProfiles(profiles);
  
  return profiles[profileIndex];
}

/**
 * Get profile data key
 */
function getProfileDataKey(profileId: string): string {
  return `language-teacher-data-${profileId}`;
}

/**
 * Get profile data
 */
export function getProfileData(profileId: string): ProfileData {
  if (typeof window === "undefined") {
    return {
      vocabulary: [],
      settings: defaultSettings,
      learningStats: defaultLearningStats,
    };
  }

  const data = localStorage.getItem(getProfileDataKey(profileId));
  if (data) {
    return JSON.parse(data);
  }

  // Return default data if not found
  return {
    vocabulary: [],
    settings: defaultSettings,
    learningStats: defaultLearningStats,
  };
}

/**
 * Save profile data
 */
export function saveProfileData(profileId: string, data: ProfileData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getProfileDataKey(profileId), JSON.stringify(data));
}

/**
 * Get current profile
 */
export function getCurrentProfile(): Profile | null {
  const profileId = getCurrentProfileId();
  if (!profileId) return null;

  const profiles = getAllProfiles();
  return profiles.find((p) => p.id === profileId) || null;
}

/**
 * Get current profile data
 */
export function getCurrentProfileData(): ProfileData {
  const profileId = getCurrentProfileId();
  if (!profileId) {
    return {
      vocabulary: [],
      settings: defaultSettings,
      learningStats: defaultLearningStats,
    };
  }
  return getProfileData(profileId);
}

/**
 * Save current profile data
 */
export function saveCurrentProfileData(data: ProfileData): void {
  const profileId = getCurrentProfileId();
  if (!profileId) return;
  saveProfileData(profileId, data);
}

/**
 * Initialize profiles - creates default profile if none exists
 */
export function initializeProfiles(): Profile {
  const profiles = getAllProfiles();
  
  if (profiles.length === 0) {
    // Create default profile
    const defaultProfile = createProfile("Default", "#3B82F6");
    setCurrentProfileId(defaultProfile.id);
    return defaultProfile;
  }

  // Return current profile or first profile
  const currentId = getCurrentProfileId();
  if (currentId) {
    const current = profiles.find((p) => p.id === currentId);
    if (current) return current;
  }

  // Set first profile as current if no current profile
  setCurrentProfileId(profiles[0].id);
  return profiles[0];
}

/**
 * Migrate existing data to profile system
 */
export function migrateExistingData(): void {
  if (typeof window === "undefined") return;

  // Check if already migrated
  const profiles = getAllProfiles();
  if (profiles.length > 0) return;

  // Check for existing data
  const existingVocabulary = localStorage.getItem("language-teacher-vocabulary");
  const existingSettings = localStorage.getItem("language-teacher-settings");
  const existingStats = localStorage.getItem("language-teacher-learning-stats");

  if (existingVocabulary || existingSettings || existingStats) {
    // Create profile with existing data
    const now = Date.now();
    const profile: Profile = {
      id: `profile-${now}-${Math.random().toString(36).slice(2, 11)}`,
      name: "Default",
      color: "#3B82F6",
      createdAt: now,
      lastUsedAt: now,
    };

    const profileData: ProfileData = {
      vocabulary: existingVocabulary ? JSON.parse(existingVocabulary) : [],
      settings: existingSettings ? JSON.parse(existingSettings) : defaultSettings,
      learningStats: existingStats ? JSON.parse(existingStats) : defaultLearningStats,
    };

    saveAllProfiles([profile]);
    saveProfileData(profile.id, profileData);
    setCurrentProfileId(profile.id);

    console.log("Migrated existing data to profile system");
  } else {
    // No existing data, just initialize
    initializeProfiles();
  }
}
