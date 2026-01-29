import { TypingQuizClient } from "@/components/typing-quiz-client";
import { type Locale } from "@/lib/client-i18n";

export default async function TypingQuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;

  return <TypingQuizClient lang={lang} />;
}
