"use client";

import { useSearchParams } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { SyncPanel } from "@/components/sync-panel";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SyncPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const roleParam = searchParams.get("role");

  // Default to sender role if coming from QR code scan
  const role = roleParam === "receiver" ? "receiver" : "sender";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/settings"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sync Device</h1>
          <p className="text-gray-600">
            {role === "sender"
              ? "Connect to another device to synchronize your vocabulary"
              : "Waiting for another device to connect"}
          </p>
        </div>

        {/* Sync Panel */}
        <SyncPanel role={role} sessionId={sessionId || undefined} />
      </main>
    </div>
  );
}
