import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import LoadingState from '../components/LoadingState';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setMessage('No invitation code provided.');
      setStatus('error');
      return;
    }

    const accept = async () => {
      setStatus('loading');
      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        if (res.status === 401) {
          // Not authenticated: redirect to login flow, preserving code
          window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (!res.ok) {
          const err = await res.json();
          setMessage(err.detail || 'Failed to accept invite');
          setStatus('error');
          return;
        }
        const data = await res.json();
        setMessage('Successfully joined household!');
        setStatus('success');
        // Redirect to household settings or dashboard
        setTimeout(() => navigate('/settings'), 1200);
      } catch (e) {
        console.error('Accept invite failed', e);
        setMessage('Failed to accept invite');
        setStatus('error');
      }
    };

    accept();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <div>
              <LoadingState compact />
              <p className="text-muted-foreground mt-4">Joining household...</p>
            </div>
          )}
          {status === 'success' && (
            <div>
              <div className="text-4xl mb-4">✓</div>
              <p className="text-green-600 dark:text-green-400 font-medium">{message}</p>
              <p className="text-muted-foreground text-sm mt-2">Redirecting to settings...</p>
            </div>
          )}
          {status === 'error' && (
            <div>
              <div className="text-4xl mb-4">✕</div>
              <p className="text-destructive font-medium">{message}</p>
            </div>
          )}
          {status === 'idle' && (
            <div>
              <LoadingState compact />
              <p className="text-muted-foreground mt-4">Processing invitation...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
