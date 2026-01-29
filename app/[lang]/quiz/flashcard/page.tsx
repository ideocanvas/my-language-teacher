import { FlashcardQuizClient } from "@/components/flashcard-quiz-client";
import { type Locale } from "@/lib/client-i18n";

export default async function FlashcardQuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;

  return <FlashcardQuizClient lang={lang} />;
}
