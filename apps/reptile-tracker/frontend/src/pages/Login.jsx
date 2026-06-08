import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';

export default function Login() {
  // Force dark mode for non-authenticated page
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.add('dark');
    return () => {
      if (!hadDark) root.classList.remove('dark');
    };
  }, []);

  // Local auth form state
  const [showLocalAuth, setShowLocalAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localAuthError, setLocalAuthError] = useState(null);
  const [localAuthLoading, setLocalAuthLoading] = useState(false);

  // For now, local auth is enabled in dev environment
  // In production, this would be checked via API call to /api/config/auth-methods
  const localAuthEnabled = import.meta.env.DEV || import.meta.env.VITE_LOCAL_AUTH_ENABLED === 'true';

  const handleOIDCLogin = () => {
    window.location.href = '/auth/login';
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setLocalAuthError(null);
    setLocalAuthLoading(true);

    try {
      await axios.post('/auth/local', {
        username: email,
        password: password
      });

      // Success - cookies are set by backend, redirect to dashboard
      window.location.href = '/';
    } catch (error) {
      setLocalAuthLoading(false);

      if (error.response?.status === 401) {
        setLocalAuthError('Invalid email or password');
      } else if (error.response?.status === 403) {
        setLocalAuthError('Local authentication is not enabled');
      } else {
        setLocalAuthError('Login failed. Please try again.');
      }
    }
  };

  // Show local auth form
  if (showLocalAuth && localAuthEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="text-6xl mb-4">🦎</div>
            <CardTitle className="text-3xl">Reptile Tracker</CardTitle>
            <CardDescription>
              Sign in with your email and password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLocalLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {localAuthError && (
                <p className="text-sm text-destructive">{localAuthError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={localAuthLoading}
              >
                {localAuthLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowLocalAuth(false)}
                className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
              >
                Or sign in with Authentik
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: OIDC login (primary)
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">🦎</div>
          <CardTitle className="text-3xl">Reptile Tracker</CardTitle>
          <CardDescription>
            Track feeding schedules, weight, and health for your reptiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleOIDCLogin} className="w-full" size="lg">
            Login with Single Sign-On
          </Button>

          {localAuthEnabled && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowLocalAuth(true)}
                className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
              >
                Or sign in with email
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
