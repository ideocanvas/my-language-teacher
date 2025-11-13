"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { ConnectionStatus } from "@/components/connection-status";
import { ConnectionLogger, LogEntry } from "@/components/connection-logger";
import PeerManager, { ConnectionState, FileTransfer } from "@/services/peer-manager";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/client-i18n";
import BuyMeACoffee from "@/components/BuyMeACoffee";

function SendPageContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const lang = (params.lang === "zh" ? "zh" : "en") as "en" | "zh";
  const t = getTranslations(lang);
  
  const sessionId = searchParams?.get("session");
  const [manualCode, setManualCode] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("waiting");
  const [files, setFiles] = useState<FileTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleLog = (log: LogEntry) => {
    setLogs((prev) => [...prev, log]);
  };

  useEffect(() => {
    if (!sessionId) return;

    const peerManager = PeerManager.getInstance();
    
    // Subscribe to state changes
    const unsubscribe = peerManager.subscribe({
      onConnectionStateChange: (state: ConnectionState) => {
        setConnectionState(state);
        
        // Update other state from peer manager
        const managerState = peerManager.getState();
        setFiles(managerState.files);
        setError(managerState.error);
        setVerificationCode(managerState.verificationCode);
        setIsVerified(managerState.isVerified);
      },
      onLog: handleLog,
    });

    const connectWithShortCode = async () => {
      try {
        // Check if sessionId is a short code (6 characters alphanumeric)
        if (sessionId.length === 6 && /^[A-Z0-9]{6}$/i.test(sessionId)) {
          // Lookup peer ID from short code
          handleLog({ timestamp: new Date(), level: "info", message: "Looking up peer ID from short code", details: `Code: ${sessionId}` });
          const response = await fetch(`/api/codes?shortCode=${sessionId}`);
          const data = await response.json();
          
          if (data.success) {
            handleLog({ timestamp: new Date(), level: "success", message: "Found peer ID from short code", details: `Peer ID: ${data.peerId}` });
            // Connect using the full peer ID
            await peerManager.connect("sender", data.peerId);
          } else {
            handleLog({ timestamp: new Date(), level: "error", message: "Failed to lookup short code", details: data.error });
            setError("Invalid connection code - please check and try again");
            return;
          }
        } else {
          // Assume it's a full peer ID (backward compatibility)
          handleLog({ timestamp: new Date(), level: "info", message: "Using direct peer ID connection" });
          await peerManager.connect("sender", sessionId);
        }
      } catch (err) {
        console.error("Failed to connect as sender:", err);
        setError("Failed to connect to receiver");
      }
    };

    connectWithShortCode();

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  const handleManualCodeSubmit = () => {
    if (manualCode.trim()) {
      window.location.href = `/${lang}/send?session=${manualCode.toLowerCase()}`;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
      const filesArray = Array.from(fileList);
      const peerManager = PeerManager.getInstance();
      await peerManager.sendFiles(filesArray);
    }
  };

  if (!sessionId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="text-center">
            <Upload className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("send.connectToReceiver")}</h2>
            <p className="text-gray-600 mb-8">
              {t("send.enterConnectionCode")}
            </p>

            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("send.connectionCode")}
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  placeholder={t("send.enterCodeFromReceiver")}
                  className="w-full px-4 py-3 text-center text-xl font-mono uppercase border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <button
                onClick={handleManualCodeSubmit}
                disabled={!manualCode.trim()}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition-colors mb-4"
              >
                {t("send.connect")}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{t("common.or")}</span>
                </div>
              </div>

              <Link href={`/${lang}`} className="text-green-600 hover:text-green-700 font-medium">
                ← {t("common.scanQRCodeInstead")}
              </Link>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <ConnectionLogger logs={logs} maxHeight="400px" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ConnectionStatus state={connectionState} role="sender" filesCount={files.length} />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <strong>{t("common.connectionMethod")}:</strong> {t("common.webrtcPeerJS")}
        </div>

        {/* Connecting */}
        {connectionState === "connecting" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("send.connectingToReceiver")}</h2>
            <p className="text-gray-600">{t("send.establishingConnection")}</p>
          </div>
        )}

        {/* Verifying */}
        {connectionState === "verifying" && (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("common.verificationRequired")}</h2>
              <p className="text-gray-600 mb-6">
                {t("send.shareCodeForVerification")}
              </p>
              <div className="bg-white border-4 border-yellow-400 rounded-lg p-6 mb-4">
                <div className="text-4xl font-bold text-gray-900 tracking-widest">
                  {verificationCode ? (
                    verificationCode
                  ) : (
                    <div className="animate-pulse text-gray-400">{t("common.generating")}</div>
                  )}
                </div>
              </div>
              {verificationCode && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✅ {t("send.verificationCodeSent")}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {t("send.receiverMustEnterCode")}
              </p>
            </div>
          </div>
        )}

        {/* Connected and ready to send */}
        {(connectionState === "connected" || connectionState === "transferring") && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">{t("send.sendFiles")}</h3>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <span className="text-green-600 font-semibold hover:text-green-700">
                  {t("send.clickToSelectFiles")}
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={connectionState === "transferring"}
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">{t("send.multipleFilesSupported")}</p>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium truncate">{file.name}</span>
                      <span className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {file.status === "completed" ? `✓ ${t("common.sent")}` : `${Math.round(file.progress)}%`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disconnected */}
        {connectionState === "disconnected" && (
          <div className="text-center">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("common.connectionClosed")}</h2>
              <p className="text-gray-600 mb-8">
                {t("send.connectionTerminated")}
              </p>
            </div>
            <Link
              href={`/${lang}`}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {t("common.backToHome")}
            </Link>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <ConnectionLogger logs={logs} maxHeight="600px" />
      </div>
    </div>
  );
}

export default async function SendPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const validLang = (lang === "zh" ? "zh" : "en") as "en" | "zh";
  const t = getTranslations(validLang);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/${validLang}`}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t("common.backToHome")}</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{t("send.title")}</h1>
            <LanguageSwitcher currentLocale={validLang} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Suspense fallback={<div>{t("common.loading")}</div>}>
          <SendPageContent />
        </Suspense>
        
        <BuyMeACoffee language={validLang === "zh" ? "zh-TW" : "en"} />
      </main>
    </div>
  );
}