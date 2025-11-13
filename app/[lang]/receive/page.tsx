"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Smartphone, Shield, Clock, Copy } from "lucide-react";
import Link from "next/link";
import { QRCodeGenerator } from "@/components/qr-code-generator";
import { ConnectionStatus } from "@/components/connection-status";
import { ConnectionLogger, LogEntry } from "@/components/connection-logger";
import { toast } from "sonner";
import PeerManager, { ConnectionState, FileTransfer } from "@/services/peer-manager";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/client-i18n";
import BuyMeACoffee from "@/components/BuyMeACoffee";

export default function ReceivePage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [t, setT] = useState(() => getTranslations("en"));
  
  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      const validLang = resolvedParams.lang === "zh" ? "zh" : "en";
      setLang(validLang);
      setT(() => getTranslations(validLang));
    };
    loadParams();
  }, [params]);
  
  const [peerId, setPeerId] = useState<string>("");
  const [shortCode, setShortCode] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<Array<{ name: string; blob: Blob }>>([]);
  const [enteredCode, setEnteredCode] = useState<string>("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("waiting");
  const [files, setFiles] = useState<FileTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleLog = (log: LogEntry) => {
    setLogs((prev) => [...prev, log]);
  };

  const handleFileReceived = (file: Blob, metadata: { name: string; type: string }) => {
    setReceivedFiles((prev) => [...prev, { name: metadata.name, blob: file }]);
    toast.success(`${t("receive.fileReceived")}: ${metadata.name}`);

    // Auto-download
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = metadata.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
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
        
        // Update peer ID when available
        if (managerState.peerId && !peerId) {
          setPeerId(managerState.peerId);
          
          // Register short code when peer ID is available
          registerShortCode(managerState.peerId);
        }
      },
      onFileReceived: handleFileReceived,
      onLog: handleLog,
    });

    // Initialize connection as receiver
    peerManager.connect("receiver", "").then((id) => {
      console.log("Receiver connected with peer ID:", id);
      setPeerId(id);
      registerShortCode(id);
    }).catch((err) => {
      console.error("Failed to connect as receiver:", err);
      setError(t("receive.connectionFailed"));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const registerShortCode = async (peerId: string) => {
    try {
      const response = await fetch("/api/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShortCode(data.shortCode);
        handleLog({ timestamp: new Date(), level: "success", message: `${t("receive.shortCodeGenerated")}: ${data.shortCode}` });
      } else {
        // Fallback to using peer ID if short code generation fails
        setShortCode(peerId);
        handleLog({ timestamp: new Date(), level: "warning", message: t("receive.shortCodeFailed"), details: data.error });
        handleLog({ timestamp: new Date(), level: "info", message: "Falling back to using peer ID as connection code" });
      }
    } catch (err) {
      // Fallback to using peer ID if API call fails
      setShortCode(peerId);
      handleLog({ timestamp: new Date(), level: "warning", message: t("receive.registerFailed"), details: String(err) });
      handleLog({ timestamp: new Date(), level: "info", message: "Falling back to using peer ID as connection code" });
    }
  };

  const handleVerificationSubmit = () => {
    if (enteredCode.trim().length === 6) {
      const peerManager = PeerManager.getInstance();
      const success = peerManager.submitVerificationCode(enteredCode.trim());
      if (!success) {
        toast.error(t("receive.verificationFailed"));
      }
    } else {
      toast.error(t("receive.enter6DigitCode"));
    }
  }

  const connectionUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${lang}/send?session=${shortCode || peerId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast.success(t("receive.linkCopied"));
    } catch (err) {
      toast.error(t("receive.copyFailed"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/${lang}`}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t("common.backToHome")}</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{t("receive.title")}</h1>
            <LanguageSwitcher currentLocale={lang} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-8">
                <ConnectionStatus
                  state={connectionState}
                  role="receiver"
                  filesCount={files.length}
                />

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  <strong>{t("receive.connectionMethod")}:</strong> WebRTC (PeerJS)
                </div>

                {/* Waiting for connection */}
                {(connectionState === "waiting" || connectionState === "connecting") && (
                  <div className="text-center">
                    {!peerId ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">{t("receive.initializing")}</p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-8">
                          <Smartphone className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                          <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            {t("receive.readyToReceive")}
                          </h2>
                          <p className="text-gray-600 mb-8">
                            {t("receive.askSender")}
                          </p>
                        </div>

                        <div className="max-w-sm mx-auto mb-8">
                          <QRCodeGenerator url={connectionUrl} />
                        </div>

                        {/* Copy Link Button */}
                        <div className="max-w-md mx-auto mb-6">
                          <button
                            onClick={handleCopyLink}
                            disabled={!peerId}
                            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Copy className="w-4 h-4" />
                            <span>{copySuccess ? t("receive.copied") : t("receive.copyLink")}</span>
                          </button>
                          <p className="text-xs text-gray-600 text-center mt-2">
                            {t("receive.copyLinkDescription")}
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 mb-6">
                          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
                            {t("receive.connectionCode")}
                          </p>
                          <div className="bg-white border-2 border-blue-300 rounded-lg p-4 mb-3">
                            <p className="text-3xl font-bold text-center font-mono tracking-wider text-blue-600">
                              {shortCode ? shortCode : (peerId ? t("receive.generating") : t("receive.connecting"))}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 text-center">
                            {t("receive.shareCode")}
                          </p>
                        </div>

                        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4" />
                            <span>{t("receive.encrypted")}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>{t("receive.timeout")}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Verifying */}
                {connectionState === "verifying" && (
                  <div className="text-center py-8">
                    <div className="max-w-md mx-auto bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8">
                      <Shield className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t("receive.verificationRequired")}
                      </h2>

                      <p className="text-gray-600 mb-6">
                        {t("receive.enterVerificationCode")}
                      </p>
                      
                      {verificationCode && (
                        <div className="mb-4 p-4 bg-white border-2 border-yellow-400 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">{t("receive.senderVerificationCode")}:</p>
                          <div className="text-2xl font-bold font-mono tracking-widest text-yellow-600">
                            {verificationCode}
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-6">
                        <input
                          type="text"
                          value={enteredCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setEnteredCode(value);
                          }}
                          placeholder={t("receive.codePlaceholder")}
                          maxLength={6}
                          className="w-full px-4 py-4 text-center text-4xl font-bold font-mono tracking-widest border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        />
                      </div>
                      <button
                        onClick={handleVerificationSubmit}
                        disabled={enteredCode.length !== 6}
                        className="w-full bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("receive.verifyConnection")}
                      </button>

                      <p className="text-sm text-gray-600 mt-4">
                        {t("receive.verificationDescription")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Connected and receiving */}
                {(connectionState === "connected" || connectionState === "transferring") && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">{t("receive.fileTransferProgress")}</h3>
                    {files.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>{t("receive.waitingForFiles")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="border rounded-lg p-4 bg-gray-50"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium truncate">{file.name}</span>
                              <span className="text-sm text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              {file.status === "completed" ? `✓ ${t("receive.complete")}` : `${Math.round(file.progress)}%`}
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
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t("receive.connectionClosed")}
                      </h2>
                      <p className="text-gray-600 mb-8">
                        {t("receive.connectionTerminated")}
                      </p>
                    </div>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      {t("receive.startNewSession")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection Logs Sidebar */}
          <div className="lg:col-span-1">
            <ConnectionLogger logs={logs} maxHeight="600px" />
          </div>
        </div>
        
        <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
      </main>
    </div>
  );
}