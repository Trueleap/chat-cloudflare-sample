import { type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface UserBadgeProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  isCurrentUser?: boolean
  isOnline?: boolean
}

function UserBadge({ 
  name, 
  isCurrentUser = false, 
  isOnline = true,
  className, 
  ...props 
}: UserBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 border border-grid-line px-2.5 py-1 font-mono text-[11px] tracking-wide",
        isCurrentUser && "border-forest bg-forest/5",
        className
      )}
      {...props}
    >
      <div 
        className={cn(
          "h-1.5 w-1.5",
          isOnline ? "bg-forest" : "bg-grid/30"
        )} 
      />
      <span className={cn(isCurrentUser && "font-medium text-forest")}>
        {name}
        {isCurrentUser && <span className="ml-1 text-grid/50">(you)</span>}
      </span>
    </div>
  )
}

export { UserBadge }
