import { VocabularyEntry, SyncData, SyncStats, SyncProfileInfo, SyncRequestMessage, SyncResponseMessage, SyncCompleteMessage, SyncErrorMessage } from "./vocabulary-types";

/**
 * Sync Manager for P2P vocabulary synchronization
 * Handles bidirectional sync with profile validation
 */

export interface SyncOptions {
  profileId: string;
  profileName: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface SyncResult {
  success: boolean;
  stats?: SyncStats;
  error?: string;
}

export class SyncManager {
  private lastSyncTime: number = 0;
  private syncInProgress = false;
  private currentOptions: SyncOptions | null = null;

  constructor() {
    this.loadLastSyncTime();
  }

  private loadLastSyncTime() {
    try {
      const saved = localStorage.getItem("vocabulary-last-sync");
      if (saved) {
        this.lastSyncTime = Number.parseInt(saved, 10);
      }
    } catch (err) {
      console.error("Failed to load last sync time:", err);
    }
  }

  private saveLastSyncTime() {
    try {
      localStorage.setItem("vocabulary-last-sync", this.lastSyncTime.toString());
    } catch (err) {
      console.error("Failed to save last sync time:", err);
    }
  }

  /**
   * Set current sync options (profile and language settings)
   */
  setSyncOptions(options: SyncOptions) {
    this.currentOptions = options;
  }

  /**
   * Get current sync options
   */
  getSyncOptions(): SyncOptions | null {
    return this.currentOptions;
  }

  /**
   * Validate that remote profile matches local profile
   * Returns true if profiles are compatible (same source/target languages)
   */
  validateProfileMatch(localOptions: SyncOptions, remoteProfile: SyncProfileInfo): { valid: boolean; reason?: string } {
    // Check if languages match
    if (localOptions.sourceLanguage !== remoteProfile.sourceLanguage) {
      return {
        valid: false,
        reason: `Source language mismatch: local (${localOptions.sourceLanguage}) vs remote (${remoteProfile.sourceLanguage})`
      };
    }

    if (localOptions.targetLanguage !== remoteProfile.targetLanguage) {
      return {
        valid: false,
        reason: `Target language mismatch: local (${localOptions.targetLanguage}) vs remote (${remoteProfile.targetLanguage})`
      };
    }

    return { valid: true };
  }

  /**
   * Create sync request message
   */
  createSyncRequest(allEntries: VocabularyEntry[]): SyncRequestMessage {
    if (!this.currentOptions) {
      throw new Error("Sync options not set");
    }

    // Filter entries updated since last sync
    const entriesToSend = allEntries.filter(
      (entry) => entry.updatedAt > this.lastSyncTime
    );

    return {
      type: "sync-request",
      profile: {
        profileId: this.currentOptions.profileId,
        profileName: this.currentOptions.profileName,
        sourceLanguage: this.currentOptions.sourceLanguage,
        targetLanguage: this.currentOptions.targetLanguage,
      },
      lastSync: this.lastSyncTime,
      vocabularyEntries: entriesToSend,
    };
  }

  /**
   * Create sync response message with vocabulary data
   */
  createSyncResponse(allEntries: VocabularyEntry[]): SyncResponseMessage {
    if (!this.currentOptions) {
      throw new Error("Sync options not set");
    }

    // Filter entries updated since last sync
    const entriesToSend = allEntries.filter(
      (entry) => entry.updatedAt > this.lastSyncTime
    );

    return {
      type: "sync-response",
      profile: {
        profileId: this.currentOptions.profileId,
        profileName: this.currentOptions.profileName,
        sourceLanguage: this.currentOptions.sourceLanguage,
        targetLanguage: this.currentOptions.targetLanguage,
      },
      vocabularyEntries: entriesToSend,
      timestamp: Date.now(),
    };
  }

  /**
   * Create sync complete message
   */
  createSyncComplete(stats: SyncStats): SyncCompleteMessage {
    return {
      type: "sync-complete",
      timestamp: Date.now(),
      stats,
    };
  }

  /**
   * Create sync error message
   */
  createSyncError(error: string): SyncErrorMessage {
    return {
      type: "sync-error",
      error,
    };
  }

