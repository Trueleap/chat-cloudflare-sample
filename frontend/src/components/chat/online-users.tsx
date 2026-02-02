import { UserBadge } from "@/components/ui"
import { Users } from "lucide-react"

interface OnlineUsersProps {
  users: string[]
  currentUserId: string
}

function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-grid-line px-4 py-2">
        <Users className="h-3 w-3 text-grid/50" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-grid/50">
          Online
        </span>
        <span className="ml-auto font-mono text-[10px] text-grid/40">
          {users.length}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {users.length === 0 ? (
          <span className="px-2 py-4 text-center font-mono text-[10px] text-grid/40">
            No users online
          </span>
        ) : (
          users.map((user) => (
            <UserBadge
              key={user}
              name={user}
              isCurrentUser={user === currentUserId}
              isOnline
              className="w-full"
            />
          ))
        )}
      </div>
    </div>
  )
}

export { OnlineUsers }
