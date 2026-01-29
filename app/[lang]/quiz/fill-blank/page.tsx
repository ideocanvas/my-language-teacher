import { FillBlankQuizClient } from "@/components/fill-blank-quiz-client";
import { type Locale } from "@/lib/client-i18n";

export default async function FillBlankQuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;

  return <FillBlankQuizClient lang={lang} />;
}
