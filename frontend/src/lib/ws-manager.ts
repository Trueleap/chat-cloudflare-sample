import type { RoomId, UserId, ClientMessage, ServerMessage } from "@shared/types"

export type MessageHandler = (msg: ServerMessage) => void

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

export const wsManager = new WebSocketManager()
