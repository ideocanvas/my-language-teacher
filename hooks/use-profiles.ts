"use client";

import { useState, useEffect, useCallback } from "react";
import { Profile } from "@/lib/profile-types";
import {
  getAllProfiles,
  getCurrentProfile,
  createProfile,
  deleteProfile,
  updateProfile,
  setCurrentProfileId,
  initializeProfiles,
  migrateExistingData,
} from "@/lib/profile-storage";
import { toast } from "sonner";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    const init = () => {
      // Migrate existing data if needed
      migrateExistingData();
      
      // Initialize profiles
      const current = initializeProfiles();
      setCurrentProfile(current);
      setProfiles(getAllProfiles());
      setLoading(false);
    };

    init();
  }, []);

  // Refresh profiles list
  const refreshProfiles = useCallback(() => {
    setProfiles(getAllProfiles());
    setCurrentProfile(getCurrentProfile());
  }, []);

  // Switch to a different profile
  const switchProfile = useCallback((profileId: string) => {
    setCurrentProfileId(profileId);
    setCurrentProfile(getCurrentProfile());
    // Reload the page to refresh all data
    globalThis.location.reload();
  }, []);

  // Create a new profile
  const addProfile = useCallback((name: string, color: string = "#3B82F6") => {
    try {
      const profile = createProfile(name, color);
      setProfiles(getAllProfiles());
      toast.success(`Profile "${name}" created`);
      return profile;
    } catch (err) {
      console.error("Failed to create profile:", err);
      toast.error("Failed to create profile");
      throw err;
    }
  }, []);

  // Delete a profile
  const removeProfile = useCallback((profileId: string) => {
    try {
      const success = deleteProfile(profileId);
      if (success) {
        setProfiles(getAllProfiles());
        setCurrentProfile(getCurrentProfile());
        toast.success("Profile deleted");
        // Reload if we deleted the current profile
        globalThis.location.reload();
      }
      return success;
    } catch (err) {
      console.error("Failed to delete profile:", err);
      toast.error("Failed to delete profile");
      throw err;
    }
  }, []);

  // Update profile name or color
  const editProfile = useCallback((profileId: string, updates: Partial<Pick<Profile, "name" | "color">>) => {
    try {
      const profile = updateProfile(profileId, updates);
      if (profile) {
        setProfiles(getAllProfiles());
        if (currentProfile?.id === profileId) {
          setCurrentProfile(profile);
        }
        toast.success("Profile updated");
      }
      return profile;
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error("Failed to update profile");
      throw err;
    }
  }, [currentProfile]);

  return {
    profiles,
    currentProfile,
    loading,
    switchProfile,
    addProfile,
    removeProfile,
    editProfile,
    refreshProfiles,
  };
}
