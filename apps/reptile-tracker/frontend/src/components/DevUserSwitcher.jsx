import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

/**
 * DevUserSwitcher - Dropdown for switching between dev users.
 *
 * Per D-17: Only available in development environment.
 * Fetches users from GET /auth/dev/users.
 * On select, calls POST /auth/dev/switch?user_id={id}.
 * After success, clears React Query cache and reloads page.
 */
export default function DevUserSwitcher({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('/auth/dev/users');
        setUsers(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dev users:', err);
        if (err.response?.status === 403) {
          setError('Dev tools only available in development environment');
        } else {
          setError('Failed to load users');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleUserSwitch = async (userId) => {
    if (!userId || userId === String(currentUser?.id)) return;

    setSwitching(true);
    try {
      await axios.post(`/auth/dev/switch?user_id=${userId}`);

      // Clear React Query cache
      queryClient.clear();

      // Reload page to apply new session
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch user:', err);
      setSwitching(false);
      setError('Failed to switch user');
    }
  };

  // Format user display: "Name (email) - Role"
  const formatUserDisplay = (user) => {
    const rolePart = user.access_level ? ` - ${user.access_level.charAt(0).toUpperCase() + user.access_level.slice(1)}` : '';
    return `${user.name} (${user.email})${rolePart}`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">{error}</p>
    );
  }

  return (
    <div className="space-y-3">
      <Select
        value={String(currentUser?.id || '')}
        onValueChange={handleUserSwitch}
        disabled={switching}
      >
        <SelectTrigger className="w-full max-w-md">
          <SelectValue placeholder="Select a user to switch to" />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={String(user.id)}>
              {formatUserDisplay(user)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {switching && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Switching user...
        </div>
      )}
    </div>
  );
}
