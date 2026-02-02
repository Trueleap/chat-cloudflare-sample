interface TypingIndicatorProps {
  users: string[]
  currentUserId: string
}

function TypingIndicator({ users, currentUserId }: TypingIndicatorProps) {
  const othersTyping = users.filter((u) => u !== currentUserId)
  
  if (othersTyping.length === 0) return null

  const text = othersTyping.length === 1
    ? `${othersTyping[0]} is typing`
    : `${othersTyping.join(", ")} are typing`

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <div className="h-1.5 w-1.5 animate-pulse bg-forest/60" />
        <div className="h-1.5 w-1.5 animate-pulse bg-forest/60 delay-100" />
        <div className="h-1.5 w-1.5 animate-pulse bg-forest/60 delay-200" />
      </div>
      <span className="font-mono text-[10px] italic text-grid/60">
        {text}
      </span>
    </div>
  )
}

export { TypingIndicator }
