"use client";

import { useSearchParams } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { SyncPanel } from "@/components/sync-panel";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { getTranslations, type Locale } from "@/lib/client-i18n";

interface SyncClientProps {
  readonly lang: Locale;
}

export function SyncClient({ lang }: SyncClientProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const roleParam = searchParams.get("role");

  // Default to sender role if coming from QR code scan
  const role = roleParam === "receiver" ? "receiver" : "sender";

  const t = useMemo(() => getTranslations(lang), [lang]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/${lang}/settings`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t("sync.backToSettings")}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("sync.headerTitle")}</h1>
          <p className="text-gray-600">
            {role === "sender"
              ? t("sync.senderHeaderDesc")
              : t("sync.receiverHeaderDesc")}
          </p>
        </div>

        {/* Sync Panel */}
        <SyncPanel role={role} sessionId={sessionId || undefined} />
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
