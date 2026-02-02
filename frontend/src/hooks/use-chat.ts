import { useEffect, useCallback, useState } from "react"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"
import { useDebouncedCallback } from "@tanstack/react-pacer"
import { MessageId, type RoomId, type UserId, type ServerMessage, type MessageEvent } from "@shared/types"
import { wsManager } from "../lib/ws-manager"
import { roomQueries } from "../queries/room"

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
    ...roomQueries.messages(roomId, httpBaseUrl),
    enabled,
  })

  const onlineQuery = useQuery({
    ...roomQueries.online(roomId, httpBaseUrl),
    enabled,
  })

  const typingQuery = useQuery(roomQueries.typing(roomId))

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg._tag) {
        case "Message":
          queryClient.setQueryData(
            roomQueries.messagesKey(roomId),
            (old: { messages: MessageEvent[] } | undefined) => {
              if (!old) return { messages: [msg] }
              if (old.messages.some((m) => m.msgId === msg.msgId)) return old
              return { messages: [...old.messages, msg] }
            }
          )
          break

        case "UserJoined":
          queryClient.setQueryData(
            roomQueries.onlineKey(roomId),
            (old: { users: string[]; count: number } | undefined) => {
              if (!old) return { users: [msg.userId], count: 1 }
              if (old.users.includes(msg.userId)) return old
              return { users: [...old.users, msg.userId], count: old.count + 1 }
            }
          )
          break

        case "UserLeft":
          queryClient.setQueryData(
            roomQueries.onlineKey(roomId),
            (old: { users: string[]; count: number } | undefined) => {
              if (!old) return old
              return {
                users: old.users.filter((u) => u !== msg.userId),
                count: Math.max(0, old.count - 1),
              }
            }
          )
          queryClient.setQueryData(
            roomQueries.typingKey(roomId),
            (old: { users: string[] } | undefined) => ({
              users: old?.users.filter((u) => u !== msg.userId) ?? [],
            })
          )
          break

        case "UserTyping":
          queryClient.setQueryData(
            roomQueries.typingKey(roomId),
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
        roomQueries.messagesKey(roomId),
        (old: { messages: MessageEvent[] } | undefined) => ({
          messages: [...(old?.messages ?? []), optimisticMsg],
        })
      )
      return { optimisticMsg }
    },
    onError: (_err, _text, context) => {
      if (context?.optimisticMsg) {
        queryClient.setQueryData(
          roomQueries.messagesKey(roomId),
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
