"use client";

import { AppNavigation } from "@/components/app-navigation";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { useSettings } from "@/hooks/use-settings";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { languageStorage } from "@/lib/language-storage";
import {
  Download,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  RefreshCw
} from "lucide-react";
import { SyncPanel } from "@/components/sync-panel";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { getTranslations, type Locale } from "@/lib/client-i18n";

interface SettingsClientProps {
  lang: Locale;
}

export function SettingsClient({ lang }: Readonly<SettingsClientProps>) {
  const { settings, loading, updateSettings, resetSettings } = useSettings();
  const { vocabulary } = useVocabulary();
  const t = useMemo(() => getTranslations(lang), [lang]);

  const [activeTab, setActiveTab] = useState<"general" | "data" | "sync">("general");

  // Form states
  const [dailyReviewGoal, setDailyReviewGoal] = useState(20);
  const [easyBonus, setEasyBonus] = useState(1.3);
  const [intervalModifier, setIntervalModifier] = useState(1);

  useEffect(() => {
    if (settings) {
      setDailyReviewGoal(settings.dailyReviewGoal);
      setEasyBonus(settings.srsSettings.easyBonus);
      setIntervalModifier(settings.srsSettings.intervalModifier);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings({
        dailyReviewGoal,
        srsSettings: {
          easyBonus,
          intervalModifier,
        },
      });
      toast.success(t("settings.actions.saveSuccess"));
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error(t("errors.failedToSave"));
    }
  };

  const handleReset = async () => {
    if (globalThis.confirm(t("settings.actions.resetConfirm"))) {
      try {
        await resetSettings();
        toast.success(t("settings.actions.resetSuccess"));
      } catch (err) {
        console.error("Failed to reset settings:", err);
        toast.error(t("errors.failedToSave"));
      }
    }
  };

  const handleExport = async () => {
    try {
      const data = await languageStorage.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `language-teacher-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("settings.actions.exportSuccess"));
    } catch (err) {
      console.error("Failed to export data:", err);
      toast.error(t("errors.failedToSave")); // Using generic error for now
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const cleanImport = globalThis.confirm(
        t("settings.actions.importConfirm")
      );

      await languageStorage.importData(data, cleanImport);
      toast.success(
        cleanImport ? t("settings.actions.importSuccessClean") : t("settings.actions.importSuccessMerge")
      );

      // Refresh vocabulary
      globalThis.location.reload();
    } catch (err) {
      console.error("Failed to import data:", err);
      toast.error(t("errors.failedToLoad")); 
    }
  };

  const handleClearData = async () => {
    if (globalThis.confirm(t("settings.actions.clearConfirm"))) {
      try {
        const allVocabulary = await languageStorage.getAllVocabulary();
        for (const entry of allVocabulary) {
          await languageStorage.deleteVocabulary(entry.id);
        }
        toast.success(t("settings.actions.clearSuccess"));
        globalThis.location.reload();
      } catch (err) {
        console.error("Failed to clear data:", err);
        toast.error(t("errors.failedToSave"));
      }
    }
  };

  const tabs = [
    { id: "general" as const, icon: SettingsIcon, label: t("settings.tabs.general") },
    { id: "data" as const, icon: Download, label: t("settings.tabs.data") },
    { id: "sync" as const, icon: RefreshCw, label: t("settings.tabs.sync") },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t("settings.header.title")}</h1>
          <p className="text-sm sm:text-base text-gray-600">{t("settings.header.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">{t("common.loading")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* General Settings */}
            {activeTab === "general" && (
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                    {t("settings.general.languageSettings")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label htmlFor="sourceLanguage" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        {t("settings.general.sourceLanguage")}
                      </label>
                      <select
                        id="sourceLanguage"
                        value={settings?.sourceLanguage}
                        onChange={(e) =>
                          updateSettings({ sourceLanguage: e.target.value })
                        }
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      >
                         <option value="en">{t("settings.languages.en")}</option>
                        <option value="zh">{t("settings.languages.zh")}</option>
                        <option value="zh-TW">{t("settings.languages.zh-TW")}</option>
                        <option value="ja">{t("settings.languages.ja")}</option>
                        <option value="ko">{t("settings.languages.ko")}</option>
                        <option value="es">{t("settings.languages.es")}</option>
                        <option value="fr">{t("settings.languages.fr")}</option>
                        <option value="de">{t("settings.languages.de")}</option>
                        <option value="it">{t("settings.languages.it")}</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="targetLanguage" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                         {t("settings.general.targetLanguage")}
                      </label>
                      <select
                        id="targetLanguage"
                        value={settings?.targetLanguage}
                        onChange={(e) =>
                          updateSettings({ targetLanguage: e.target.value })
                        }
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      >
                         <option value="zh">{t("settings.languages.zh")}</option>
                        <option value="zh-TW">{t("settings.languages.zh-TW")}</option>
                        <option value="en">{t("settings.languages.en")}</option>
                        <option value="ja">{t("settings.languages.ja")}</option>
                        <option value="ko">{t("settings.languages.ko")}</option>
                        <option value="es">{t("settings.languages.es")}</option>
                        <option value="fr">{t("settings.languages.fr")}</option>
                        <option value="de">{t("settings.languages.de")}</option>
                        <option value="it">{t("settings.languages.it")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                     {t("settings.general.srsSettings")}
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label htmlFor="dailyReviewGoal" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        {t("settings.general.dailyGoal")}
                      </label>
                      <input
                        id="dailyReviewGoal"
                        type="number"
                        min="1"
                        max="100"
                        value={dailyReviewGoal}
                        onChange={(e) => setDailyReviewGoal(Number.parseInt(e.target.value) || 20)}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t("settings.general.dailyGoalDesc")}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="easyBonus" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                         {t("settings.general.easyBonus")}
                      </label>
                      <input
                        id="easyBonus"
                        type="number"
                        min="1.0"
                        max="2.0"
                        step="0.1"
                        value={easyBonus}
                        onChange={(e) => setEasyBonus(Number.parseFloat(e.target.value) || 1.3)}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t("settings.general.easyBonusDesc")}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="intervalModifier" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                         {t("settings.general.intervalModifier")}
                      </label>
                      <input
                        id="intervalModifier"
                        type="number"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={intervalModifier}
                        onChange={(e) => setIntervalModifier(Number.parseFloat(e.target.value) || 1)}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                         {t("settings.general.intervalModifierDesc")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Management */}
            {activeTab === "data" && (
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                     {t("settings.data.exportImport")}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                     {t("settings.data.exportImportDesc")}
                  </p>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    <button
                      onClick={handleExport}
                      disabled={vocabulary.length === 0}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span> {t("settings.data.export")}</span>
                    </button>
                    <label className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors cursor-pointer text-sm sm:text-base">
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span> {t("settings.data.import")}</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                     {t("settings.data.stats")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {vocabulary.length}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600"> {t("settings.data.totalWords")}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {vocabulary.filter((v) => v.tags.length > 0).length}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600"> {t("settings.data.tagged")}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {
                          new Set(vocabulary.flatMap((v) => v.tags)).size
                        }
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600"> {t("settings.data.tags")}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {vocabulary.filter((v) => v.exampleSentences.length > 0).length}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600"> {t("settings.data.withExamples")}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-red-600 mb-3 sm:mb-4">
                     {t("settings.data.dangerZone")}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                     {t("settings.data.dangerZoneDesc")}
                  </p>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    <button
                      onClick={handleClearData}
                      disabled={vocabulary.length === 0}
                      className="flex items-center space-x-2 border border-red-300 text-red-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>{t("settings.data.clearData")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sync */}
            {activeTab === "sync" && (
              <div className="p-4 sm:p-6">
                <SyncPanel role="receiver" />
              </div>
            )}

            {/* Save/Reset buttons */}
            <div className="border-t bg-gray-50 p-4 sm:p-6">
              <div className="flex flex-wrap gap-3 sm:gap-4 justify-end">
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-200 transition-colors text-sm sm:text-base"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span> {t("settings.actions.reset")}</span>
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span> {t("settings.actions.save")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