  /**
   * Merge local and remote vocabulary entries
   * Uses timestamp-based merge strategy
   * Only adds missing entries, never deletes
   */
  mergeEntries(
    localEntries: VocabularyEntry[],
    remoteEntries: VocabularyEntry[]
  ): { entries: VocabularyEntry[]; stats: SyncStats } {
    const merged = new Map<string, VocabularyEntry>();
    const stats: SyncStats = {
      localAdded: 0,
      localUpdated: 0,
      remoteAdded: 0,
      remoteUpdated: 0,
      totalMerged: 0,
    };

    // Ensure arrays are defined
    const safeLocalEntries = localEntries || [];
    const safeRemoteEntries = remoteEntries || [];

    // Add all local entries
    safeLocalEntries.forEach((entry) => {
      if (entry?.id) {
        merged.set(entry.id, entry);
      }
    });

    // Merge remote entries
    safeRemoteEntries.forEach((remoteEntry) => {
      if (!remoteEntry?.id) return;

      const localEntry = merged.get(remoteEntry.id);

      if (localEntry) {
        // Entry exists on both sides - merge by timestamp
        if (remoteEntry.updatedAt > localEntry.updatedAt) {
          // Remote is newer - update local with remote data
          const mergedEntry: VocabularyEntry = {
            ...localEntry,
            ...remoteEntry,
            // Preserve local SRS data if remote's is older
            srsData:
              remoteEntry.srsData.nextReview > localEntry.srsData.nextReview
                ? remoteEntry.srsData
                : localEntry.srsData,
          };
          merged.set(remoteEntry.id, mergedEntry);
          stats.localUpdated++;
          stats.totalMerged++;
        } else if (localEntry.updatedAt > remoteEntry.updatedAt) {
          // Local is newer - no change needed (local will be sent to remote)
          stats.remoteUpdated++;
          stats.totalMerged++;
        }
        // If timestamps are equal, keep local (no stats change)
      } else {
        // New entry from remote - add to local
        merged.set(remoteEntry.id, remoteEntry);
        stats.remoteAdded++;
        stats.totalMerged++;
      }
    });

    return {
      entries: Array.from(merged.values()),
      stats,
    };
  }

  /**
   * Process received sync response
   * Validates profile and merges data
   */
  async processSyncResponse(
    localOptions: SyncOptions,
    response: SyncResponseMessage,
    localEntries: VocabularyEntry[],
    saveCallback: (entries: VocabularyEntry[]) => Promise<void>
  ): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { success: false, error: "Sync already in progress" };
    }

    this.syncInProgress = true;

    try {
      // Validate profile match
      const validation = this.validateProfileMatch(localOptions, response.profile);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      // Merge entries
      const { entries, stats } = this.mergeEntries(
        localEntries,
        response.vocabularyEntries
      );

      // Save merged entries
      await saveCallback(entries);

      // Update last sync time
      this.lastSyncTime = Math.max(this.lastSyncTime, response.timestamp);
      this.saveLastSyncTime();

      return { success: true, stats };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Prepare sync data for sending (legacy method)
   * Includes entries updated since last sync
   */
  prepareSyncData(allEntries: VocabularyEntry[]): SyncData {
    const entriesToSend = allEntries.filter(
      (entry) => entry.updatedAt > this.lastSyncTime
    );

    return {
      vocabularyEntries: entriesToSend,
      timestamp: Date.now(),
    };
  }

  /**
   * Process received sync data (legacy method)
   * Merges with local entries and updates last sync time
   */
  async processSyncData(
    localEntries: VocabularyEntry[],
    receivedData: SyncData,
    saveCallback: (entries: VocabularyEntry[]) => Promise<void>
  ): Promise<SyncStats> {
    if (this.syncInProgress) {
      throw new Error("Sync already in progress");
    }

    this.syncInProgress = true;

    try {
      // Merge entries
      const { entries, stats } = this.mergeEntries(
        localEntries,
        receivedData.vocabularyEntries
      );

      // Save merged entries
      await saveCallback(entries);

      // Update last sync time to the later of our last sync or received timestamp
      this.lastSyncTime = Math.max(this.lastSyncTime, receivedData.timestamp);
      this.saveLastSyncTime();

      return stats;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get sync request for initiating sync (legacy method)
   */
  createSyncRequestLegacy(): { lastSync: number } {
    return {
      lastSync: this.lastSyncTime,
    };
  }

  /**
   * Complete sync and update timestamp
   */
  completeSync(timestamp: number) {
    this.lastSyncTime = Math.max(this.lastSyncTime, timestamp);
    this.saveLastSyncTime();
  }

  /**
   * Reset sync state (for testing or manual reset)
   */
  resetSync() {
    this.lastSyncTime = 0;
    this.saveLastSyncTime();
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Check if sync is in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  syncManagerInstance ??= new SyncManager();
  return syncManagerInstance;
}
