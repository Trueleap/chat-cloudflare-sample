import { cn } from "@/lib/utils"
import { Hash } from "lucide-react"

interface RoomListProps {
  rooms: string[]
  currentRoom: string
  onRoomSelect: (room: string) => void
}

function RoomList({ rooms, currentRoom, onRoomSelect }: RoomListProps) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-grid-line px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-grid/50">
          Rooms
        </span>
      </div>
      <div className="flex flex-col py-1">
        {rooms.map((room, index) => (
          <button
            key={room}
            onClick={() => onRoomSelect(room)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-left transition-colors",
              room === currentRoom
                ? "border-l-2 border-forest bg-forest/5 text-forest"
                : "border-l-2 border-transparent text-grid hover:bg-grid/5"
            )}
          >
            <span className="font-mono text-[9px] text-grid/40">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Hash className="h-3 w-3" />
            <span className="font-mono text-xs">{room}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { RoomList }
