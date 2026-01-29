import { Suspense } from "react";
import { SyncClient } from "@/components/sync-client";
import type { Locale } from "@/lib/client-i18n";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function SyncPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <Suspense fallback={null}>
      <SyncClient lang={lang as Locale} />
    </Suspense>
  );
}
