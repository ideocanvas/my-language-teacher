"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { VocabularyEntry, SyncStats, SyncMessage, SyncRequestMessage, SyncResponseMessage, SyncCompleteMessage, SyncErrorMessage } from "@/lib/vocabulary-types";
import { languageStorage } from "@/lib/language-storage";
import { getSyncManager, SyncOptions, SyncResult } from "@/lib/sync-manager";
import { toast } from "sonner";
import PeerManager from "@/services/peer-manager";

export type SyncState = "idle" | "connecting" | "syncing" | "completed" | "error";

export interface SyncStatus {
  state: SyncState;
  message: string;
  stats?: SyncStats;
  error?: string;
}

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", message: "" });
  const [isConnected, setIsConnected] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const syncManager = getSyncManager();
  const [lastSync, setLastSync] = useState<number>(() => syncManager.getLastSyncTime());
  const peerManagerRef = useRef<PeerManager | null>(null);
  const pendingResponseRef = useRef<((value: SyncResult) => void) | null>(null);

  // Initialize PeerManager subscription
  useEffect(() => {
    const peerManager = PeerManager.getInstance();
    peerManagerRef.current = peerManager;

    const unsubscribe = peerManager.subscribe({
      onConnectionStateChange: (state: string) => {
        setIsConnected(state === "connected");
        setIsVerified(peerManager.getState().isVerified);

        if (state === "connected" && !syncing) {
          setSyncStatus({ state: "idle", message: "Connected and ready to sync" });
        } else if (state === "disconnected") {
          setSyncStatus({ state: "idle", message: "Disconnected" });
        }
      },
      onSyncMessage: (message: SyncMessage) => {
        handleSyncMessage(message);
      },
      onLog: (log) => {
        console.log(`[SYNC] ${log.level}: ${log.message}`, log.details || "");
      },
    });

    return () => {
      unsubscribe();
    };
  }, [syncing]);

  // Handle incoming sync messages
  const handleSyncMessage = useCallback(async (message: SyncMessage) => {
    switch (message.type) {
      case "sync-request": {
        // Received sync request from remote device
        await handleSyncRequest(message);
        break;
      }
      case "sync-response": {
        // Received sync response from remote device
        await handleSyncResponse(message);
        break;
      }
      case "sync-complete": {
        // Received sync complete from remote device
        handleSyncComplete(message);
        break;
      }
      case "sync-error": {
        // Received sync error from remote device
        handleSyncError(message);
        break;
      }
    }
  }, []);

  // Handle incoming sync request (we are the receiver)
  const handleSyncRequest = async (request: SyncRequestMessage) => {
    try {
      setSyncStatus({ state: "syncing", message: "Received sync request, processing..." });

      // Debug logging
      console.log("[SYNC] Received sync request:", {
        hasProfile: !!request?.profile,
        vocabCount: request?.vocabularyEntries?.length || 0,
        lastSync: request?.lastSync,
      });

      // Validate request has required data
      if (!request?.profile) {
        throw new Error("Invalid sync request: missing profile data");
      }

      // Get current sync options
      const localOptions = syncManager.getSyncOptions();
      if (!localOptions) {
        throw new Error("Sync options not configured");
      }

      // Validate profile match
      const validation = syncManager.validateProfileMatch(localOptions, request.profile);
      if (!validation.valid) {
        // Send error response
        const errorMessage = syncManager.createSyncError(validation.reason || "Profile mismatch");
        await peerManagerRef.current?.sendSyncMessage(errorMessage);
        setSyncStatus({ state: "error", message: validation.reason || "Profile mismatch" });
        return;
      }

      // Get local vocabulary entries
      const localEntries = await languageStorage.getAllVocabulary();

      // Process the sender's vocabulary data (merge into local)
      // Use empty array if vocabularyEntries is undefined
      const remoteEntries = request.vocabularyEntries || [];
      const result = await syncManager.processSyncResponse(
        localOptions,
        {
          type: "sync-response",
          profile: request.profile,
          vocabularyEntries: remoteEntries,
          timestamp: Date.now(),
        },
        localEntries,
        async (entries) => {
          await languageStorage.clearAllVocabulary();
          await languageStorage.bulkAddVocabulary(entries);
        }
      );

      if (result.success && result.stats) {
        setSyncStats(result.stats);
        setLastSync(syncManager.getLastSyncTime());

        // Create and send sync response with our data
        const response = syncManager.createSyncResponse(localEntries);
        await peerManagerRef.current?.sendSyncMessage(response);

        setSyncStatus({
          state: "completed",
          message: `Sync complete! Added: ${result.stats.remoteAdded}, Updated: ${result.stats.localUpdated}`,
          stats: result.stats,
        });

        toast.success(`Sync complete! Added: ${result.stats.remoteAdded}, Updated: ${result.stats.localUpdated}`);
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      setSyncStatus({ state: "error", message: errorMessage });
      toast.error(`Sync failed: ${errorMessage}`);

      // Send error message
      const errorMsg = syncManager.createSyncError(errorMessage);
      await peerManagerRef.current?.sendSyncMessage(errorMsg);
    }
  };

  // Handle incoming sync response (we are the sender)
  const handleSyncResponse = async (response: SyncResponseMessage) => {
    try {
      setSyncStatus({ state: "syncing", message: "Received sync response, merging data..." });

      // Get current sync options
      const localOptions = syncManager.getSyncOptions();
      if (!localOptions) {
        throw new Error("Sync options not configured");
      }

      // Get local entries
      const localEntries = await languageStorage.getAllVocabulary();

      // Process the sync response
      const result = await syncManager.processSyncResponse(
        localOptions,
        response,
        localEntries,
        async (entries) => {
          await languageStorage.clearAllVocabulary();
          await languageStorage.bulkAddVocabulary(entries);
        }
      );

      if (result.success && result.stats) {
        setSyncStats(result.stats);
        setLastSync(syncManager.getLastSyncTime());

        // Send complete message
        const completeMessage = syncManager.createSyncComplete(result.stats);
        await peerManagerRef.current?.sendSyncMessage(completeMessage);

        setSyncStatus({
          state: "completed",
          message: `Sync complete! Added: ${result.stats.remoteAdded}, Updated: ${result.stats.localUpdated}`,
          stats: result.stats,
        });

        toast.success(`Sync complete! Added: ${result.stats.remoteAdded}, Updated: ${result.stats.localUpdated}`);

        // Resolve pending promise if any
        if (pendingResponseRef.current) {
          pendingResponseRef.current(result);
          pendingResponseRef.current = null;
        }
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      setSyncStatus({ state: "error", message: errorMessage });
      toast.error(`Sync failed: ${errorMessage}`);

      // Send error message
      const errorMsg = syncManager.createSyncError(errorMessage);
      await peerManagerRef.current?.sendSyncMessage(errorMsg);

      // Reject pending promise if any
      if (pendingResponseRef.current) {
        pendingResponseRef.current({ success: false, error: errorMessage });
        pendingResponseRef.current = null;
      }
    }
  };

  // Handle sync complete message
  const handleSyncComplete = (message: SyncCompleteMessage) => {
    setSyncStats(message.stats);
    setLastSync(syncManager.getLastSyncTime());
    setSyncStatus({
      state: "completed",
      message: `Remote sync complete! Added: ${message.stats.remoteAdded}, Updated: ${message.stats.localUpdated}`,
      stats: message.stats,
    });

    // Resolve pending promise if any
    if (pendingResponseRef.current) {
      pendingResponseRef.current({ success: true, stats: message.stats });
      pendingResponseRef.current = null;
    }
  };

  // Handle sync error message
  const handleSyncError = (message: SyncErrorMessage) => {
    setSyncStatus({ state: "error", message: message.error });
    toast.error(`Sync error from remote: ${message.error}`);

    // Reject pending promise if any
    if (pendingResponseRef.current) {
      pendingResponseRef.current({ success: false, error: message.error });
      pendingResponseRef.current = null;
    }
  };

  // Initialize sync with profile and language settings
  const initializeSync = useCallback((options: SyncOptions) => {
    syncManager.setSyncOptions(options);
  }, []);

  // Start sync process (initiated by sender)
  const startSync = useCallback(async (): Promise<SyncResult> => {
    if (!isVerified) {
      toast.error("Connection not verified");
      return { success: false, error: "Connection not verified" };
    }

    const localOptions = syncManager.getSyncOptions();
    if (!localOptions) {
      toast.error("Sync options not configured");
      return { success: false, error: "Sync options not configured" };
    }

    setSyncing(true);
    setSyncStatus({ state: "syncing", message: "Preparing sync data..." });

    try {
      // Get local vocabulary entries
      const localEntries = await languageStorage.getAllVocabulary();
      console.log("[SYNC] Local vocabulary count:", localEntries.length);

      // Create and send sync request with vocabulary data
      const request = syncManager.createSyncRequest(localEntries);
      console.log("[SYNC] Sending sync request with vocab count:", request.vocabularyEntries.length);
      await peerManagerRef.current?.sendSyncMessage(request);

      setSyncStatus({ state: "syncing", message: "Waiting for sync response..." });

      // Wait for response (will be handled by handleSyncResponse)
      return new Promise((resolve) => {
        pendingResponseRef.current = resolve;

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingResponseRef.current) {
            pendingResponseRef.current({ success: false, error: "Sync timeout" });
            pendingResponseRef.current = null;
            setSyncStatus({ state: "error", message: "Sync timeout" });
            setSyncing(false);
          }
        }, 30000);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start sync";
      setSyncStatus({ state: "error", message: errorMessage });
      setSyncing(false);
      return { success: false, error: errorMessage };
    }
  }, [isVerified]);

  // Legacy method: Prepare sync data
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

  // Legacy method: Process sync data
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
    return syncManager.createSyncRequestLegacy();
  }, []);

  const resetSync = useCallback(() => {
    syncManager.resetSync();
    setLastSync(0);
    setSyncStats(null);
    setSyncStatus({ state: "idle", message: "" });
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
    syncStatus,
    isConnected,
    isVerified,
    initializeSync,
    startSync,
    prepareSyncData,
    processSyncData,
    createSyncRequest,
    resetSync,
    formatLastSync,
  };
}
