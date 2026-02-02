import { queryOptions } from "@tanstack/react-query"
import type { RoomId, MessageEvent } from "@shared/types"

export const roomQueries = {
  all: (roomId: RoomId) => ["room", roomId] as const,

  messagesKey: (roomId: RoomId) => [...roomQueries.all(roomId), "messages"] as const,
  messages: (roomId: RoomId, httpBaseUrl: string) =>
    queryOptions({
      queryKey: roomQueries.messagesKey(roomId),
      queryFn: async () => {
        const res = await fetch(`${httpBaseUrl}/room/${roomId}/messages`)
        return res.json() as Promise<{ messages: MessageEvent[] }>
      },
    }),

  onlineKey: (roomId: RoomId) => [...roomQueries.all(roomId), "online"] as const,
  online: (roomId: RoomId, httpBaseUrl: string) =>
    queryOptions({
      queryKey: roomQueries.onlineKey(roomId),
      queryFn: async () => {
        const res = await fetch(`${httpBaseUrl}/room/${roomId}/online`)
        return res.json() as Promise<{ users: string[]; count: number }>
      },
      refetchInterval: 30000,
    }),

  typingKey: (roomId: RoomId) => ["ws", "typing", roomId] as const,
  typing: (roomId: RoomId) =>
    queryOptions({
      queryKey: roomQueries.typingKey(roomId),
      queryFn: (): { users: string[] } => ({ users: [] }),
      staleTime: Infinity,
    }),
}
