import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Trash2, UserCog } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatting';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function HouseholdSettings() {
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog states for role change and remove member
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [pendingRemoveMember, setPendingRemoveMember] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get user's households
      const householdsRes = await axios.get('/api/households/me');
      if (householdsRes.data.length === 0) {
        setError('No household found');
        setLoading(false);
        return;
      }

      const household = householdsRes.data[0];
      setHousehold(household);

      // Get household members
      const membersRes = await axios.get(`/api/households/${household.id}/members`);
      setMembers(membersRes.data);

      // Find current user's role
      const userId = (await axios.get('/api/users/me')).data.id;
      const currentUser = membersRes.data.find(m => m.user_id === userId);
      setUserRole(currentUser?.access_level);

    } catch (err) {
      console.error('Failed to fetch household data:', err);
      setError('Failed to load household information');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    setPendingRoleChange({ userId, newRole });
    setRoleChangeDialogOpen(true);
  };

  const executeRoleChange = async () => {
    if (!pendingRoleChange) return;

    try {
      await axios.patch(`/api/households/${household.id}/members/${pendingRoleChange.userId}/role`, {
        access_level: pendingRoleChange.newRole
      });
      setSuccess('Role updated successfully');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
      setRoleChangeDialogOpen(false);
      setPendingRoleChange(null);
    } catch (err) {
      console.error('Failed to update role:', err);
      setError(err.response?.data?.detail || 'Failed to update role');
      setTimeout(() => setError(''), 3000);
      setRoleChangeDialogOpen(false);
      setPendingRoleChange(null);
    }
  };

  const handleRemoveMember = (userId, memberName) => {
    setPendingRemoveMember({ userId, memberName });
    setRemoveMemberDialogOpen(true);
  };

  const executeRemoveMember = async () => {
    if (!pendingRemoveMember) return;

    try {
      await axios.delete(`/api/households/${household.id}/members/${pendingRemoveMember.userId}`);
      setSuccess('Member removed successfully');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
      setRemoveMemberDialogOpen(false);
      setPendingRemoveMember(null);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(err.response?.data?.detail || 'Failed to remove member');
      setTimeout(() => setError(''), 3000);
      setRemoveMemberDialogOpen(false);
      setPendingRemoveMember(null);
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      caretaker: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      viewer: 'bg-secondary text-foreground'
    };

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colors[role]}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <LoadingState message="Loading household settings..." />;
  }

  if (!household) {
    return <div className="text-center py-12 text-red-500 dark:text-red-400">No household found</div>;
  }

  const isAdmin = ['owner', 'admin'].includes(userRole);

  return (
    <div>
      <PageHeader
        title="Household Settings"
        backLink={{ to: '/settings', label: 'Back to Settings' }}
      />

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="card mb-6">
        <h2 className="text-xl font-bold text-foreground mb-2">{household.name}</h2>
        <p className="text-sm text-muted-foreground">
          Created {formatDateTime(household.created_at)}
        </p>
      </div>

      {!isAdmin && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 px-4 py-3 rounded mb-6">
          <div className="flex items-center gap-2">
            <Shield size={20} />
            <p className="text-sm">
              You are a <strong>{userRole}</strong>. Only owners and admins can manage member roles.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold text-foreground mb-4">Members ({members.length})</h2>

        <div className="space-y-4">
          {members.map(member => (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-4 bg-card/50 rounded-lg"
            >
              <div className="flex-1">
                <h3 className="font-medium text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Joined {formatDateTime(member.joined_at)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {getRoleBadge(member.access_level)}

                {isAdmin && (
                  <div className="flex gap-2">
                    <select
                      value={member.access_level}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                      className="input py-1 px-2 text-sm"
                      disabled={member.access_level === userRole && member.user_id === members.find(m => m.access_level === userRole)?.user_id}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="caretaker">Caretaker</option>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button
                      onClick={() => handleRemoveMember(member.user_id, member.name)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="Remove member"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="font-semibold text-foreground mb-3">Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <strong className="text-blue-600 dark:text-blue-400">Owner:</strong>
              <span className="text-muted-foreground"> Full household control (members, invitations, reptiles)</span>
            </div>
            <div>
              <strong className="text-purple-600 dark:text-purple-400">Admin:</strong>
              <span className="text-muted-foreground"> Can manage members, invitations, and reptiles</span>
            </div>
            <div>
              <strong className="text-yellow-600 dark:text-yellow-400">Manager:</strong>
              <span className="text-muted-foreground"> Can edit reptiles and create invitations</span>
            </div>
            <div>
              <strong className="text-green-600 dark:text-green-400">Caretaker:</strong>
              <span className="text-muted-foreground"> Can log feedings, misting, weights</span>
            </div>
            <div>
              <strong className="text-muted-foreground">Viewer:</strong>
              <span className="text-muted-foreground"> Can only view reptiles and logs</span>
            </div>
          </div>
        </div>
      </div>

      {/* AlertDialog for role change confirmation */}
      <AlertDialog open={roleChangeDialogOpen} onOpenChange={setRoleChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Member Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change this member's role to {pendingRoleChange?.newRole}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRoleChange(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRoleChange}>Change Role</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog for remove member confirmation */}
      <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {pendingRemoveMember?.memberName} from the household?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRemoveMember(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={executeRemoveMember}>Remove Member</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
