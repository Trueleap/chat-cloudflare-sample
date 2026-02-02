import { Schema } from "effect"

export const RoomId = Schema.String.pipe(Schema.brand("@Chat/RoomId"))
export type RoomId = Schema.Schema.Type<typeof RoomId>
export const makeRoomId = Schema.decodeSync(RoomId)

export const UserId = Schema.String.pipe(Schema.brand("@Chat/UserId"))
export type UserId = Schema.Schema.Type<typeof UserId>
export const makeUserId = Schema.decodeSync(UserId)

export const MessageId = Schema.UUID.pipe(Schema.brand("@Chat/MessageId"))
export type MessageId = Schema.Schema.Type<typeof MessageId>
export const makeMessageId = Schema.decodeSync(MessageId)
