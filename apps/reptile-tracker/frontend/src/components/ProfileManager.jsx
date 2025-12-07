import { useState, useEffect } from 'react';
import { Save, Copy, Trash2, Edit2, Download, Upload, Check, X } from 'lucide-react';
import {
  getDisplayProfiles,
  getActiveProfileId,
  createProfileFromCurrent,
  applyProfile,
  renameProfile,
  duplicateProfile,
  deleteProfile,
  updateProfileWithCurrent,
  exportProfile,
  importProfile
} from '../utils/displaySettings';

export default function ProfileManager({ onProfileChange }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewProfileForm, setShowNewProfileForm] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    setProfiles(getDisplayProfiles());
    setActiveProfileId(getActiveProfileId());
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) {
      alert('Please enter a profile name');
      return;
    }

    createProfileFromCurrent(newProfileName.trim());
    setNewProfileName('');
    setShowNewProfileForm(false);
    loadProfiles();
  };

  const handleSwitchProfile = (profileId) => {
    if (applyProfile(profileId)) {
      setActiveProfileId(profileId);
      loadProfiles();
      if (onProfileChange) {
        onProfileChange(profileId);
      }
    }
  };

  const handleUpdateProfile = (profileId) => {
    if (!confirm('Update this profile with your current settings?')) return;

    if (updateProfileWithCurrent(profileId)) {
      loadProfiles();
      alert('Profile updated successfully!');
    }
  };

  const handleRenameProfile = (profileId) => {
    if (!editingName.trim()) {
      alert('Please enter a profile name');
      return;
    }

    if (renameProfile(profileId, editingName.trim())) {
      setEditingProfileId(null);
      setEditingName('');
      loadProfiles();
    }
  };

  const handleDuplicateProfile = (profileId, profileName) => {
    const newName = prompt(`Enter name for duplicated profile:`, `${profileName} (Copy)`);
    if (!newName) return;

    if (duplicateProfile(profileId, newName)) {
      loadProfiles();
    }
  };

  const handleDeleteProfile = (profileId, profileName) => {
    if (!confirm(`Delete profile "${profileName}"? This cannot be undone.`)) return;

    if (deleteProfile(profileId)) {
      loadProfiles();
    }
  };

  const handleExportProfile = (profileId, profileName) => {
    const data = exportProfile(profileId);
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-${profileName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProfile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result);

        // Check if it's a profile export or full settings export
        if (data.type === 'display_profile') {
          const customName = prompt('Enter name for imported profile:', data.profile?.name || 'Imported Profile');
          if (!customName) return;

          const imported = importProfile(data, customName);
          if (imported) {
            loadProfiles();
            alert('Profile imported successfully!');
          } else {
            alert('Failed to import profile. Please check the file format.');
          }
        } else {
          alert('This appears to be a full settings export. Please use the "Import Display Settings" button in the Export & Import section instead.');
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('Failed to import profile. Invalid file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const startEditing = (profileId, currentName) => {
    setEditingProfileId(profileId);
    setEditingName(currentName);
  };

  const cancelEditing = () => {
    setEditingProfileId(null);
    setEditingName('');
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Display Profiles</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Save and switch between different dashboard and statistics layouts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewProfileForm(!showNewProfileForm)}
            className="btn-primary text-sm"
          >
            {showNewProfileForm ? 'Cancel' : 'Create Profile'}
          </button>
          <label className="btn-secondary text-sm cursor-pointer flex items-center gap-2">
            <Upload size={16} />
            Import Profile
            <input
              type="file"
              accept=".json"
              onChange={handleImportProfile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Create New Profile Form */}
      {showNewProfileForm && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Create New Profile</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            This will save your current dashboard and statistics settings as a new profile.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name..."
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
              autoFocus
            />
            <button onClick={handleCreateProfile} className="btn-primary">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Profiles List */}
      <div className="space-y-2">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          const isEditing = editingProfileId === profile.id;

          return (
            <div
              key={profile.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="input text-sm flex-1 max-w-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameProfile(profile.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameProfile(profile.id)}
                        className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                        title="Save"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400"
                        title="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {profile.name}
                          {profile.isDefault && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              Default
                            </span>
                          )}
                          {isActive && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-500 text-white">
                              Active
                            </span>
                          )}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Last updated: {new Date(profile.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  {!isActive && (
                    <button
                      onClick={() => handleSwitchProfile(profile.id)}
                      className="btn-secondary text-sm px-3 py-1.5"
                      title="Switch to this profile"
                    >
                      Switch
                    </button>
                  )}
                  {isActive && (
                    <button
                      onClick={() => handleUpdateProfile(profile.id)}
                      className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="Update profile with current settings"
                    >
                      <Save size={18} />
                    </button>
                  )}
                  {!profile.isDefault && (
                    <>
                      <button
                        onClick={() => startEditing(profile.id, profile.name)}
                        className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Rename profile"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDuplicateProfile(profile.id, profile.name)}
                        className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Duplicate profile"
                      >
                        <Copy size={18} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleExportProfile(profile.id, profile.name)}
                    className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Export profile"
                  >
                    <Download size={18} />
                  </button>
                  {!profile.isDefault && (
                    <button
                      onClick={() => handleDeleteProfile(profile.id, profile.name)}
                      className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete profile"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
        <p className="font-medium mb-1">How to use profiles:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Create a new profile to save your current dashboard and statistics layout</li>
          <li>Switch between profiles to change your layout instantly</li>
          <li>Update the active profile with the Save button when you make changes</li>
          <li>Export profiles to share them or use them on another device</li>
          <li>Import profiles from exported .json files</li>
        </ul>
      </div>
    </div>
  );
}
