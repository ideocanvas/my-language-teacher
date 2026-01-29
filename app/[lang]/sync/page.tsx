"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { SyncPanel } from "@/components/sync-panel";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { locales, defaultLocale, type Locale, getTranslations } from "@/lib/client-i18n";

export default function SyncPage({ params }: { params: Promise<{ lang: string }> }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const sessionId = searchParams.get("sessionId");
  const roleParam = searchParams.get("role");

  // Default to sender role if coming from QR code scan
  const role = roleParam === "receiver" ? "receiver" : "sender";

  // Extract current locale from pathname
  const currentLocale = useMemo<Locale>(() => {
    if (!pathname) return defaultLocale;
    const segments = pathname.split('/');
    const firstSegment = segments[1];
    if (locales.includes(firstSegment as Locale)) {
      return firstSegment as Locale;
    }
    return defaultLocale;
  }, [pathname]);

  const t = useMemo(() => getTranslations(currentLocale), [currentLocale]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/${currentLocale}/settings`}
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
    </div>
  );
}
