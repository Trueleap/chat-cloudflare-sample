import { Effect, Option, Schema } from "effect"
import { DOState } from "./do-context"
import { StorageError } from "../domain/errors"
import { Message, RoomSettings } from "../domain/schemas"
import { makeMessageId, makeUserId, MessageId, RoomId, UserId } from "../domain/ids"

const MessageRow = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  text: Schema.String,
  ts: Schema.Number,
  synced: Schema.transform(Schema.Number, Schema.Boolean, {
    decode: (n) => n === 1,
    encode: (b) => (b ? 1 : 0)
  })
})

const decodeMessageRows = Schema.decodeUnknown(Schema.Array(MessageRow))

export interface StoredMessage {
  readonly id: MessageId
  readonly userId: UserId
  readonly text: string
  readonly ts: number
}

const toMessage = (row: Schema.Schema.Type<typeof MessageRow>, roomId: RoomId): Message => ({
  id: makeMessageId(row.id),
  roomId,
  userId: makeUserId(row.userId),
  text: row.text,
  ts: row.ts,
  synced: row.synced
})

const toStoredMessage = (row: Schema.Schema.Type<typeof MessageRow>): StoredMessage => ({
  id: makeMessageId(row.id),
  userId: makeUserId(row.userId),
  text: row.text,
  ts: row.ts
})

export class StorageService extends Effect.Service<StorageService>()("StorageService", {
  accessors: true,
  effect: Effect.gen(function*() {
    const state = yield* DOState

    const initialize = Effect.try({
      try: () => {
        state.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            text TEXT NOT NULL,
            ts INTEGER NOT NULL,
            synced INTEGER DEFAULT 0
          )
        `)
        state.storage.sql.exec(
          `CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts)`
        )
        state.storage.sql.exec(
          `CREATE INDEX IF NOT EXISTS idx_messages_unsynced ON messages(synced) WHERE synced = 0`
        )
      },
      catch: (e) =>
        new StorageError({ operation: "initialize", cause: String(e), message: "Failed to initialize" })
    }).pipe(Effect.tap(() => Effect.log("Storage initialized")))

    const insertMessage = (msg: Message) =>
      Effect.try({
        try: () =>
          state.storage.sql.exec(
            `INSERT OR IGNORE INTO messages (id, user_id, text, ts, synced) VALUES (?, ?, ?, ?, ?)`,
            msg.id,
            msg.userId,
            msg.text,
            msg.ts,
            msg.synced ? 1 : 0
          ),
        catch: (e) =>
          new StorageError({ operation: "insertMessage", cause: String(e), message: `Failed to insert ${msg.id}` })
      }).pipe(Effect.tap(() => Effect.log("Message inserted", { messageId: msg.id })))

    const getUnsyncedMessages = (roomId: RoomId, limit = 100) =>
      Effect.try({
        try: () =>
          state.storage.sql
            .exec(
              `SELECT id, user_id as userId, text, ts, synced FROM messages WHERE synced = 0 ORDER BY ts LIMIT ?`,
              limit
            )
            .toArray(),
        catch: (e) =>
          new StorageError({ operation: "getUnsyncedMessages", cause: String(e), message: "Failed to fetch" })
      }).pipe(
        Effect.flatMap(decodeMessageRows),
        Effect.map((rows) => rows.map((r) => toMessage(r, roomId))),
        Effect.catchTag("ParseError", () => Effect.succeed([]))
      )

    const markSynced = (ids: readonly string[]) =>
      ids.length === 0
        ? Effect.void
        : Effect.try({
            try: () => {
              const placeholders = ids.map(() => "?").join(",")
              state.storage.sql.exec(`UPDATE messages SET synced = 1 WHERE id IN (${placeholders})`, ...ids)
            },
            catch: (e) =>
              new StorageError({ operation: "markSynced", cause: String(e), message: "Failed to mark synced" })
          }).pipe(Effect.tap(() => Effect.log("Messages marked synced", { count: ids.length })))

    const getRecentMessages = (limit = 50): Effect.Effect<readonly StoredMessage[], StorageError> =>
      Effect.try({
        try: () =>
          state.storage.sql
            .exec(`SELECT id, user_id as userId, text, ts, 1 as synced FROM messages ORDER BY ts DESC LIMIT ?`, limit)
            .toArray()
            .reverse(),
        catch: (e) =>
          new StorageError({ operation: "getRecentMessages", cause: String(e), message: "Failed to fetch" })
      }).pipe(
        Effect.flatMap(decodeMessageRows),
        Effect.map((rows) => rows.map(toStoredMessage)),
        Effect.catchTag("ParseError", () => Effect.succeed([]))
      )

    const getSettings = Effect.promise(() => state.storage.get<RoomSettings>("settings")).pipe(
      Effect.map(Option.fromNullable)
    )

    const setSettings = (settings: RoomSettings) =>
      Effect.promise(() => state.storage.put("settings", settings)).pipe(
        Effect.tap(() => Effect.log("Settings updated"))
      )

    const setAlarm = (delayMs: number) =>
      Effect.promise(() => state.storage.getAlarm()).pipe(
        Effect.flatMap((existing) =>
          existing
            ? Effect.void
            : Effect.promise(() => state.storage.setAlarm(Date.now() + delayMs)).pipe(
                Effect.tap(() => Effect.log("Alarm scheduled", { delayMs }))
              )
        )
      )

    const deleteAll = Effect.promise(() => state.storage.deleteAll()).pipe(
      Effect.tap(() => Effect.log("All storage deleted"))
    )

    return {
      initialize,
      insertMessage,
      getUnsyncedMessages,
      markSynced,
      getRecentMessages,
      getSettings,
      setSettings,
      setAlarm,
      deleteAll
    }
  })
}) {}
