import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="font-mono text-[10px] uppercase tracking-widest text-grid/70"
          >
            {label}
          </label>
        )}
        <input
          id={id}
          className={cn(
            "h-10 w-full border border-grid-line bg-white px-3 font-mono text-sm text-grid placeholder:text-grid/40 focus:outline-none focus:ring-1 focus:ring-forest",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
