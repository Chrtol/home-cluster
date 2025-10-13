import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState('choice'); // choice, create, join, complete
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create household state
  const [householdName, setHouseholdName] = useState('');

  // Join household state
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    if (!householdName.trim()) {
      setError('Please enter a household name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/households', { name: householdName });
      setStep('complete');
    } catch (err) {
      console.error('Failed to create household:', err);
      setError(err.response?.data?.detail || 'Failed to create household');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHousehold = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/invitations/accept', { code: inviteCode });
      setStep('complete');
    } catch (err) {
      console.error('Failed to join household:', err);
      setError(err.response?.data?.detail || 'Failed to join household. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    // Redirect to dashboard
    navigate('/', { replace: true });
    // Force page reload to refresh household data
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Reptile Tracker!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Let's get you set up with a household
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {step === 'choice' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  How would you like to get started?
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Households let you share reptile care with family, friends, or caretakers.
                  You must be part of a household to use Reptile Tracker.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('create')}
                  className="p-6 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-left group"
                >
                  <div className="text-4xl mb-3">🏠</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    Create New Household
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Start fresh and invite others to join you
                  </p>
                </button>

                <button
                  onClick={() => setStep('join')}
                  className="p-6 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-left group"
                >
                  <div className="text-4xl mb-3">🔗</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    Join Existing Household
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Use an invitation code to join someone else's household
                  </p>
                </button>
              </div>
            </div>
          )}

          {step === 'create' && (
            <div>
              <button
                onClick={() => {
                  setStep('choice');
                  setError('');
                  setHouseholdName('');
                }}
                className="text-primary-600 dark:text-primary-400 hover:underline mb-4 flex items-center gap-2"
              >
                ← Back
              </button>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Create New Household
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Choose a name for your household (e.g., "Smith Family", "My Reptiles", "Reptile Room")
              </p>

              <form onSubmit={handleCreateHousehold} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Household Name
                  </label>
                  <input
                    type="text"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    placeholder="My Household"
                    className="input w-full"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Creating...' : 'Create Household'}
                </button>
              </form>
            </div>
          )}

          {step === 'join' && (
            <div>
              <button
                onClick={() => {
                  setStep('choice');
                  setError('');
                  setInviteCode('');
                }}
                className="text-primary-600 dark:text-primary-400 hover:underline mb-4 flex items-center gap-2"
              >
                ← Back
              </button>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Join Existing Household
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter the invitation code you received from the household owner
              </p>

              <form onSubmit={handleJoinHousehold} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Invitation Code
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="ABC123XYZ"
                    className="input w-full font-mono"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Joining...' : 'Join Household'}
                </button>
              </form>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                All Set!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your household is ready. You can now start tracking your reptiles!
              </p>
              <button
                onClick={handleComplete}
                className="btn-primary"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            You can always create additional households or join more households later in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
