import { SRSData } from "./vocabulary-types";

/**
 * SuperMemo 2 (SM-2) Algorithm Implementation
 * For calculating spaced repetition intervals
 */

export interface SRSRating {
  quality: 0 | 1 | 2 | 3 | 4 | 5;
}

// Quality ratings
export const RATING = {
  AGAIN: 0, // Failed - complete blackout
  HARD: 1, // Incorrect response; the correct one remembered
  GOOD: 3, // Correct response with slight hesitation
  EASY: 5, // Perfect response
} as const;

export type RatingType = keyof typeof RATING;

export function calculateNextReview(
  currentData: SRSData,
  rating: SRSRating["quality"],
  settings?: {
    easyBonus?: number;
    intervalModifier?: number;
  }
): SRSData {
  const { interval, repetition, efactor } = currentData;
  const easyBonus = settings?.easyBonus || 1.3;
  const intervalModifier = settings?.intervalModifier || 1;

  let newInterval: number;
  let newRepetition: number;

  // Update E-Factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEfactor =
    efactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (newEfactor < 1.3) {
    newEfactor = 1.3;
  }

  // Calculate new interval
  if (rating < 3) {
    // Failed - start over
    newInterval = 1;
    newRepetition = 0;
  } else {
    // Success
    if (repetition === 0) {
      // First successful review
      newInterval = 1;
    } else if (repetition === 1) {
      // Second successful review
      newInterval = 6;
    } else {
      // Subsequent reviews
      newInterval = Math.round(interval * newEfactor * intervalModifier);
    }
    newRepetition = repetition + 1;

    // Apply easy bonus for easy cards
    if (rating === 5) {
      newInterval = Math.round(newInterval * easyBonus);
    }
  }

  const nextReview = Date.now() + newInterval * 24 * 60 * 60 * 1000;

  return {
    interval: newInterval,
    repetition: newRepetition,
    efactor: newEfactor,
    nextReview,
  };
}

export function createInitialSRSData(): SRSData {
  return {
    interval: 0,
    repetition: 0,
    efactor: 2.5,
    nextReview: Date.now(), // Due immediately
  };
}

export function isDueForReview(srsData: SRSData): boolean {
  return Date.now() >= srsData.nextReview;
}

export function getDaysUntilReview(srsData: SRSData): number {
  const msUntilReview = srsData.nextReview - Date.now();
  return Math.max(0, Math.ceil(msUntilReview / (24 * 60 * 60 * 1000)));
}

export function getRatingLabel(rating: SRSRating["quality"]): string {
  switch (rating) {
    case 0:
      return "Again";
    case 1:
      return "Hard";
    case 2:
      return "Good";
    case 3:
      return "Good";
    case 4:
      return "Good";
    case 5:
      return "Easy";
    default:
      return "Good";
  }
}

export function getRatingColor(rating: SRSRating["quality"]): string {
  switch (rating) {
    case 0:
      return "text-red-600";
    case 1:
      return "text-orange-600";
    case 2:
    case 3:
      return "text-blue-600";
    case 4:
      return "text-blue-600";
    case 5:
      return "text-green-600";
    default:
      return "text-blue-600";
  }
}