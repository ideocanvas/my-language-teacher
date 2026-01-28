import { VocabularyEntry, SyncData, SyncStats } from "./vocabulary-types";

/**
 * Sync Manager for P2P vocabulary synchronization
 */

export class SyncManager {
  private lastSyncTime: number = 0;
  private syncInProgress = false;

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
   * Merge local and remote vocabulary entries
   * Uses timestamp-based merge strategy
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

    // Add all local entries
    localEntries.forEach((entry) => {
      merged.set(entry.id, entry);
    });

    // Merge remote entries
    remoteEntries.forEach((remoteEntry) => {
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
        // New entry from remote
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
   * Prepare sync data for sending
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
   * Process received sync data
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
   * Get sync request for initiating sync
   */
  createSyncRequest(): { lastSync: number } {
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