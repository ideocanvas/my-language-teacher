"use client";

import { useState, useEffect, useCallback } from "react";
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

interface SyncPanelProps {
  readonly role: "sender" | "receiver";
  readonly sessionId?: string;
}

export function SyncPanel({ role, sessionId }: SyncPanelProps) {
  const params = useParams();
  const lang = (params?.lang as string) || "en";
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
    verificationCode,
    submitVerificationCode,
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
    if (!isVerified) {
      toast.error("Please verify the connection first");
      return;
    }

    try {
      const result = await startSync();
      if (!result.success) {
        toast.error(result.error || "Sync failed");
      }
    } catch (err) {
      toast.error("Failed to start sync");
      console.error("Sync error:", err);
    }
  };

  const handleReset = () => {
    resetSync();
    disconnect();
    setLogs([]);
    if (role === "receiver") {
      setLocalSessionId("");
      setShowQR(false);
    }
  };

  const [inputCode, setInputCode] = useState("");

  const handleSubmitCode = () => {
    if (inputCode.length === 6) {
      submitVerificationCode(inputCode);
    } else {
      toast.error("Please enter a 6-digit code");
    }
  };

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
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            P2P Sync
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
                <p className="font-medium text-gray-900">This Device (Sender)</p>
                <p className="text-sm text-gray-600">Initiates the sync connection</p>
              </div>
            </>
          ) : (
            <>
              <Laptop className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-medium text-gray-900">This Device (Receiver)</p>
                <p className="text-sm text-gray-600">Waits for sender to connect</p>
              </div>
            </>
          )}
        </div>

        {/* Profile & Language Info */}
        {currentProfile && settings && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm font-medium text-blue-900 mb-1">Current Profile</p>
            <p className="text-sm text-blue-700">
              {currentProfile.name} • {settings.sourceLanguage} → {settings.targetLanguage}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Both devices must have matching source and target languages to sync
            </p>
          </div>
        )}

        {/* QR Code for Receiver */}
        {role === "receiver" && showQR && syncUrl && (
          <div className="mb-4">
            <QRCodeGenerator url={syncUrl} />
            <p className="text-sm text-gray-600 mt-2 text-center">
              Scan this QR code with the sender device
            </p>
          </div>
        )}

        {/* Verification Code Display for Sender */}
        {role === "sender" && connectionState === "verifying" && verificationCode && (
          <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm font-medium text-yellow-900 mb-2">
              Enter this code on the receiver device:
            </p>
            <p className="text-3xl font-bold text-yellow-700 tracking-widest text-center py-2">
              {verificationCode}
            </p>
          </div>
        )}

        {/* Verification Code Input for Receiver */}
        {role === "receiver" && connectionState === "verifying" && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Enter the verification code from the sender:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="flex-1 px-4 py-2 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSubmitCode}
                disabled={inputCode.length !== 6}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify
              </button>
            </div>
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
                <div>Added: {syncStatus.stats.remoteAdded}</div>
                <div>Updated: {syncStatus.stats.localUpdated}</div>
              </div>
            )}
          </div>
        )}

        {/* Last Sync */}
        <div className="mb-4 text-sm text-gray-600">
          Last sync: {formatLastSync()}
        </div>

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
              {syncing ? "Syncing..." : "Start Sync"}
            </button>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Reset Connection
          </button>
        </div>
      </div>

      {/* Connection Logger */}
      <ConnectionLogger logs={logs} />
    </div>
  );
}
