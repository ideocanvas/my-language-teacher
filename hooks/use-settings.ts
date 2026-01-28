"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSettings } from "@/lib/vocabulary-types";
import { languageStorage } from "@/lib/language-storage";
import { toast } from "sonner";

const DEFAULT_SETTINGS: AppSettings = {
  sourceLanguage: "en",
  targetLanguage: "zh",
  dailyReviewGoal: 20,
  srsSettings: {
    easyBonus: 1.3,
    intervalModifier: 1,
  },
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const savedSettings = await languageStorage.getSettings();
      setSettings(savedSettings);
      setError(null);
    } catch (err) {
      setError("Failed to load settings");
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      try {
        const newSettings: AppSettings = {
          ...settings,
          ...updates,
          srsSettings: {
            ...settings.srsSettings,
            ...updates.srsSettings,
          },
        };

        await languageStorage.updateSettings(newSettings);
        setSettings(newSettings);
        setError(null);
        toast.success("Settings saved");
      } catch (err) {
        setError("Failed to save settings");
        console.error("Failed to save settings:", err);
        toast.error("Failed to save settings");
        throw err;
      }
    },
    [settings]
  );

  const resetSettings = useCallback(async () => {
    try {
      await languageStorage.updateSettings(DEFAULT_SETTINGS);
      setSettings({ ...DEFAULT_SETTINGS });
      setError(null);
      toast.success("Settings reset to defaults");
    } catch (err) {
      setError("Failed to reset settings");
      console.error("Failed to reset settings:", err);
      toast.error("Failed to reset settings");
      throw err;
    }
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    resetSettings,
    refresh: loadSettings,
  };
}