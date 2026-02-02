import { useEffect, useCallback, useState } from "react"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"
import { useDebouncedCallback } from "@tanstack/react-pacer"
import {
  MessageId,
  type RoomId,
  type UserId,
  type ClientMessage,
  type ServerMessage,
  type MessageEvent,
} from "@shared/types"

type MessageHandler = (msg: ServerMessage) => void

class WebSocketManager {
  private sockets = new Map<string, WebSocket>()
  private handlers = new Map<string, Set<MessageHandler>>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

  private getKey(roomId: RoomId, userId: UserId) {
    return `${roomId}:${userId}`
  }

  connect(
    baseUrl: string,
    roomId: RoomId,
    userId: UserId,
    onStatusChange?: (connected: boolean) => void
  ): () => void {
    const key = this.getKey(roomId, userId)

    if (this.sockets.get(key)?.readyState === WebSocket.OPEN) {
      onStatusChange?.(true)
      return () => this.removeHandler(key, () => {})
    }

    const url = `${baseUrl}/room/${roomId}?userId=${userId}`
    const ws = new WebSocket(url)

    ws.onopen = () => onStatusChange?.(true)

    ws.onclose = () => {
      onStatusChange?.(false)
      this.sockets.delete(key)
      const timer = setTimeout(() => {
        this.connect(baseUrl, roomId, userId, onStatusChange)
      }, 3000)
      this.reconnectTimers.set(key, timer)
    }

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        this.handlers.get(key)?.forEach((handler) => handler(msg))
      } catch {
        // ignore malformed messages
      }
    }

    this.sockets.set(key, ws)

    return () => {
      const timer = this.reconnectTimers.get(key)
      if (timer) clearTimeout(timer)
      ws.close()
      this.sockets.delete(key)
    }
  }

  send(roomId: RoomId, userId: UserId, msg: ClientMessage) {
    const key = this.getKey(roomId, userId)
    const ws = this.sockets.get(key)
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }

  addHandler(roomId: RoomId, userId: UserId, handler: MessageHandler) {
    const key = this.getKey(roomId, userId)
    const existing = this.handlers.get(key)
    if (existing) {
      existing.add(handler)
    } else {
      this.handlers.set(key, new Set([handler]))
    }
  }

  removeHandler(key: string, handler: MessageHandler) {
    this.handlers.get(key)?.delete(handler)
  }
}

const wsManager = new WebSocketManager()

const queryKeys = {
  room: {
    online: (roomId: RoomId) => ["room", roomId, "online"] as const,
    messages: (roomId: RoomId) => ["room", roomId, "messages"] as const,
  },
}

interface UseChatOptions {
  baseUrl: string
  enabled?: boolean
}

export function useChat(roomId: RoomId, userId: UserId, options: UseChatOptions) {
  const { baseUrl, enabled = true } = options
  const httpBaseUrl = baseUrl.replace("ws://", "http://").replace("wss://", "https://")
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  const messagesQuery = useQuery({
    queryKey: queryKeys.room.messages(roomId),
    queryFn: async () => {
      const res = await fetch(`${httpBaseUrl}/room/${roomId}/messages`)
      const data: { messages: MessageEvent[] } = await res.json()
      return data
    },
    enabled,
  })

  const onlineQuery = useQuery({
    queryKey: queryKeys.room.online(roomId),
    queryFn: async () => {
      const res = await fetch(`${httpBaseUrl}/room/${roomId}/online`)
      const data: { users: string[]; count: number } = await res.json()
      return data
    },
    enabled,
    refetchInterval: 30000,
  })

  const typingQuery = useQuery({
    queryKey: ["ws", "typing", roomId],
    queryFn: (): { users: string[] } => ({ users: [] }),
    staleTime: Infinity,
  })

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg._tag) {
        case "Message":
          queryClient.setQueryData(
            queryKeys.room.messages(roomId),
            (old: { messages: MessageEvent[] } | undefined) => {
              if (!old) return { messages: [msg] }
              if (old.messages.some((m) => m.msgId === msg.msgId)) return old
              return { messages: [...old.messages, msg] }
            }
          )
          break

        case "UserJoined":
          queryClient.setQueryData(
            queryKeys.room.online(roomId),
            (old: { users: string[]; count: number } | undefined) => {
              if (!old) return { users: [msg.userId], count: 1 }
              if (old.users.includes(msg.userId)) return old
              return { users: [...old.users, msg.userId], count: old.count + 1 }
            }
          )
          break

        case "UserLeft":
          queryClient.setQueryData(
            queryKeys.room.online(roomId),
            (old: { users: string[]; count: number } | undefined) => {
              if (!old) return old
              return {
                users: old.users.filter((u) => u !== msg.userId),
                count: Math.max(0, old.count - 1),
              }
            }
          )
          queryClient.setQueryData(
            ["ws", "typing", roomId],
            (old: { users: string[] } | undefined) => ({
              users: old?.users.filter((u) => u !== msg.userId) ?? [],
            })
          )
          break

        case "UserTyping":
          queryClient.setQueryData(
            ["ws", "typing", roomId],
            (old: { users: string[] } | undefined) => {
              const users = old?.users ?? []
              if (msg.isTyping) {
                if (users.includes(msg.userId)) return old
                return { users: [...users, msg.userId] }
              }
              return { users: users.filter((u) => u !== msg.userId) }
            }
          )
          break
      }
    },
    [queryClient, roomId]
  )

  useEffect(() => {
    if (!enabled) return

    wsManager.addHandler(roomId, userId, handleMessage)
    const disconnect = wsManager.connect(baseUrl, roomId, userId, setIsConnected)

    return () => {
      wsManager.removeHandler(`${roomId}:${userId}`, handleMessage)
      disconnect()
    }
  }, [baseUrl, roomId, userId, enabled, handleMessage])

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const msgId = MessageId(crypto.randomUUID())
      const sent = wsManager.send(roomId, userId, { _tag: "SendMessage", msgId, text })
      if (!sent) throw new Error("Not connected")
      return { msgId, text }
    },
    onMutate: async (text) => {
      const msgId = MessageId(crypto.randomUUID())
      const optimisticMsg: MessageEvent = {
        _tag: "Message",
        msgId,
        userId,
        text,
        ts: Date.now(),
      }
      queryClient.setQueryData(
        queryKeys.room.messages(roomId),
        (old: { messages: MessageEvent[] } | undefined) => ({
          messages: [...(old?.messages ?? []), optimisticMsg],
        })
      )
      return { optimisticMsg }
    },
    onError: (_err, _text, context) => {
      if (context?.optimisticMsg) {
        queryClient.setQueryData(
          queryKeys.room.messages(roomId),
          (old: { messages: MessageEvent[] } | undefined) => ({
            messages: old?.messages.filter((m) => m.msgId !== context.optimisticMsg.msgId) ?? [],
          })
        )
      }
    },
  })

  const stopTyping = useDebouncedCallback(
    () => wsManager.send(roomId, userId, { _tag: "Typing", isTyping: false }),
    { wait: 3000 }
  )

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      wsManager.send(roomId, userId, { _tag: "Typing", isTyping })
      if (isTyping) {
        stopTyping()
      }
    },
    [roomId, userId, stopTyping]
  )

  return {
    isConnected,
    messages: messagesQuery.data?.messages ?? [],
    isLoadingMessages: messagesQuery.isLoading,
    onlineUsers: onlineQuery.data?.users ?? [],
    onlineCount: onlineQuery.data?.count ?? 0,
    typingUsers: typingQuery.data?.users ?? [],
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    sendTyping,
  }
}
