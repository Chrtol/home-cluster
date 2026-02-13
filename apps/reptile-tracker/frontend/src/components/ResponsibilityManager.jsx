import { useState, useEffect } from 'react'
import axios from 'axios'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'

/**
 * ResponsibilityManager - Assign responsibility for reptile care
 *
 * Props:
 * - reptileId: number (required) - The reptile to manage
 * - scheduleId: number | null (optional) - For schedule-level override (future enhancement)
 *
 * Behavior:
 * - Hides completely for single-user households (per user decision)
 * - Multi-user households can assign multiple users per reptile
 * - Self-remove allowed anytime (per user decision)
 * - Immediate effect on change (no explicit save button needed)
 */
export default function ResponsibilityManager({ reptileId, scheduleId = null }) {
  const [householdMembers, setHouseholdMembers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [isSingleUser, setIsSingleUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [reptileId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Check if single-user household
      const overviewRes = await axios.get('/api/responsibilities/overview')
      const isSingle = overviewRes.data.is_single_user_household
      setIsSingleUser(isSingle)

      // If single-user, no need to fetch more data
      if (isSingle) {
        setLoading(false)
        return
      }

      // Fetch current user
      const userRes = await axios.get('/auth/me')
      setCurrentUserId(userRes.data.id)

      // Fetch household members
      const membersRes = await axios.get('/api/households/current/members')
      setHouseholdMembers(membersRes.data)

      // Fetch current assignments
      const assignmentsRes = await axios.get(`/api/responsibilities/reptiles/${reptileId}`)
      setAssignments(assignmentsRes.data.user_ids || [])
    } catch (err) {
      console.error('Failed to fetch responsibility data:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleUserAssignment = async (userId) => {
    if (saving) return

    setSaving(true)
    try {
      const newAssignments = assignments.includes(userId)
        ? assignments.filter(id => id !== userId)
        : [...assignments, userId]

      // Save to API
      await axios.put(`/api/responsibilities/reptiles/${reptileId}`, {
        user_ids: newAssignments
      })

      // Update local state
      setAssignments(newAssignments)
    } catch (err) {
      console.error('Failed to update responsibility assignment:', err)
      // Optionally show error toast
    } finally {
      setSaving(false)
    }
  }

  const isAssigned = (userId) => {
    return assignments.includes(userId)
  }

  const canRemoveSelf = () => {
    // Can remove self if:
    // 1. Current user is assigned
    // 2. There are other assignees OR no assignments (fallback to all)
    return isAssigned(currentUserId) && (assignments.length > 1 || assignments.length === 0)
  }

  const handleRemoveSelf = async () => {
    if (!canRemoveSelf() || saving) return
    await toggleUserAssignment(currentUserId)
  }

  // Single-user household: hide completely
  if (isSingleUser) {
    return null
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-secondary rounded"></div>
        <div className="h-10 bg-secondary rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Responsible Users</Label>
      <p className="text-xs text-muted-foreground">
        Select who is responsible for this reptile's care. Tasks completed by any responsible user maintain everyone's streak.
      </p>

      <div className="flex flex-wrap gap-2">
        {householdMembers.map(member => (
          <button
            key={member.id}
            onClick={() => toggleUserAssignment(member.id)}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isAssigned(member.id)
                ? "bg-primary/20 border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[10px]">
                {member.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{member.name}</span>
            {isAssigned(member.id) && <Check className="w-3 h-3" />}
          </button>
        ))}
      </div>

      {assignments.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No one assigned = Everyone is responsible
        </p>
      )}

      {canRemoveSelf() && (
        <button
          onClick={handleRemoveSelf}
          disabled={saving}
          className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          Remove myself
        </button>
      )}
    </div>
  )
}
