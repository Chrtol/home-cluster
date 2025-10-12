import { useState, useEffect } from 'react';
import { formatDate as utilFormatDate, formatTime as utilFormatTime, getUserTimeFormat, getUserDateFormat, getUserTimezone } from '../utils/dateFormatting';

export default function Settings() {
  const [timeFormat, setTimeFormat] = useState('24h');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timezone, setTimezone] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Load settings from localStorage
    setTimeFormat(getUserTimeFormat());
    setDateFormat(getUserDateFormat());
    setTimezone(getUserTimezone());
  }, []);

  const handleSave = () => {
    localStorage.setItem('timeFormat', timeFormat);
    localStorage.setItem('dateFormat', dateFormat);
    localStorage.setItem('timezone', timezone);

    setSuccess('Settings saved successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const now = new Date();
  const previewDate = utilFormatDate(now, dateFormat);
  const previewTime = utilFormatTime(now, timeFormat);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Settings</h1>

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
          </div>

          <button
            onClick={handleSave}
            className="btn-primary mt-6"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Household management */}
      <div className="card space-y-6 mt-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Household</h2>
          <HouseholdSection />
        </div>
      </div>
    </div>
  );
}


function HouseholdSection() {
  const [households, setHouseholds] = useState([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    const fetchHouseholds = async () => {
      try {
        const res = await fetch('/api/households/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setHouseholds(data);
        }
      } catch (e) {
        console.error('Failed to load households', e);
      }
    };
    fetchHouseholds();
  }, []);

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
      const res = await fetch('/api/invitations/', {
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
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
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
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
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

          {/* Existing Households */}
          {households.length > 0 && (
            <>
              {!showCreateForm && !showJoinForm && (
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setShowCreateForm(true)} className="btn-secondary">
                    + Create Household
                  </button>
                  <button onClick={() => setShowJoinForm(true)} className="btn-secondary">
                    + Join Household
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {households.map(h => (
                  <div key={h.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{h.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Created at: {new Date(h.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => createInvite(h.id)} disabled={creating} className="btn-primary">
                          Create Invite
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {inviteLink && (
                  <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Invitation Created!</h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invitation Code</label>
                        <div className="flex gap-2">
                          <input readOnly value={inviteCode} className="input flex-1 font-mono" />
                          <button onClick={copyCode} className="btn-secondary whitespace-nowrap">Copy Code</button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Share this code with others to join your household</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invitation Link</label>
                        <div className="flex gap-2">
                          <input readOnly value={inviteLink} className="input flex-1 text-sm" />
                          <button onClick={copyLink} className="btn-secondary whitespace-nowrap">Copy Link</button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Or send this link directly</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
