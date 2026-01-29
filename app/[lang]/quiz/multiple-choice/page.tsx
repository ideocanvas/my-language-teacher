import { MultipleChoiceQuizClient } from "@/components/multiple-choice-quiz-client";
import { type Locale } from "@/lib/client-i18n";

export default async function MultipleChoiceQuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;

  return <MultipleChoiceQuizClient lang={lang} />;
}
