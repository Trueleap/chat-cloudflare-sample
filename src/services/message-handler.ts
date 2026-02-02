import { Effect, Match } from "effect"
import { WSHub } from "./ws-hub"
import { StorageService } from "./storage"
import { RateLimiter } from "./rate-limiter"
import { parseClientMessage, WSConnection } from "./ws-connection"
import { SendMessageRequest, TypingRequest } from "../domain/ws-messages"
import { Message } from "../domain/schemas"
import { RoomId } from "../domain/ids"

export class MessageHandler extends Effect.Service<MessageHandler>()("MessageHandler", {
  accessors: true,
  dependencies: [WSHub.Default, StorageService.Default, RateLimiter.Default],
  effect: Effect.gen(function*() {
    const hub = yield* WSHub
    const storage = yield* StorageService
    const rateLimiter = yield* RateLimiter

    const handleSendMessage = (roomId: RoomId, conn: WSConnection, msg: SendMessageRequest) =>
      rateLimiter.check(conn.userId).pipe(
        Effect.tapError((e) =>
          conn.send({ _tag: "Error", code: "RATE_LIMITED", message: e.message })
        ),
        Effect.flatMap(() => {
          const message: Message = {
            id: msg.msgId,
            roomId,
            userId: conn.userId,
            text: msg.text,
            ts: Date.now(),
            synced: false
          }
          return Effect.all([
            storage.insertMessage(message),
            hub.broadcast(
              {
                _tag: "Message",
                msgId: message.id,
                userId: message.userId,
                text: message.text,
                ts: message.ts
              },
              conn.userId
            ),
            conn.send({ _tag: "Ack", msgId: msg.msgId, ok: true }),
            storage.setAlarm(5000)
          ])
        }),
        Effect.asVoid
      )

    const handleTyping = (conn: WSConnection, msg: TypingRequest) =>
      hub.broadcast(
        { _tag: "UserTyping", userId: conn.userId, isTyping: msg.isTyping },
        conn.userId
      )

    const handleJoinRoom = (conn: WSConnection) =>
      hub.broadcast({ _tag: "UserJoined", userId: conn.userId, ts: Date.now() })

    const handleMessage = (roomId: RoomId, conn: WSConnection, raw: string | ArrayBuffer) =>
      parseClientMessage(raw).pipe(
        Effect.tapError((e) =>
          conn.send({ _tag: "Error", code: "PARSE_ERROR", message: e.message })
        ),
        Effect.tap((message) =>
          Effect.log("Received message", { type: message._tag, userId: conn.userId })
        ),
        Effect.flatMap((message) =>
          Match.value(message).pipe(
            Match.tag("SendMessage", (m) => handleSendMessage(roomId, conn, m)),
            Match.tag("Typing", (m) => handleTyping(conn, m)),
            Match.tag("JoinRoom", () => handleJoinRoom(conn)),
            Match.exhaustive
          )
        )
      )

    const handleConnect = (conn: WSConnection) =>
      Effect.all([
        hub.register(conn),
        storage.getRecentMessages(50).pipe(
          Effect.flatMap((messages) =>
            Effect.forEach(
              messages,
              (msg) =>
                conn.send({
                  _tag: "Message",
                  msgId: msg.id,
                  userId: msg.userId,
                  text: msg.text,
                  ts: msg.ts
                }),
              { discard: true }
            )
          )
        ),
        hub.broadcast({ _tag: "UserJoined", userId: conn.userId, ts: Date.now() }, conn.userId)
      ]).pipe(Effect.asVoid)

    const handleDisconnect = (conn: WSConnection) =>
      Effect.all([
        hub.unregister(conn.userId),
        hub.broadcast({ _tag: "UserLeft", userId: conn.userId, ts: Date.now() })
      ]).pipe(Effect.asVoid)

    return { handleMessage, handleConnect, handleDisconnect }
  })
}) {}
