import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Onboarding() {
  // Force dark mode for non-authenticated page
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.add('dark');
    return () => {
      if (!hadDark) root.classList.remove('dark');
    };
  }, []);
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
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome to Reptile Tracker!
          </h1>
          <p className="text-muted-foreground">
            Let's get you set up with a household
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            {step === 'choice' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    How would you like to get started?
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Households let you share reptile care with family, friends, or caretakers.
                    You must be part of a household to use Reptile Tracker.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setStep('create')}
                  >
                    <CardContent className="p-6">
                      <div className="text-4xl mb-3">🏠</div>
                      <CardTitle className="text-xl mb-2">Create New Household</CardTitle>
                      <CardDescription>Start fresh and invite others to join you</CardDescription>
                    </CardContent>
                  </Card>

                  <Card
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setStep('join')}
                  >
                    <CardContent className="p-6">
                      <div className="text-4xl mb-3">🔗</div>
                      <CardTitle className="text-xl mb-2">Join Existing Household</CardTitle>
                      <CardDescription>Use an invitation code to join someone else's household</CardDescription>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {step === 'create' && (
              <div>
                <Button
                  variant="link"
                  onClick={() => {
                    setStep('choice');
                    setError('');
                    setHouseholdName('');
                  }}
                  className="mb-4 px-0"
                >
                  ← Back
                </Button>

                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Create New Household
                </h2>
                <p className="text-muted-foreground mb-6">
                  Choose a name for your household (e.g., "Smith Family", "My Reptiles", "Reptile Room")
                </p>

                <form onSubmit={handleCreateHousehold} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Household Name
                    </label>
                    <Input
                      type="text"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder="My Household"
                      autoFocus
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Creating...' : 'Create Household'}
                  </Button>
                </form>
              </div>
            )}

            {step === 'join' && (
              <div>
                <Button
                  variant="link"
                  onClick={() => {
                    setStep('choice');
                    setError('');
                    setInviteCode('');
                  }}
                  className="mb-4 px-0"
                >
                  ← Back
                </Button>

                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Join Existing Household
                </h2>
                <p className="text-muted-foreground mb-6">
                  Enter the invitation code you received from the household owner
                </p>

                <form onSubmit={handleJoinHousehold} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Invitation Code
                    </label>
                    <Input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="ABC123XYZ"
                      className="font-mono"
                      autoFocus
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Joining...' : 'Join Household'}
                  </Button>
                </form>
              </div>
            )}

            {step === 'complete' && (
              <div className="text-center py-8">
                <div className="text-6xl mb-6">🎉</div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  All Set!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Your household is ready. You can now start tracking your reptiles!
                </p>
                <Button onClick={handleComplete}>
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            You can always create additional households or join more households later in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
