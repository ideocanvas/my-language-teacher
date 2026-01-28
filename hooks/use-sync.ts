"use client";

import { useState, useCallback } from "react";
import { VocabularyEntry, SyncStats } from "@/lib/vocabulary-types";
import { languageStorage } from "@/lib/language-storage";
import { getSyncManager } from "@/lib/sync-manager";
import { toast } from "sonner";

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number>(0);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);

  const syncManager = getSyncManager();

  // Initialize last sync time
  useState(() => {
    setLastSync(syncManager.getLastSyncTime());
  });

  const prepareSyncData = useCallback(async (): Promise<{
    vocabularyEntries: VocabularyEntry[];
    lastSync: number;
  }> => {
    try {
      const allEntries = await languageStorage.getAllVocabulary();
      const syncData = syncManager.prepareSyncData(allEntries);
      const lastSyncTime = syncManager.getLastSyncTime();

      return {
        vocabularyEntries: syncData.vocabularyEntries,
        lastSync: lastSyncTime,
      };
    } catch (err) {
      console.error("Failed to prepare sync data:", err);
      throw err;
    }
  }, []);

  const processSyncData = useCallback(
    async (remoteData: { vocabularyEntries: VocabularyEntry[]; timestamp: number }): Promise<SyncStats> => {
      try {
        setSyncing(true);
        setSyncStats(null);

        const localEntries = await languageStorage.getAllVocabulary();
        const syncData = {
          vocabularyEntries: remoteData.vocabularyEntries,
          timestamp: remoteData.timestamp,
        };

        const stats = await syncManager.processSyncData(
          localEntries,
          syncData,
          async (entries) => {
            // Save merged entries
            await languageStorage.clearAllVocabulary();
            await languageStorage.bulkAddVocabulary(entries);
          }
        );

        syncManager.completeSync(remoteData.timestamp);
        setLastSync(syncManager.getLastSyncTime());
        setSyncStats(stats);

        if (stats.totalMerged > 0) {
          toast.success(
            `Sync complete! Added: ${stats.remoteAdded}, Updated: ${stats.localUpdated}`
          );
        } else {
          toast.info("Sync complete - no changes detected");
        }

        return stats;
      } catch (err) {
        console.error("Failed to process sync data:", err);
        toast.error("Sync failed");
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  const createSyncRequest = useCallback(() => {
    return syncManager.createSyncRequest();
  }, []);

  const resetSync = useCallback(() => {
    syncManager.resetSync();
    setLastSync(0);
    setSyncStats(null);
    toast.info("Sync state reset");
  }, []);

  const formatLastSync = useCallback((): string => {
    if (lastSync === 0) {
      return "Never";
    }

    const diff = Date.now() - lastSync;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else {
      return "Just now";
    }
  }, [lastSync]);

  return {
    syncing,
    lastSync,
    syncStats,
    prepareSyncData,
    processSyncData,
    createSyncRequest,
    resetSync,
    formatLastSync,
  };
}