import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Custom variants for reptile care tracking
        due: "border-transparent bg-amber-500/20 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400",
        overdue: "border-transparent bg-red-500/20 text-red-500 dark:bg-red-500/10 dark:text-red-400",
        done: "border-transparent bg-green-500/20 text-green-500 dark:bg-green-500/10 dark:text-green-400",
        mist: "border-transparent bg-blue-500/20 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
