import { Schema } from "effect"
import { MessageId, RoomId, UserId } from "./ids"

export class RoomNotFoundError extends Schema.TaggedError<RoomNotFoundError>()(
  "RoomNotFoundError",
  { roomId: RoomId, message: Schema.String }
) {}

export class MessageNotFoundError extends Schema.TaggedError<MessageNotFoundError>()(
  "MessageNotFoundError",
  { messageId: MessageId, message: Schema.String }
) {}

export class RateLimitedError extends Schema.TaggedError<RateLimitedError>()(
  "RateLimitedError",
  { userId: UserId, retryAfterMs: Schema.Number, message: Schema.String }
) {}

export class StorageError extends Schema.TaggedError<StorageError>()(
  "StorageError",
  { operation: Schema.String, cause: Schema.optional(Schema.String), message: Schema.String }
) {}

export class SyncError extends Schema.TaggedError<SyncError>()(
  "SyncError",
  { failedCount: Schema.Number, message: Schema.String }
) {}

export class ParseError extends Schema.TaggedError<ParseError>()(
  "ParseError",
  { raw: Schema.String, message: Schema.String }
) {}
