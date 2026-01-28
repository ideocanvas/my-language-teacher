"use client";

import { useState } from "react";
import { Profile } from "@/lib/profile-types";
import { useProfiles } from "@/hooks/use-profiles";
import {
  User,
  Plus,
  Settings,
  LogOut,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

const PROFILE_COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export function ProfileSelector() {
  const {
    profiles,
    currentProfile,
    loading,
    switchProfile,
    addProfile,
    removeProfile,
    editProfile,
  } = useProfiles();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PROFILE_COLORS[0]);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) {
      toast.error("Please enter a profile name");
      return;
    }
    addProfile(newProfileName.trim(), selectedColor);
    setNewProfileName("");
    setShowCreateForm(false);
    setIsOpen(false);
  };

  const handleDeleteProfile = (profile: Profile) => {
    if (profiles.length <= 1) {
      toast.error("Cannot delete the last profile");
      return;
    }
    if (globalThis.confirm(`Are you sure you want to delete "${profile.name}"?\n\nAll data for this profile will be permanently deleted.`)) {
      removeProfile(profile.id);
      setIsOpen(false);
    }
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditName(profile.name);
  };

  const handleSaveEdit = () => {
    if (!editingProfile) return;
    if (!editName.trim()) {
      toast.error("Profile name cannot be empty");
      return;
    }
    editProfile(editingProfile.id, { name: editName.trim() });
    setEditingProfile(null);
  };

  const handleSwitchProfile = (profileId: string) => {
    if (profileId === currentProfile?.id) {
      setIsOpen(false);
      return;
    }
    switchProfile(profileId);
    setIsOpen(false);
  };

  if (loading || !currentProfile) {
    return (
      <button className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600">
        <User className="w-5 h-5" />
        <span className="hidden sm:inline">Loading...</span>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Current Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: currentProfile.color }}
        >
          {currentProfile.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline font-medium text-gray-700">
          {currentProfile.name}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2">
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Profiles</h3>
              <p className="text-sm text-gray-500">Switch between different learning profiles</p>
            </div>

            {/* Profile List */}
            <div className="max-h-64 overflow-y-auto py-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`px-4 py-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                    profile.id === currentProfile.id ? "bg-blue-50" : ""
                  }`}
                >
                  {editingProfile?.id === profile.id ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingProfile(null);
                        }}
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingProfile(null)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSwitchProfile(profile.id)}
                        className="flex items-center space-x-3 flex-1"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: profile.color }}
                        >
                          {profile.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{profile.name}</p>
                          {profile.id === currentProfile.id && (
                            <p className="text-xs text-blue-600">Current</p>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditProfile(profile)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit name"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(profile)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Create New Profile */}
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-4 py-3 flex items-center space-x-2 text-blue-600 hover:bg-blue-50 border-t border-gray-100"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Create New Profile</span>
              </button>
            ) : (
              <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                <input
                  type="text"
                  placeholder="Profile name"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleCreateProfile();
                    if (e.key === "Escape") setShowCreateForm(false);
                  }}
                />
                <div className="flex justify-center space-x-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        selectedColor === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateProfile}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewProfileName("");
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
