import { Effect, Layer, ManagedRuntime, Option } from "effect"
import { DOEnv, DOState, Env } from "./services/do-context"
import { makeRoomId, makeUserId, RoomId, UserId } from "./domain/ids"
import { makeWSConnection } from "./services/ws-connection"
import { MessageHandler } from "./services/message-handler"
import { RateLimiter } from "./services/rate-limiter"
import { StorageService } from "./services/storage"
import { SyncService } from "./services/sync"
import { WSHub } from "./services/ws-hub"
import { PresenceClient } from "./services/presence-client"

type AppServices = MessageHandler | WSHub | StorageService | SyncService | RateLimiter | PresenceClient

const makeAppLayer = (ctx: DurableObjectState, env: Env) =>
  Layer.mergeAll(
    MessageHandler.Default,
    WSHub.Default,
    StorageService.Default,
    RateLimiter.Default,
    SyncService.Default,
    PresenceClient.Default
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(DOState, ctx),
        Layer.succeed(DOEnv, env)
      )
    )
  )

const getUserIdFromTags = (tags: readonly string[]): Option.Option<UserId> =>
  tags.length > 0 && tags[0].length > 0
    ? Option.some(makeUserId(tags[0]))
    : Option.none()

const validateUserId = (value: string | null): Option.Option<UserId> =>
  value !== null && value.length > 0 && value.length <= 100
    ? Option.some(makeUserId(value))
    : Option.none()

export class ChatRoom implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly runtime: ManagedRuntime.ManagedRuntime<AppServices, never>
  private readonly roomId: RoomId
  private initialized = false

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.roomId = makeRoomId(ctx.id.toString())
    this.runtime = ManagedRuntime.make(makeAppLayer(ctx, env))
  }

  private run<A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> {
    return this.runtime.runPromise(effect)
  }

  private ensureInitialized(): Promise<void> {
    if (this.initialized) return Promise.resolve()
    this.initialized = true
    return this.run(
      Effect.all([
        Effect.flatMap(StorageService, (s) => s.initialize),
        this.rehydrateConnections()
      ]).pipe(Effect.asVoid)
    )
  }

  private rehydrateConnections(): Effect.Effect<void, never, WSHub | PresenceClient> {
    const sockets = this.ctx.getWebSockets()
    const ctx = this.ctx
    const roomId = this.roomId
    return Effect.gen(function*() {
      const hub = yield* WSHub
      const presence = yield* PresenceClient
      yield* Effect.forEach(
        sockets,
        (ws) =>
          Option.match(getUserIdFromTags(ctx.getTags(ws)), {
            onNone: () => Effect.void,
            onSome: (userId) =>
              Effect.all([
                hub.register(makeWSConnection(ws, userId, crypto.randomUUID())),
                presence.join(roomId, userId)
              ]).pipe(Effect.asVoid)
          }),
        { discard: true }
      )
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get("Upgrade") === "websocket") {
      const maybeUserId = validateUserId(url.searchParams.get("userId"))

      if (Option.isNone(maybeUserId)) {
        return Response.json({ error: "Invalid or missing userId" }, { status: 400 })
      }

      await this.ensureInitialized()
      const userId = maybeUserId.value
      const roomId = this.roomId
      const [client, server] = Object.values(new WebSocketPair())
      const ctx = this.ctx

      await this.run(
        Effect.gen(function*() {
          const handler = yield* MessageHandler
          const presence = yield* PresenceClient
          const conn = makeWSConnection(server, userId, crypto.randomUUID())
          yield* handler.handleConnect(conn)
          yield* presence.join(roomId, userId)
          yield* Effect.sync(() => ctx.acceptWebSocket(server, [userId]))
        })
      )

      return new Response(null, { status: 101, webSocket: client })
    }

    await this.ensureInitialized()

    if (url.pathname === "/online" && request.method === "GET") {
      const result = await this.run(
        Effect.flatMap(PresenceClient, (p) => p.getOnlineUsers(this.roomId))
      )
      return Response.json(result)
    }

    if (url.pathname === "/messages" && request.method === "GET") {
      const limitParam = url.searchParams.get("limit")
      const limit = Math.min(Math.max(parseInt(limitParam ?? "50") || 50, 1), 100)
      const messages = await this.run(Effect.flatMap(StorageService, (s) => s.getRecentMessages(limit)))
      return Response.json({ messages })
    }

    if (url.pathname === "/settings" && request.method === "GET") {
      const settings = await this.run(
        Effect.flatMap(StorageService, (s) => s.getSettings).pipe(
          Effect.map(Option.getOrElse(() => ({ name: "Unnamed Room", isPrivate: false, maxMembers: 100 })))
        )
      )
      return Response.json(settings)
    }

    return Response.json({ error: "Not found" }, { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const maybeUserId = getUserIdFromTags(this.ctx.getTags(ws))
    if (Option.isNone(maybeUserId)) return

    await this.ensureInitialized()
    const conn = makeWSConnection(ws, maybeUserId.value, crypto.randomUUID())
    const roomId = this.roomId

    await this.run(
      Effect.flatMap(MessageHandler, (h) =>
        h.handleMessage(roomId, conn, message).pipe(
          Effect.catchAll((e) => conn.send({ _tag: "Error", code: "INTERNAL_ERROR", message: String(e) }))
        )
      )
    )
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string): Promise<void> {
    const maybeUserId = getUserIdFromTags(this.ctx.getTags(ws))
    if (Option.isNone(maybeUserId)) return

    await this.ensureInitialized()
    const conn = makeWSConnection(ws, maybeUserId.value, crypto.randomUUID())
    const roomId = this.roomId
    const userId = maybeUserId.value

    await this.run(
      Effect.gen(function*() {
        const handler = yield* MessageHandler
        const presence = yield* PresenceClient
        yield* handler.handleDisconnect(conn)
        yield* presence.leave(roomId, userId)
      })
    )
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const maybeUserId = getUserIdFromTags(this.ctx.getTags(ws))
    const userId = Option.getOrElse(maybeUserId, () => makeUserId("unknown"))
    await this.run(Effect.logError("WebSocket error", { userId, error: String(error) }))
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized()
    await this.run(Effect.flatMap(SyncService, (s) => s.syncAndReschedule(this.roomId, 5000)))
  }
}
