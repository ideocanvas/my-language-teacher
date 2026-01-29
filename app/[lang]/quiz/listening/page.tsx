import { ListeningQuizClient } from "@/components/listening-quiz-client";
import { type Locale } from "@/lib/client-i18n";

export default async function ListeningQuizPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;

  return <ListeningQuizClient lang={lang} />;
}
