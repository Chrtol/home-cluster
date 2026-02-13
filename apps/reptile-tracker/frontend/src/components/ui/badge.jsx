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
        outline: "text-muted-foreground bg-muted/30 border-muted-foreground/30 hover:bg-muted/50",
        // Custom variants for reptile care tracking
        due: "border-transparent bg-amber-500/20 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400",
        overdue: "border-transparent bg-red-500/20 text-red-500 dark:bg-red-500/10 dark:text-red-400",
        done: "border-transparent bg-green-500/20 text-green-500 dark:bg-green-500/10 dark:text-green-400",
        mist: "border-transparent bg-blue-500/20 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400",
        // Statistics data visibility active variants (avoid tw-merge conflicts)
        weightActive: "border-transparent bg-blue-500 text-white shadow hover:bg-blue-500/90",
        feedingActive: "border-transparent bg-green-500 text-white shadow hover:bg-green-500/90",
        mistingActive: "border-transparent bg-blue-400 text-white shadow hover:bg-blue-400/90",
        healthActive: "border-transparent bg-red-400 text-white shadow hover:bg-red-400/90",
        // Streak milestone variants (warm color progression)
        "streak-active": "border-transparent bg-orange-500/20 text-orange-500",
        "streak-bronze": "border-transparent bg-orange-600/30 text-orange-600",
        "streak-gold": "border-transparent bg-amber-500/30 text-amber-500",
        "streak-platinum": "border-transparent bg-yellow-500/30 text-yellow-500 font-bold",
        "streak-diamond": "border-transparent bg-purple-500/30 text-purple-400 font-bold ring-1 ring-purple-500/50",
        // Birthday countdown variants (pink escalation)
        "birthday-approaching": "border-transparent bg-pink-500/10 text-pink-500",
        "birthday-soon": "border-transparent bg-pink-500/20 text-pink-600",
        "birthday-imminent": "border-transparent bg-pink-500/30 text-pink-700 font-semibold",
        "birthday-today": "border-transparent bg-pink-500 text-white shadow font-bold",
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
