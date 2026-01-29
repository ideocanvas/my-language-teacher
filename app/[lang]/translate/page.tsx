import { TranslateClient } from "@/components/translate-client";
import type { Locale } from "@/lib/client-i18n";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function TranslatePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <TranslateClient lang={lang as Locale} />;
}
