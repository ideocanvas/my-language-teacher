"use client";

import { AppNavigation } from "@/components/app-navigation";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { settings, loading, updateSettings, resetSettings } = useSettings();
  const { vocabulary } = useVocabulary();

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
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleReset = async () => {
    if (globalThis.confirm("Are you sure you want to reset all settings to defaults?")) {
      try {
        await resetSettings();
        toast.success("Settings reset to defaults");
      } catch (err) {
        console.error("Failed to reset settings:", err);
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
      toast.success("Data exported successfully");
    } catch (err) {
      console.error("Failed to export data:", err);
      toast.error("Failed to export data");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const cleanImport = globalThis.confirm(
        "Do you want to clear existing data before importing? (Cancel to merge)"
      );

      await languageStorage.importData(data, cleanImport);
      toast.success(
        cleanImport ? "Data imported (clean)" : "Data imported (merged)"
      );

      // Refresh vocabulary
      globalThis.location.reload();
    } catch (err) {
      console.error("Failed to import data:", err);
      toast.error("Failed to import data. Please check the file format.");
    }
  };

  const handleClearData = async () => {
    if (globalThis.confirm("Are you sure you want to clear all vocabulary data? This cannot be undone.")) {
      try {
        const allVocabulary = await languageStorage.getAllVocabulary();
        for (const entry of allVocabulary) {
          await languageStorage.deleteVocabulary(entry.id);
        }
        toast.success("All data cleared");
        globalThis.location.reload();
      } catch (err) {
        console.error("Failed to clear data:", err);
        toast.error("Failed to clear data");
      }
    }
  };

  const tabs = [
    { id: "general" as const, icon: SettingsIcon, label: "General" },
    { id: "data" as const, icon: Download, label: "Data Management" },
    { id: "sync" as const, icon: RefreshCw, label: "Sync" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure your learning experience</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* General Settings */}
            {activeTab === "general" && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Language Settings
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 mb-2">
                        Source Language
                      </label>
                      <select
                        id="sourceLanguage"
                        value={settings?.sourceLanguage}
                        onChange={(e) =>
                          updateSettings({ sourceLanguage: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="zh">Chinese (Simplified)</option>
                        <option value="zh-TW">Chinese (Traditional)</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="targetLanguage" className="block text-sm font-medium text-gray-700 mb-2">
                        Target Language
                      </label>
                      <select
                        id="targetLanguage"
                        value={settings?.targetLanguage}
                        onChange={(e) =>
                          updateSettings({ targetLanguage: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="zh">Chinese (Simplified)</option>
                        <option value="zh-TW">Chinese (Traditional)</option>
                        <option value="en">English</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Spaced Repetition Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="dailyReviewGoal" className="block text-sm font-medium text-gray-700 mb-2">
                        Daily Review Goal
                      </label>
                      <input
                        id="dailyReviewGoal"
                        type="number"
                        min="1"
                        max="100"
                        value={dailyReviewGoal}
                        onChange={(e) => setDailyReviewGoal(Number.parseInt(e.target.value) || 20)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Number of words to review each day
                      </p>
                    </div>
                    <div>
                      <label htmlFor="easyBonus" className="block text-sm font-medium text-gray-700 mb-2">
                        Easy Card Bonus
                      </label>
                      <input
                        id="easyBonus"
                        type="number"
                        min="1.0"
                        max="2.0"
                        step="0.1"
                        value={easyBonus}
                        onChange={(e) => setEasyBonus(Number.parseFloat(e.target.value) || 1.3)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Multiplier for easy cards (default: 1.3)
                      </p>
                    </div>
                    <div>
                      <label htmlFor="intervalModifier" className="block text-sm font-medium text-gray-700 mb-2">
                        Interval Modifier
                      </label>
                      <input
                        id="intervalModifier"
                        type="number"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={intervalModifier}
                        onChange={(e) => setIntervalModifier(Number.parseFloat(e.target.value) || 1)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Multiplier for all intervals (default: 1.0)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Management */}
            {activeTab === "data" && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Export/Import Data
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Back up your vocabulary data or restore from a backup file
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleExport}
                      disabled={vocabulary.length === 0}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-5 h-5" />
                      <span>Export Data</span>
                    </button>
                    <label className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors cursor-pointer">
                      <Upload className="w-5 h-5" />
                      <span>Import Data</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Statistics
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {vocabulary.length}
                      </p>
                      <p className="text-sm text-gray-600">Total Words</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {vocabulary.filter((v) => v.tags.length > 0).length}
                      </p>
                      <p className="text-sm text-gray-600">Tagged</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {
                          new Set(vocabulary.flatMap((v) => v.tags)).size
                        }
                      </p>
                      <p className="text-sm text-gray-600">Tags</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {vocabulary.filter((v) => v.exampleSentences.length > 0).length}
                      </p>
                      <p className="text-sm text-gray-600">With Examples</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-red-600 mb-4">
                    Danger Zone
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Actions here cannot be undone
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleClearData}
                      disabled={vocabulary.length === 0}
                      className="flex items-center space-x-2 border border-red-300 text-red-600 px-6 py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Clear All Data</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sync */}
            {activeTab === "sync" && (
              <div className="p-6">
                <SyncPanel role="receiver" />
              </div>
            )}

            {/* Save/Reset buttons */}
            <div className="border-t bg-gray-50 p-6">
              <div className="flex flex-wrap gap-4 justify-end">
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Reset to Defaults</span>
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}