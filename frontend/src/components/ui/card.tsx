import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  corners?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, corners = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative border border-grid-line bg-paper", className)}
        {...props}
      >
        {corners && (
          <>
            <div className="absolute -left-px -top-px h-2.5 w-2.5 border-l border-t border-forest" />
            <div className="absolute -right-px -top-px h-2.5 w-2.5 border-r border-t border-forest" />
            <div className="absolute -bottom-px -left-px h-2.5 w-2.5 border-b border-l border-forest" />
            <div className="absolute -bottom-px -right-px h-2.5 w-2.5 border-b border-r border-forest" />
          </>
        )}
        {children}
      </div>
    )
  }
)
Card.displayName = "Card"

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("border-b border-grid-line p-4", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardContent }
