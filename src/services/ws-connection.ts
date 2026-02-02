import { Effect, Schema } from "effect"
import { ClientMessage, ServerMessage } from "../domain/ws-messages"
import { UserId } from "../domain/ids"
import { ParseError } from "../domain/errors"

export interface WSConnection {
  readonly id: string
  readonly userId: UserId
  readonly socket: WebSocket
  readonly send: (msg: ServerMessage) => Effect.Effect<void>
  readonly close: (code?: number, reason?: string) => Effect.Effect<void>
}

const encodeServerMessage = Schema.encode(ServerMessage)

export const makeWSConnection = (
  socket: WebSocket,
  userId: UserId,
  id: string
): WSConnection => ({
  id,
  userId,
  socket,
  send: (msg) =>
    Effect.gen(function*() {
      if (socket.readyState !== WebSocket.OPEN) return
      const encoded = yield* encodeServerMessage(msg)
      yield* Effect.sync(() => socket.send(JSON.stringify(encoded)))
    }).pipe(Effect.ignoreLogged),
  close: (code = 1000, reason = "Normal closure") =>
    Effect.sync(() => socket.close(code, reason))
})

const decodeClientMessage = Schema.decodeUnknown(ClientMessage)

export const parseClientMessage = (raw: string | ArrayBuffer) =>
  Effect.gen(function*() {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw)

    const json = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () =>
        new ParseError({
          raw: text.substring(0, 100),
          message: "Invalid JSON"
        })
    })

    return yield* decodeClientMessage(json).pipe(
      Effect.mapError(
        (e) =>
          new ParseError({
            raw: text.substring(0, 100),
            message: `Invalid message format: ${e.message}`
          })
      )
    )
  })
