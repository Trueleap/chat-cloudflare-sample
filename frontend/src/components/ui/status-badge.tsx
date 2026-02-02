import { type HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-2 border border-grid-line px-3 py-1 font-mono text-[10px] uppercase tracking-widest",
  {
    variants: {
      status: {
        online: "",
        offline: "",
        away: "",
      },
    },
    defaultVariants: {
      status: "offline",
    },
  }
)

interface StatusBadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string
}

function StatusBadge({ className, status, label, ...props }: StatusBadgeProps) {
  const dotColor = {
    online: "bg-forest",
    offline: "bg-grid/30",
    away: "bg-gold",
  }[status ?? "offline"]

  return (
    <div className={cn(statusBadgeVariants({ status, className }))} {...props}>
      <div className={cn("h-2 w-2", dotColor)} />
      <span>{label ?? status}</span>
    </div>
  )
}

export { StatusBadge }
