import { useState, useEffect } from 'react';
import { Save, Copy, Trash2, Edit2, Download, Upload, Check, X, AlertCircle, Monitor, Smartphone } from 'lucide-react';
import {
  getDisplayProfiles,
  getActiveProfileId,
  getActiveDesktopProfileId,
  getActiveMobileProfileId,
  setActiveProfileId,
  createProfileFromCurrent,
  applyProfile,
  renameProfile,
  duplicateProfile,
  deleteProfile,
  updateProfileWithCurrent,
  exportProfile,
  importProfile
} from '../utils/displaySettings';

// Modal Component for confirmations and inputs
function Modal({ isOpen, onClose, title, children, type = 'info' }) {
  if (!isOpen) return null;

  const iconColors = {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400',
    success: 'text-green-600 dark:text-green-400'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            {type !== 'info' && (
              <AlertCircle className={`flex-shrink-0 mt-0.5 ${iconColors[type]}`} size={24} />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileManager({ onProfileChange }) {
  const [profiles, setProfiles] = useState([]);
  const [activeDesktopProfileId, setActiveDesktopProfileId] = useState('standard');
  const [activeMobileProfileId, setActiveMobileProfileId] = useState('mobile');
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileTarget, setNewProfileTarget] = useState('both'); // 'desktop', 'mobile', or 'both'
  const [showNewProfileForm, setShowNewProfileForm] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
    showInput: false,
    inputValue: '',
    inputPlaceholder: ''
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    setProfiles(getDisplayProfiles());
    setActiveDesktopProfileId(getActiveDesktopProfileId());
    setActiveMobileProfileId(getActiveMobileProfileId());
  };

  const openModal = (config) => {
    setModalConfig({
      title: config.title || '',
      message: config.message || '',
      type: config.type || 'info',
      confirmText: config.confirmText || 'OK',
      cancelText: config.cancelText || 'Cancel',
      onConfirm: config.onConfirm || null,
      showInput: config.showInput || false,
      inputValue: config.inputValue || '',
      inputPlaceholder: config.inputPlaceholder || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalConfirm = () => {
    if (modalConfig.onConfirm) {
      modalConfig.onConfirm(modalConfig.inputValue);
    }
    closeModal();
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) {
      openModal({
        title: 'Invalid Name',
        message: 'Please enter a profile name.',
        type: 'warning',
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }

    const newProfile = createProfileFromCurrent(newProfileName.trim());

    // Set as active based on target selection
    if (newProfileTarget === 'desktop' || newProfileTarget === 'both') {
      setActiveProfileId(newProfile.id, false);
      applyProfile(newProfile.id);
    }
    if (newProfileTarget === 'mobile' || newProfileTarget === 'both') {
      setActiveProfileId(newProfile.id, true);
    }

    setNewProfileName('');
    setNewProfileTarget('both');
    setShowNewProfileForm(false);
    loadProfiles();

    if (onProfileChange) {
      onProfileChange(newProfile.id);
    }
  };

  const handleSetAsDesktop = (profileId) => {
    setActiveProfileId(profileId, false);
    applyProfile(profileId);
    loadProfiles();
    if (onProfileChange) {
      onProfileChange(profileId);
    }
  };

  const handleSetAsMobile = (profileId) => {
    setActiveProfileId(profileId, true);
    // Don't apply immediately if we're on desktop
    loadProfiles();
  };

  const handleUpdateProfile = (profileId) => {
    openModal({
      title: 'Update Profile',
      message: 'Update this profile with your current settings?',
      type: 'info',
      confirmText: 'Update',
      cancelText: 'Cancel',
      onConfirm: () => {
        if (updateProfileWithCurrent(profileId)) {
          loadProfiles();
        }
      }
    });
  };

  const handleRenameProfile = (profileId) => {
    if (!editingName.trim()) {
      openModal({
        title: 'Invalid Name',
        message: 'Please enter a profile name.',
        type: 'warning',
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }

    if (renameProfile(profileId, editingName.trim())) {
      setEditingProfileId(null);
      setEditingName('');
      loadProfiles();
    }
  };

  const handleDuplicateProfile = (profileId, profileName) => {
    openModal({
      title: 'Duplicate Profile',
      message: 'Enter name for duplicated profile:',
      type: 'info',
      confirmText: 'Duplicate',
      cancelText: 'Cancel',
      showInput: true,
      inputValue: `${profileName} (Copy)`,
      inputPlaceholder: 'Profile name',
      onConfirm: (newName) => {
        if (newName && newName.trim()) {
          if (duplicateProfile(profileId, newName.trim())) {
            loadProfiles();
          }
        }
      }
    });
  };

  const handleDeleteProfile = (profileId, profileName) => {
    openModal({
      title: 'Delete Profile',
      message: `Delete profile "${profileName}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        if (deleteProfile(profileId)) {
          loadProfiles();
        }
      }
    });
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
          openModal({
            title: 'Import Profile',
            message: 'Enter name for imported profile:',
            type: 'info',
            confirmText: 'Import',
            cancelText: 'Cancel',
            showInput: true,
            inputValue: data.profile?.name || 'Imported Profile',
            inputPlaceholder: 'Profile name',
            onConfirm: (customName) => {
              if (customName && customName.trim()) {
                const imported = importProfile(data, customName.trim());
                if (imported) {
                  loadProfiles();
                }
              }
            }
          });
        } else {
          openModal({
            title: 'Wrong File Type',
            message: 'This appears to be a full settings export. Please use the "Import Display Settings" button in the Export & Import section instead.',
            type: 'warning',
            confirmText: 'OK',
            onConfirm: () => {}
          });
        }
      } catch (err) {
        console.error('Import error:', err);
        openModal({
          title: 'Import Failed',
          message: 'Failed to import profile. Invalid file format.',
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => {}
        });
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
    <>
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
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will save your current dashboard and statistics settings as a new profile.
              </p>
              <select
                value={newProfileTarget}
                onChange={(e) => setNewProfileTarget(e.target.value)}
                className="input text-sm py-1.5 px-2 flex-shrink-0"
              >
                <option value="both">Desktop & Mobile</option>
                <option value="desktop">Desktop only</option>
                <option value="mobile">Mobile only</option>
              </select>
            </div>
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
            const isActiveDesktop = profile.id === activeDesktopProfileId;
            const isActiveMobile = profile.id === activeMobileProfileId;
            const isActive = isActiveDesktop || isActiveMobile;
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                            {profile.name}
                          </h3>
                          {profile.isDefault && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              Built-in
                            </span>
                          )}
                          {isActiveDesktop && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white flex items-center gap-1">
                              <Monitor size={12} />
                              Desktop
                            </span>
                          )}
                          {isActiveMobile && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white flex items-center gap-1">
                              <Smartphone size={12} />
                              Mobile
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Last updated: {new Date(profile.updated_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 flex-wrap">
                    {!isActiveDesktop && (
                      <button
                        onClick={() => handleSetAsDesktop(profile.id)}
                        className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1"
                        title="Set as desktop profile"
                      >
                        <Monitor size={14} />
                        Desktop
                      </button>
                    )}
                    {!isActiveMobile && (
                      <button
                        onClick={() => handleSetAsMobile(profile.id)}
                        className="btn-secondary text-xs px-2 py-1.5 flex items-center gap-1"
                        title="Set as mobile profile"
                      >
                        <Smartphone size={14} />
                        Mobile
                      </button>
                    )}
                    {(isActiveDesktop || isActiveMobile) && (
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

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={modalConfig.title}
        type={modalConfig.type}
      >
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          {modalConfig.message}
        </p>
        {modalConfig.showInput && (
          <input
            type="text"
            value={modalConfig.inputValue}
            onChange={(e) => setModalConfig({ ...modalConfig, inputValue: e.target.value })}
            placeholder={modalConfig.inputPlaceholder}
            className="input w-full mb-4"
            onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
            autoFocus
          />
        )}
        <div className="flex gap-2 justify-end">
          {modalConfig.onConfirm && (
            <button onClick={closeModal} className="btn-secondary">
              {modalConfig.cancelText}
            </button>
          )}
          <button
            onClick={handleModalConfirm}
            className={`btn-primary ${modalConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : ''}`}
          >
            {modalConfig.confirmText}
          </button>
        </div>
      </Modal>
    </>
  );
}
