import { cn } from "@/lib/utils"

interface MessageProps {
  text: string
  userId: string
  timestamp: number
  isOwn: boolean
}

function Message({ text, userId, timestamp, isOwn }: MessageProps) {
  const time = new Date(timestamp).toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  })

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isOwn ? "items-end" : "items-start"
      )}
    >
      {!isOwn && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-grid/60">
          {userId}
        </span>
      )}
      <div
        className={cn(
          "max-w-[80%] border px-3 py-2",
          isOwn 
            ? "border-forest bg-forest text-paper" 
            : "border-grid-line bg-white text-grid"
        )}
      >
        <p className="font-sans text-sm leading-relaxed">{text}</p>
      </div>
      <span className="font-mono text-[9px] tracking-wider text-grid/40">
        {time}
      </span>
    </div>
  )
}

export { Message }
