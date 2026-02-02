import { Schema } from "effect"
import { MessageId, RoomId, UserId } from "./ids"

export const Message = Schema.Struct({
  id: MessageId,
  roomId: RoomId,
  userId: UserId,
  text: Schema.String,
  ts: Schema.Number,
  synced: Schema.Boolean
})
export type Message = Schema.Schema.Type<typeof Message>

export const CreateMessageInput = Schema.Struct({
  msgId: MessageId,
  userId: UserId,
  text: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(4000))
})
export type CreateMessageInput = Schema.Schema.Type<typeof CreateMessageInput>

export const RoomSettings = Schema.Struct({
  name: Schema.String,
  isPrivate: Schema.Boolean,
  maxMembers: Schema.Number.pipe(Schema.positive())
})
export type RoomSettings = Schema.Schema.Type<typeof RoomSettings>
