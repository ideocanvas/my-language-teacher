import { SettingsClient } from "@/components/settings-client";
import type { Locale } from "@/lib/client-i18n";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <SettingsClient lang={lang as Locale} />;
}
