import { VocabularyListClient } from "@/components/vocabulary-list-client";
import type { Locale } from "@/lib/client-i18n";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function VocabularyListPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <VocabularyListClient lang={lang as Locale} />;
}
