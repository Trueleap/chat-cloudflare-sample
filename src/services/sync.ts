import { Duration, Effect, Schedule } from "effect"
import { DOEnv } from "./do-context"
import { StorageService } from "./storage"
import { SyncError } from "../domain/errors"
import { Message } from "../domain/schemas"
import { RoomId } from "../domain/ids"

export class SyncService extends Effect.Service<SyncService>()("SyncService", {
  accessors: true,
  dependencies: [StorageService.Default],
  effect: Effect.gen(function*() {
    const storage = yield* StorageService
    const env = yield* DOEnv

    const syncToPostgres = (roomId: RoomId) =>
      storage.getUnsyncedMessages(roomId, 100).pipe(
        Effect.tap((msgs) => Effect.log("Sync check", { count: msgs.length })),
        Effect.flatMap((unsynced) =>
          unsynced.length === 0
            ? Effect.succeed(0)
            : syncBatch(unsynced).pipe(Effect.map(() => unsynced.length))
        )
      )

    const syncBatch = (messages: readonly Message[]) => {
      if (!env.HYPERDRIVE) {
        return storage.markSynced(messages.map((m) => m.id)).pipe(
          Effect.tap(() => Effect.log("Hyperdrive not configured, marked as synced"))
        )
      }

      const hyperdrive = env.HYPERDRIVE
      return Effect.retry(
        Effect.tryPromise({
          try: async () => {
            for (const m of messages) {
              await hyperdrive.batch([
                {
                  query: `INSERT INTO messages (id, room_id, user_id, text, ts) 
                          VALUES ($1, $2, $3, $4, $5) 
                          ON CONFLICT (id) DO NOTHING`,
                  params: [m.id, m.roomId, m.userId, m.text, m.ts]
                }
              ])
            }
          },
          catch: (e) => new SyncError({ failedCount: messages.length, message: `Postgres sync failed: ${e}` })
        }),
        Schedule.exponential(Duration.millis(100)).pipe(Schedule.compose(Schedule.recurs(3)))
      ).pipe(
        Effect.flatMap(() => storage.markSynced(messages.map((m) => m.id))),
        Effect.tap(() => Effect.log("Sync complete", { synced: messages.length }))
      )
    }

    const syncAndReschedule = (roomId: RoomId, intervalMs = 5000) =>
      syncToPostgres(roomId).pipe(
        Effect.flatMap(() => storage.getUnsyncedMessages(roomId, 1)),
        Effect.flatMap((remaining) => (remaining.length > 0 ? storage.setAlarm(intervalMs) : Effect.void))
      )

    return { syncToPostgres, syncAndReschedule }
  })
}) {}
