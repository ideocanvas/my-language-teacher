import { DashboardClient } from "@/components/dashboard-client";
import { type Locale } from "@/lib/client-i18n";

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const lang = (resolvedParams.lang === "zh" ? "zh" : "en") as Locale;
  
  return <DashboardClient lang={lang} />;
}
