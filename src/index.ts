import { ChatRoom } from "./chat-room.do"
import { PresenceDO } from "./presence.do"
import { Env } from "./services/do-context"

export { ChatRoom, PresenceDO }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers)
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    if (url.pathname === "/health") {
      return json({ status: "ok", ts: Date.now() })
    }

    const roomMatch = url.pathname.match(/^\/room\/([^/]+)(.*)$/)
    if (roomMatch) {
      const [, roomId, subPath] = roomMatch
      const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(roomId))

      const doUrl = new URL(request.url)
      doUrl.pathname = subPath || "/"

      const response = await stub.fetch(
        new Request(doUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        })
      )

      if (response.status === 101) {
        return response
      }

      return withCors(response)
    }

    if (url.pathname === "/" || url.pathname === "/api") {
      return json({
        name: "Effect + Durable Objects Chat API",
        version: "1.0.0",
        endpoints: {
          "GET /health": "Health check",
          "GET /room/:id": "WebSocket upgrade (add ?userId=xxx)",
          "GET /room/:id/online": "Get online users",
          "GET /room/:id/messages": "Get recent messages",
          "GET /room/:id/settings": "Get room settings"
        },
        websocket: {
          connect: "ws://host/room/:id?userId=xxx",
          messages: {
            send: { _tag: "SendMessage", msgId: "uuid", text: "Hello!" },
            typing: { _tag: "Typing", isTyping: true },
            join: { _tag: "JoinRoom", roomId: "room-id" }
          }
        }
      })
    }

    return json({ error: "Not found" }, 404)
  }
}
