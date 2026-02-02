import { Effect } from "effect"
import { DOEnv } from "./do-context"
import { RoomId, UserId } from "../domain/ids"
import { getShardId, getAllShardIds } from "../presence.do"

interface OnlineResponse {
  users: string[]
  count: number
}

export class PresenceClient extends Effect.Service<PresenceClient>()("PresenceClient", {
  accessors: true,
  effect: Effect.gen(function*() {
    const env = yield* DOEnv

    const getStub = (shardId: string) =>
      env.PRESENCE.get(env.PRESENCE.idFromName(shardId))

    const join = (roomId: RoomId, userId: UserId) =>
      Effect.tryPromise({
        try: async () => {
          const shardId = getShardId(roomId, userId)
          const stub = getStub(shardId)
          await stub.fetch(new Request("http://presence/join", {
            method: "POST",
            body: JSON.stringify({ userId })
          }))
        },
        catch: (e) => new Error(`Presence join failed: ${e}`)
      }).pipe(Effect.ignoreLogged)

    const leave = (roomId: RoomId, userId: UserId) =>
      Effect.tryPromise({
        try: async () => {
          const shardId = getShardId(roomId, userId)
          const stub = getStub(shardId)
          await stub.fetch(new Request("http://presence/leave", {
            method: "POST",
            body: JSON.stringify({ userId })
          }))
        },
        catch: (e) => new Error(`Presence leave failed: ${e}`)
      }).pipe(Effect.ignoreLogged)

    const getOnlineUsers = (roomId: RoomId) =>
      Effect.tryPromise({
        try: async () => {
          const shardIds = getAllShardIds(roomId)
          const results = await Promise.all(
            shardIds.map(async (shardId) => {
              const stub = getStub(shardId)
              const res = await stub.fetch(new Request("http://presence/online"))
              return res.json() as Promise<OnlineResponse>
            })
          )
          const allUsers = results.flatMap((r) => r.users)
          return { users: allUsers, count: allUsers.length }
        },
        catch: (e) => new Error(`Presence fetch failed: ${e}`)
      }).pipe(Effect.orElseSucceed(() => ({ users: [] as string[], count: 0 })))

    const getOnlineCount = (roomId: RoomId) =>
      Effect.tryPromise({
        try: async () => {
          const shardIds = getAllShardIds(roomId)
          const results = await Promise.all(
            shardIds.map(async (shardId) => {
              const stub = getStub(shardId)
              const res = await stub.fetch(new Request("http://presence/count"))
              const data = await res.json() as { count: number }
              return data.count
            })
          )
          return results.reduce((a, b) => a + b, 0)
        },
        catch: () => 0
      }).pipe(Effect.orElseSucceed(() => 0))

    return { join, leave, getOnlineUsers, getOnlineCount }
  })
}) {}
