import { Effect, HashMap, Option, Ref } from "effect"
import { WSConnection } from "./ws-connection"
import { ServerMessage } from "../domain/ws-messages"
import { UserId } from "../domain/ids"

export class WSHub extends Effect.Service<WSHub>()("WSHub", {
  accessors: true,
  effect: Effect.gen(function*() {
    const connectionsRef = yield* Ref.make(HashMap.empty<UserId, WSConnection>())

    const register = (conn: WSConnection) =>
      Ref.update(connectionsRef, HashMap.set(conn.userId, conn)).pipe(
        Effect.tap(() => Effect.log("Connection registered", { userId: conn.userId }))
      )

    const unregister = (userId: UserId) =>
      Ref.update(connectionsRef, HashMap.remove(userId)).pipe(
        Effect.tap(() => Effect.log("Connection unregistered", { userId }))
      )

    const getConnection = (userId: UserId) =>
      Ref.get(connectionsRef).pipe(Effect.map(HashMap.get(userId)))

    const getAllConnections = Ref.get(connectionsRef).pipe(
      Effect.map((conns) => Array.from(HashMap.values(conns)))
    )

    const getConnectionCount = Ref.get(connectionsRef).pipe(Effect.map(HashMap.size))

    const broadcast = (msg: ServerMessage, exclude?: UserId) =>
      Ref.get(connectionsRef).pipe(
        Effect.flatMap((conns) =>
          Effect.forEach(
            Array.from(HashMap.values(conns)).filter((c) => c.userId !== exclude),
            (conn) => conn.send(msg),
            { discard: true }
          )
        ),
        Effect.tap(() => Effect.log("Broadcast sent", { type: msg._tag }))
      )

    const sendTo = (userId: UserId, msg: ServerMessage) =>
      getConnection(userId).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.log("User not connected", { userId }),
            onSome: (conn) => conn.send(msg)
          })
        )
      )

    const sendToMany = (userIds: readonly UserId[], msg: ServerMessage) =>
      Effect.forEach(userIds, (userId) => sendTo(userId, msg), { discard: true })

    const getOnlineUsers = Ref.get(connectionsRef).pipe(
      Effect.map((conns) => Array.from(HashMap.keys(conns)))
    )

    const isOnline = (userId: UserId) =>
      Ref.get(connectionsRef).pipe(Effect.map(HashMap.has(userId)))

    const closeAll = (code = 1000, reason = "Server shutdown") =>
      Ref.get(connectionsRef).pipe(
        Effect.tap((conns) =>
          Effect.forEach(HashMap.values(conns), (conn) => conn.close(code, reason), {
            discard: true
          })
        ),
        Effect.tap((conns) =>
          Effect.log("All connections closed", { count: HashMap.size(conns) })
        ),
        Effect.tap(() => Ref.set(connectionsRef, HashMap.empty()))
      )

    return {
      register,
      unregister,
      getConnection,
      getAllConnections,
      getConnectionCount,
      broadcast,
      sendTo,
      sendToMany,
      getOnlineUsers,
      isOnline,
      closeAll
    }
  })
}) {}
