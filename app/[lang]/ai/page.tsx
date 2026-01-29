import { AIClient } from "@/components/ai-client";
import { type Locale } from "@/lib/client-i18n";

export default async function AIAssistantPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;
  
  return <AIClient lang={lang} />;
}
