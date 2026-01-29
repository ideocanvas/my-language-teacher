"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSync } from "@/hooks/use-sync";
import { useProfiles } from "@/hooks/use-profiles";
import { useSettings } from "@/hooks/use-settings";
import { useWebRTC } from "@/hooks/use-webrtc";
import { ConnectionLogger, LogEntry } from "@/components/connection-logger";
import { QRCodeGenerator } from "@/components/qr-code-generator";
import { ConnectionStatus } from "@/components/connection-status";
import { Smartphone, Laptop, RefreshCw, CheckCircle, AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { getTranslations, type Locale } from "@/lib/client-i18n";

interface SyncPanelProps {
  readonly role: "sender" | "receiver";
  readonly sessionId?: string;
}

export function SyncPanel({ role, sessionId }: SyncPanelProps) {
  const params = useParams();
  const lang = (params?.lang as Locale) || "en";
  const t = useMemo(() => getTranslations(lang), [lang]);
  const { currentProfile } = useProfiles();
  const { settings } = useSettings();
  const {
    syncing,
    syncStatus,
    isVerified,
    initializeSync,
    startSync,
    resetSync,
    formatLastSync,
  } = useSync();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [localSessionId, setLocalSessionId] = useState<string>("");
  const hasAutoSynced = useRef(false);

  // Initialize sync with profile and language settings
  useEffect(() => {
    if (currentProfile && settings) {
      initializeSync({
        profileId: currentProfile.id,
        profileName: currentProfile.name,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
      });
    }
  }, [currentProfile, settings, initializeSync]);

  // WebRTC hook for connection
  const {
    connectionState,
    disconnect,
    peerId,
  } = useWebRTC({
    role,
    sessionId: sessionId || localSessionId,
    onLog: useCallback((log: LogEntry) => {
      setLogs((prev) => [...prev, log]);
    }, []),
  });

  // Show QR code when peerId is available for receiver
  useEffect(() => {
    if (role === "receiver" && peerId) {
      setLocalSessionId(peerId);
      setShowQR(true);
    }
  }, [role, peerId]);

  const handleStartSync = async () => {
    console.log("[SYNC-PANEL] handleStartSync called, isVerified:", isVerified, "syncing:", syncing);

    if (!isVerified) {
      toast.error(t("sync.verifyFirst"));
      return;
    }

    try {
      console.log("[SYNC-PANEL] Calling startSync...");
      const result = await startSync();
      console.log("[SYNC-PANEL] startSync result:", result);
      if (!result.success) {
        toast.error(result.error || t("sync.failed"));
      }
    } catch (err) {
      toast.error(t("sync.error"));
      console.error("[SYNC-PANEL] Sync error:", err);
    }
  };

  const handleReset = () => {
    resetSync();
    disconnect();
    setLogs([]);
    hasAutoSynced.current = false; // Reset auto-sync flag
    if (role === "receiver") {
      setLocalSessionId("");
      setShowQR(false);
    }
  };

  // Auto-start sync when connection is verified and not already syncing
  // Only the SENDER should initiate sync to avoid conflicts
  // Only trigger once using ref to prevent multiple syncs
  useEffect(() => {
    if (role === "sender" && isVerified && !syncing && syncStatus.state === "idle" && !hasAutoSynced.current) {
      console.log("[SYNC-PANEL] Auto-starting sync after verification (once)");
      hasAutoSynced.current = true;
      void handleStartSync();
    }
  }, [role, isVerified, syncing, syncStatus.state]);

  const getStatusIcon = () => {
    switch (syncStatus.state) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "syncing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (syncStatus.state) {
      case "completed":
        return "bg-green-50 border-green-200 text-green-700";
      case "error":
        return "bg-red-50 border-red-200 text-red-700";
      case "syncing":
        return "bg-blue-50 border-blue-200 text-blue-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-600";
    }
  };

  // Build the sync URL for QR code with language prefix
  const syncUrl = globalThis.window !== undefined && localSessionId
    ? `${globalThis.location.origin}/${lang}/sync?sessionId=${localSessionId}&role=sender`
    : "";

  return (
    <div className="space-y-4">
      {/* QR Code for Receiver - Show at top */}
      {role === "receiver" && showQR && syncUrl && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("sync.scanToConnect")}</h3>
            <div className="flex justify-center">
              <QRCodeGenerator url={syncUrl} />
            </div>
            <p className="text-sm text-gray-600 mt-4">
              {t("sync.scanInstruction")}
            </p>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            {t("sync.title")}
          </h3>
          <ConnectionStatus
            state={connectionState}
            role={role}
          />
        </div>

        {/* Device Info */}
        <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          {role === "sender" ? (
            <>
              <Smartphone className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900">{t("sync.sender")}</p>
                <p className="text-sm text-gray-600">{t("sync.senderDesc")}</p>
              </div>
            </>
          ) : (
            <>
              <Laptop className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-medium text-gray-900">{t("sync.receiver")}</p>
                <p className="text-sm text-gray-600">{t("sync.receiverDesc")}</p>
              </div>
            </>
          )}
        </div>

        {/* Profile & Language Info */}
        {currentProfile && settings && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm font-medium text-blue-900 mb-1">{t("sync.currentProfile")}</p>
            <p className="text-sm text-blue-700">
              {currentProfile.name} • {settings.sourceLanguage} → {settings.targetLanguage}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {t("sync.languageMatchWarning")}
            </p>
          </div>
        )}



        {/* Sync Status */}
        {syncStatus.state !== "idle" && (
          <div className={`mb-4 p-4 rounded-lg border ${getStatusColor()}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">{syncStatus.message}</span>
            </div>
            {syncStatus.stats && (
              <div className="mt-2 text-sm grid grid-cols-2 gap-2">
                <div>{t("sync.added")}: {syncStatus.stats.remoteAdded}</div>
                <div>{t("sync.updated")}: {syncStatus.stats.localUpdated}</div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {isVerified && syncStatus.state !== "syncing" && (
            <button
              onClick={handleStartSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncing ? t("sync.syncing") : t("sync.startSync")}
            </button>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            {t("sync.reset")}
          </button>
        </div>
      </div>

      {/* Connection Logger - Collapsible */}
      {logs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <ConnectionLogger logs={logs} />
        </div>
      )}
    </div>
  );
}
