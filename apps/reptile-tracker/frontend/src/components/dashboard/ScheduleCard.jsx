import PropTypes from 'prop-types'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * ScheduleCard - Display a schedule/task card with responsible user avatars
 *
 * Props:
 * - schedule: object (required) - The schedule instance data
 * - responsibleUsers: array (optional) - Array of user objects {id, name, avatar_url}
 * - children: React node - Card content
 * - className: string - Additional CSS classes
 *
 * Displays:
 * - Schedule/task information (passed as children)
 * - Avatar badges of responsible users in bottom-right corner
 * - Stacked avatars (max 3 visible + overflow count)
 * - Gracefully hides avatars for single-user households (when responsibleUsers is undefined/empty)
 */
export default function ScheduleCard({ schedule, responsibleUsers, children, className, ...props }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50",
        className
      )}
      {...props}
    >
      {/* Card content */}
      <div className="pr-12">{/* Add padding-right to prevent overlap with avatars */}
        {children}
      </div>

      {/* Responsible user avatar badges - bottom-right corner */}
      {responsibleUsers && responsibleUsers.length > 0 && (
        <TooltipProvider>
          <div className="absolute bottom-2 right-2 flex -space-x-1.5">
            {responsibleUsers.slice(0, 3).map((user, idx) => (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "relative",
                      idx === 0 ? "z-30" : idx === 1 ? "z-20" : "z-10"
                    )}
                  >
                    <Avatar className="w-5 h-5 ring-2 ring-background">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} alt={user.name} />
                      ) : (
                        <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {user.name}
                </TooltipContent>
              </Tooltip>
            ))}
            {responsibleUsers.length > 3 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] ring-2 ring-background z-0">
                    +{responsibleUsers.length - 3}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {responsibleUsers.slice(3).map(u => u.name).join(', ')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}

ScheduleCard.propTypes = {
  schedule: PropTypes.object.isRequired,
  responsibleUsers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    avatar_url: PropTypes.string
  })),
  children: PropTypes.node,
  className: PropTypes.string
}
