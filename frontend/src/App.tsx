import { useState, useEffect, useRef } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RoomId, UserId, type RoomId as RoomIdType, type UserId as UserIdType } from "@shared/types"
import { Send, Plus, Share2, LogOut, PanelLeftClose, PanelLeft } from "lucide-react"

import { Button, Input, Card, StatusBadge, ScrollArea } from "@/components/ui"
import { Message, RoomList, OnlineUsers, TypingIndicator } from "@/components/chat"
import { useChat } from "@/hooks/use-chat"

const API_URL = "wss://durable-effect-chat.bikash-d68.workers.dev"
const STORAGE_KEY = "chat-user"
const DEFAULT_ROOMS = ["general", "random", "tech"]

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
})

const getRoomFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search)
  return params.get("room")
}

const setRoomInUrl = (roomId: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set("room", roomId)
  window.history.pushState({}, "", url.toString())
}

interface StoredUser {
  userId: string
  rooms: string[]
}

const getStoredUser = (): StoredUser | null => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

const storeUser = (userId: string, rooms: string[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, rooms }))
}

function LoginForm({ 
  onJoin 
}: { 
  onJoin: (roomId: RoomIdType, userId: UserIdType) => void 
}) {
  const urlRoom = getRoomFromUrl()
  const [roomId, setRoomId] = useState(urlRoom ?? "general")
  const [userId, setUserId] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (userId.trim()) {
      onJoin(RoomId(roomId), UserId(userId.trim()))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <Card corners className="w-full max-w-sm">
        <div className="border-b border-grid-line p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
            Join Chat
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-grid/60">
            Real-time messaging
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <Input
            id="room"
            label="Room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="general"
          />
          <Input
            id="name"
            label="Your Name"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
          <Button type="submit" disabled={!userId.trim()} className="mt-2">
            Enter Room
          </Button>
        </form>
      </Card>
    </div>
  )
}

interface ChatViewProps {
  roomId: RoomIdType
  userId: UserIdType
  rooms: string[]
  onRoomChange: (room: string) => void
  onAddRoom: (room: string) => void
  onLogout: () => void
}

function ChatView({ 
  roomId, 
  userId, 
  rooms, 
  onRoomChange, 
  onAddRoom, 
  onLogout 
}: ChatViewProps) {
  const [inputText, setInputText] = useState("")
  const [newRoom, setNewRoom] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    isConnected,
    messages,
    isLoadingMessages,
    onlineUsers,
    typingUsers,
    sendMessage,
    isSending,
    sendTyping,
  } = useChat(roomId, userId, { baseUrl: API_URL })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)
    if (e.target.value.length > 0) sendTyping(true)
  }

  const handleSend = () => {
    if (!inputText.trim()) return
    sendMessage(inputText.trim())
    setInputText("")
    sendTyping(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRoom.trim() && !rooms.includes(newRoom.trim())) {
      onAddRoom(newRoom.trim())
      setNewRoom("")
    }
  }

  const copyShareLink = async () => {
    const url = `${window.location.origin}?room=${roomId}`
    await navigator.clipboard.writeText(url)
  }

  return (
    <div className="flex h-screen bg-paper">
      {sidebarOpen && (
        <aside className="flex w-64 flex-col border-r border-grid-line">
          <div className="flex items-center justify-between border-b border-grid-line p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center bg-forest">
                <span className="font-mono text-xs font-bold text-paper">C</span>
              </div>
              <span className="font-mono text-xs font-medium text-forest">{userId}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <RoomList
              rooms={rooms}
              currentRoom={roomId}
              onRoomSelect={onRoomChange}
            />

            <form onSubmit={handleAddRoom} className="flex gap-1 p-2">
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                placeholder="New room..."
                className="flex-1 border border-grid-line bg-transparent px-2 py-1 font-mono text-[11px] text-grid placeholder:text-grid/40 focus:outline-none focus:ring-1 focus:ring-forest"
              />
              <Button type="submit" size="sm" variant="outline">
                <Plus className="h-3 w-3" />
              </Button>
            </form>

            <div className="border-t border-grid-line">
              <OnlineUsers users={onlineUsers} currentUserId={userId} />
            </div>
          </ScrollArea>

          <div className="border-t border-grid-line p-2">
            <Button variant="outline" size="sm" className="w-full" onClick={copyShareLink}>
              <Share2 className="mr-2 h-3 w-3" />
              Share Room
            </Button>
          </div>
        </aside>
      )}

      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-grid-line px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-semibold text-forest">
              #{roomId}
            </h2>
            <StatusBadge
              status={isConnected ? "online" : "offline"}
              label={isConnected ? "Connected" : "Reconnecting"}
            />
          </div>

          <span className="ml-auto font-mono text-[10px] text-grid/50">
            {onlineUsers.length} online
          </span>
        </header>

        <ScrollArea className="flex-1 p-4">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-[11px] text-grid/50">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <span className="font-mono text-[11px] text-grid/50">No messages yet</span>
              <span className="font-mono text-[10px] text-grid/30">Say hello!</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg, idx) => (
                <Message
                  key={msg.msgId ?? idx}
                  text={msg.text}
                  userId={msg.userId}
                  timestamp={msg.ts}
                  isOwn={msg.userId === userId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <TypingIndicator users={typingUsers} currentUserId={userId} />

        <div className="border-t border-grid-line p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="flex-1 border border-grid-line bg-white px-4 py-2.5 font-sans text-sm text-grid placeholder:text-grid/40 focus:outline-none focus:ring-1 focus:ring-forest disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={!isConnected || !inputText.trim() || isSending}
            >
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

function AppContent() {
  const stored = getStoredUser()
  const urlRoom = getRoomFromUrl()

  const [roomId, setRoomId] = useState<RoomIdType | null>(
    stored?.userId ? RoomId(urlRoom ?? stored.rooms[0] ?? "general") : null
  )
  const [userId, setUserId] = useState<UserIdType | null>(
    stored?.userId ? UserId(stored.userId) : null
  )
  const [rooms, setRooms] = useState<string[]>(stored?.rooms ?? DEFAULT_ROOMS)

  useEffect(() => {
    if (roomId && userId) {
      setRoomInUrl(roomId)
      storeUser(userId, rooms)
    }
  }, [roomId, userId, rooms])

  useEffect(() => {
    const handlePopState = () => {
      const room = getRoomFromUrl()
      if (room) setRoomId(RoomId(room))
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const handleJoin = (room: RoomIdType, user: UserIdType) => {
    const uniqueRooms = [...new Set([...rooms, room])]
    setRooms(uniqueRooms)
    setRoomId(room)
    setUserId(user)
    storeUser(user, uniqueRooms)
    setRoomInUrl(room)
  }

  const handleRoomChange = (room: string) => {
    setRoomId(RoomId(room))
    setRoomInUrl(room)
  }

  const handleAddRoom = (room: string) => {
    const uniqueRooms = [...new Set([...rooms, room])]
    setRooms(uniqueRooms)
    handleRoomChange(room)
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUserId(null)
    setRoomId(null)
  }

  if (!roomId || !userId) {
    return <LoginForm onJoin={handleJoin} />
  }

  return (
    <ChatView
      roomId={roomId}
      userId={userId}
      rooms={rooms}
      onRoomChange={handleRoomChange}
      onAddRoom={handleAddRoom}
      onLogout={handleLogout}
    />
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
