import { QuizHubClient } from "@/components/quiz-hub-client";
import { type Locale } from "@/lib/client-i18n";

export default async function QuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;

  return <QuizHubClient lang={lang} />;
}
