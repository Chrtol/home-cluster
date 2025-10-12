import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 text-center">
        {status === 'loading' && <p className="text-gray-600 dark:text-gray-300">Joining household...</p>}
        {status === 'success' && <p className="text-green-600 dark:text-green-300">{message}</p>}
        {status === 'error' && <p className="text-red-600 dark:text-red-300">{message}</p>}
        {status === 'idle' && <p className="text-gray-600 dark:text-gray-300">Processing invitation...</p>}
      </div>
    </div>
  );
}
