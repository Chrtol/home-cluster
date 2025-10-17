import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Trash2, Settings as SettingsIcon, Users } from 'lucide-react';
import { formatDate as utilFormatDate, formatTime as utilFormatTime, getUserTimeFormat, getUserDateFormat, getUserTimezone } from '../utils/dateFormatting';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('preferences'); // preferences, household

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'preferences'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <SettingsIcon size={18} />
            Preferences
          </button>
          <button
            onClick={() => setActiveTab('household')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'household'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Users size={18} />
            Household
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'preferences' && <PreferencesTab />}
      {activeTab === 'household' && <HouseholdSection />}
    </div>
  );
}

// PREFERENCES TAB COMPONENT
function PreferencesTab() {
  const [timeFormat, setTimeFormat] = useState('24h');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timezone, setTimezone] = useState('');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('sunday');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Load settings from localStorage
    setTimeFormat(getUserTimeFormat());
    setDateFormat(getUserDateFormat());
    setTimezone(getUserTimezone());
    setFirstDayOfWeek(localStorage.getItem('firstDayOfWeek') || 'sunday');
  }, []);

  const handleSave = () => {
    localStorage.setItem('timeFormat', timeFormat);
    localStorage.setItem('dateFormat', dateFormat);
    localStorage.setItem('timezone', timezone);
    localStorage.setItem('firstDayOfWeek', firstDayOfWeek);

    setSuccess('Settings saved successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const now = new Date();
  const previewDate = utilFormatDate(now, dateFormat);
  const previewTime = utilFormatTime(now, timeFormat);

  return (
    <div>
      {success && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
          {success}
        </div>
      )}

      <div className="card space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Date & Time Preferences</h2>

          <div className="space-y-4">
            {/* Time Format */}
            <div>
              <label className="block font-medium mb-2 text-gray-900 dark:text-white">Time Format</label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="input w-full"
              >
                <option value="24h">24-hour (14:30)</option>
                <option value="12h">12-hour (2:30 PM)</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Preview: {previewTime}
              </p>
            </div>

            {/* Date Format */}
            <div>
              <label className="block font-medium mb-2 text-gray-900 dark:text-white">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="input w-full"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (2024-03-15)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (15/03/2024)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (03/15/2024)</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY (15.03.2024)</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Preview: {previewDate}
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block font-medium mb-2 text-gray-900 dark:text-white">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input w-full"
              >
                <option value="Europe/Oslo">Europe/Oslo (CET/CEST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Current timezone: {timezone}
              </p>
            </div>

            {/* First Day of Week */}
            <div>
              <label className="block font-medium mb-2 text-gray-900 dark:text-white">First Day of Week</label>
              <select
                value={firstDayOfWeek}
                onChange={(e) => setFirstDayOfWeek(e.target.value)}
                className="input w-full"
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Affects calendar view and rotation day-of-week picker
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="btn-primary mt-6"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}


function HouseholdSection() {
  const [households, setHouseholds] = useState([]);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [editingHouseholdId, setEditingHouseholdId] = useState(null);
  const [editName, setEditName] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, invitations
  const [userRole, setUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const fetchHouseholds = async () => {
      try {
        const res = await fetch('/api/households/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setHouseholds(data);
          if (data.length > 0 && !selectedHousehold) {
            setSelectedHousehold(data[0]);
          }
        }
      } catch (e) {
        console.error('Failed to load households', e);
      }
    };
    fetchHouseholds();
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get('/auth/me');
        console.log('Current user data:', res.data);
        setCurrentUserId(res.data.id);
      } catch (e) {
        console.error('Failed to get current user', e);
      }
    };
    fetchCurrentUser();
  }, []);

  const fetchMembers = async () => {
    if (!selectedHousehold) return;
    try {
      const res = await fetch(`/api/households/${selectedHousehold.id}/members`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        console.log('Household members:', data);
        console.log('Current user ID:', currentUserId);
        setMembers(data);

        // Find current user's role
        if (currentUserId) {
          const currentUser = data.find(m => m.user_id === currentUserId);
          console.log('Current user member data:', currentUser);
          console.log('User role:', currentUser?.access_level);
          setUserRole(currentUser?.access_level);
        }
      } else {
        console.error('Failed to fetch members, status:', res.status);
      }
    } catch (e) {
      console.error('Failed to load members', e);
    }
  };

  useEffect(() => {
    if (selectedHousehold && currentUserId) {
      fetchMembers();
      fetchInvitations();
    }
  }, [selectedHousehold, currentUserId]);

  const fetchInvitations = async () => {
    if (!selectedHousehold) return;
    try {
      const res = await fetch(`/api/invitations/household/${selectedHousehold.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (e) {
      console.error('Failed to load invitations', e);
    }
  };

  const createHousehold = async () => {
    if (!newHouseholdName.trim()) {
      alert('Please enter a household name');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/households/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHouseholdName })
      });
      if (res.ok) {
        const newHousehold = await res.json();
        setHouseholds([...households, newHousehold]);
        setNewHouseholdName('');
        setShowCreateForm(false);
      } else {
        const err = await res.json();
        alert('Failed to create household: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('createHousehold error', e);
      alert('Failed to create household');
    } finally {
      setCreating(false);
    }
  };

  const joinHousehold = async () => {
    if (!joinCode.trim()) {
      alert('Please enter an invitation code');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        alert('Successfully joined household!');
        setJoinCode('');
        setShowJoinForm(false);
        // Refresh households list
        const householdsRes = await fetch('/api/households/me', { credentials: 'include' });
        if (householdsRes.ok) {
          const householdsData = await householdsRes.json();
          setHouseholds(householdsData);
        }
      } else {
        const err = await res.json();
        alert('Failed to join household: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('joinHousehold error', e);
      alert('Failed to join household');
    } finally {
      setCreating(false);
    }
  };

  const createInvite = async (householdId) => {
    setCreating(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_id: householdId })
      });
      if (res.ok) {
        const data = await res.json();
        const link = `${window.location.origin}/accept-invite?code=${encodeURIComponent(data.code)}`;
        setInviteLink(link);
        setInviteCode(data.code);
      } else {
        const err = await res.json();
        alert('Failed to create invite: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('createInvite error', e);
      alert('Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard');
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      alert('Invite code copied to clipboard');
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  const updateHouseholdName = async (householdId) => {
    if (!editName.trim()) {
      alert('Please enter a household name');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/households/${householdId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      });
      if (res.ok) {
        const updated = await res.json();
        setHouseholds(households.map(h => h.id === householdId ? updated : h));
        if (selectedHousehold?.id === householdId) {
          setSelectedHousehold(updated);
        }
        setEditingHouseholdId(null);
        setEditName('');
      } else {
        const err = await res.json();
        alert('Failed to update household: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('updateHousehold error', e);
      alert('Failed to update household');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!confirm(`Are you sure you want to change this member's role to ${newRole}?`)) {
      return;
    }

    setCreating(true);
    try {
      await axios.patch(`/api/households/${selectedHousehold.id}/members/${userId}/role`, {
        access_level: newRole
      });
      alert('Role updated successfully');
      fetchMembers();
    } catch (err) {
      console.error('Failed to update role:', err);
      alert(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setCreating(false);
    }
  };

  const removeMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member from the household?')) {
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/households/${selectedHousehold.id}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        alert('Member removed successfully');
        fetchMembers();
      } else {
        const err = await res.json();
        alert('Failed to remove member: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('removeMember error', e);
      alert('Failed to remove member');
    } finally {
      setCreating(false);
    }
  };

  const leaveHousehold = async (householdId) => {
    if (!confirm('Are you sure you want to leave this household? You will lose access to all reptiles in this household.')) {
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/households/${householdId}/leave`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        alert('You have left the household');
        // Refresh households list
        const householdsRes = await fetch('/api/households/me', { credentials: 'include' });
        if (householdsRes.ok) {
          const householdsData = await householdsRes.json();
          setHouseholds(householdsData);
          setSelectedHousehold(householdsData.length > 0 ? householdsData[0] : null);
        }
      } else {
        const err = await res.json();
        alert('Failed to leave household: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('leaveHousehold error', e);
      alert('Failed to leave household');
    } finally {
      setCreating(false);
    }
  };

  const deleteInvitation = async (invitationId) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        alert('Invitation revoked successfully');
        fetchInvitations();
      } else {
        const err = await res.json();
        alert('Failed to revoke invitation: ' + (err.detail || res.statusText));
      }
    } catch (e) {
      console.error('deleteInvitation error', e);
      alert('Failed to revoke invitation');
    } finally {
      setCreating(false);
    }
  };

  const isAdmin = ['owner', 'admin'].includes(userRole);
  const isOwner = userRole === 'owner';
  const canManage = ['owner', 'admin', 'manager'].includes(userRole);

  const getRoleBadge = (role) => {
    const colors = {
      owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      manager: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      caretaker: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colors[role]}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {households.length === 0 && !showCreateForm && !showJoinForm ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">You are not a member of any households yet.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCreateForm(true)} className="btn-primary">
              Create Household
            </button>
            <button onClick={() => setShowJoinForm(true)} className="btn-secondary">
              Join Household
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Create Household Form */}
          {showCreateForm && (
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Create New Household</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Household name (e.g., 'Smith Family')"
                  value={newHouseholdName}
                  onChange={(e) => setNewHouseholdName(e.target.value)}
                  className="input w-full"
                  onKeyDown={(e) => e.key === 'Enter' && createHousehold()}
                />
                <div className="flex gap-2">
                  <button onClick={createHousehold} disabled={creating} className="btn-primary">
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={() => { setShowCreateForm(false); setNewHouseholdName(''); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join Household Form */}
          {showJoinForm && (
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Join Household</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter invitation code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="input w-full"
                  onKeyDown={(e) => e.key === 'Enter' && joinHousehold()}
                />
                <div className="flex gap-2">
                  <button onClick={joinHousehold} disabled={creating} className="btn-primary">
                    {creating ? 'Joining...' : 'Join'}
                  </button>
                  <button onClick={() => { setShowJoinForm(false); setJoinCode(''); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Household Management */}
          {households.length > 0 && selectedHousehold && (
            <>
              {/* Household Selector */}
              <div className="flex gap-2 mb-4">
                <select
                  value={selectedHousehold.id}
                  onChange={(e) => {
                    const household = households.find(h => h.id === parseInt(e.target.value));
                    setSelectedHousehold(household);
                    setActiveTab('overview');
                  }}
                  className="input flex-1"
                >
                  {households.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                {!showCreateForm && !showJoinForm && (
                  <>
                    <button onClick={() => setShowCreateForm(true)} className="btn-secondary whitespace-nowrap">
                      + Create
                    </button>
                    <button onClick={() => setShowJoinForm(true)} className="btn-secondary whitespace-nowrap">
                      + Join
                    </button>
                  </>
                )}
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav className="flex gap-4 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === 'users'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Users ({members.length})
                  </button>
                  {canManage && (
                    <button
                      onClick={() => setActiveTab('invitations')}
                      className={`py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'invitations'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Invitations ({invitations.length})
                    </button>
                  )}
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {editingHouseholdId === selectedHousehold.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input w-full"
                          placeholder="Household name"
                          onKeyDown={(e) => e.key === 'Enter' && updateHouseholdName(selectedHousehold.id)}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => updateHouseholdName(selectedHousehold.id)} disabled={creating} className="btn-primary">
                            {creating ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={() => { setEditingHouseholdId(null); setEditName(''); }} className="btn-secondary">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedHousehold.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Created {new Date(selectedHousehold.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2">
                            {isOwner && (
                              <button
                                onClick={() => {
                                  setEditingHouseholdId(selectedHousehold.id);
                                  setEditName(selectedHousehold.name);
                                }}
                                className="btn-secondary text-sm"
                              >
                                Edit Name
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {canManage && (
                            <button
                              onClick={() => {
                                createInvite(selectedHousehold.id);
                                setActiveTab('invitations');
                              }}
                              disabled={creating}
                              className="btn-primary"
                            >
                              Create Invite
                            </button>
                          )}
                          <button
                            onClick={() => leaveHousehold(selectedHousehold.id)}
                            disabled={creating}
                            className="btn-secondary text-red-600 dark:text-red-400"
                          >
                            Leave Household
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quick Stats</h4>
                    <div className={`grid ${canManage ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                      <div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{members.length}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Members</p>
                      </div>
                      {canManage && (
                        <div>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{invitations.filter(i => !i.expires_at || new Date(i.expires_at) > new Date()).length}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Active Invites</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="space-y-4">
                  {!isAdmin && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 px-4 py-3 rounded mb-4">
                      <div className="flex items-center gap-2">
                        <Shield size={20} />
                        <p className="text-sm">
                          You are a <strong>{userRole || 'member'}</strong>. Only owners and admins can manage member roles.
                        </p>
                      </div>
                    </div>
                  )}

                  {members.length === 0 ? (
                    <p className="text-center py-8 text-gray-600 dark:text-gray-400">No members found</p>
                  ) : (
                    <div className="space-y-4">
                      {members.map(member => (
                        <div
                          key={member.user_id}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white">{member.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {getRoleBadge(member.access_level)}

                            {isAdmin && member.user_id !== currentUserId && (
                              <div className="flex gap-2">
                                <select
                                  value={member.access_level}
                                  onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                                  className="input py-1 px-2 text-sm"
                                  disabled={creating}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="caretaker">Caretaker</option>
                                  <option value="manager">Manager</option>
                                  <option value="admin">Admin</option>
                                  <option value="owner">Owner</option>
                                </select>

                                <button
                                  onClick={() => removeMember(member.user_id)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                  title="Remove member"
                                  disabled={creating}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Role Permissions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <strong className="text-blue-600 dark:text-blue-400">Owner:</strong>
                            <span className="text-gray-600 dark:text-gray-400"> Full household control (members, invitations, reptiles)</span>
                          </div>
                          <div>
                            <strong className="text-purple-600 dark:text-purple-400">Admin:</strong>
                            <span className="text-gray-600 dark:text-gray-400"> Can manage members, invitations, and reptiles</span>
                          </div>
                          <div>
                            <strong className="text-yellow-600 dark:text-yellow-400">Manager:</strong>
                            <span className="text-gray-600 dark:text-gray-400"> Can edit reptiles and create invitations</span>
                          </div>
                          <div>
                            <strong className="text-green-600 dark:text-green-400">Caretaker:</strong>
                            <span className="text-gray-600 dark:text-gray-400"> Can log feedings, misting, weights</span>
                          </div>
                          <div>
                            <strong className="text-gray-600 dark:text-gray-400">Viewer:</strong>
                            <span className="text-gray-600 dark:text-gray-400"> Can only view reptiles and logs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'invitations' && (
                <div className="space-y-4">
                  {inviteLink && inviteCode && (
                    <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-green-50 dark:bg-green-900/20 mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Invitation Created!</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invitation Code</label>
                          <div className="flex gap-2">
                            <input readOnly value={inviteCode} className="input flex-1 font-mono text-sm" />
                            <button onClick={copyCode} className="btn-secondary whitespace-nowrap">Copy</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invitation Link</label>
                          <div className="flex gap-2">
                            <input readOnly value={inviteLink} className="input flex-1 text-sm" />
                            <button onClick={copyLink} className="btn-secondary whitespace-nowrap">Copy</button>
                          </div>
                        </div>
                        <button onClick={() => { setInviteLink(''); setInviteCode(''); }} className="btn-secondary text-sm">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {invitations.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400 mb-4">No invitations yet</p>
                      <button
                        onClick={() => createInvite(selectedHousehold.id)}
                        disabled={creating}
                        className="btn-primary"
                      >
                        Create First Invite
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {invitations.map(inv => {
                        const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                        const isMaxedOut = inv.max_uses && inv.used_count >= inv.max_uses;
                        const isActive = !isExpired && !isMaxedOut;

                        return (
                          <div key={inv.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {inv.code}
                                </code>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  isActive
                                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {isActive ? 'Active' : isExpired ? 'Expired' : 'Maxed Out'}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                <span>Used {inv.used_count || 0} time{inv.used_count !== 1 ? 's' : ''}</span>
                                {inv.max_uses && <span> (max: {inv.max_uses})</span>}
                                {inv.expires_at && <span> • Expires {new Date(inv.expires_at).toLocaleDateString()}</span>}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Created {new Date(inv.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            {isOwner && (
                              <button
                                onClick={() => deleteInvitation(inv.id)}
                                disabled={creating}
                                className="btn-secondary text-red-600 dark:text-red-400"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
