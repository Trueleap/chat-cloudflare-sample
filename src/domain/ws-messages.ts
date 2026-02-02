import { Schema } from "effect"
import { MessageId, RoomId, UserId } from "./ids"

export const SendMessageRequest = Schema.TaggedStruct("SendMessage", {
  msgId: MessageId,
  text: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(4000))
})
export type SendMessageRequest = Schema.Schema.Type<typeof SendMessageRequest>

export const TypingRequest = Schema.TaggedStruct("Typing", {
  isTyping: Schema.Boolean
})
export type TypingRequest = Schema.Schema.Type<typeof TypingRequest>

export const JoinRoomRequest = Schema.TaggedStruct("JoinRoom", {
  roomId: RoomId
})
export type JoinRoomRequest = Schema.Schema.Type<typeof JoinRoomRequest>

export const ClientMessage = Schema.Union(
  SendMessageRequest,
  TypingRequest,
  JoinRoomRequest
)
export type ClientMessage = Schema.Schema.Type<typeof ClientMessage>

export const MessageEvent = Schema.TaggedStruct("Message", {
  msgId: MessageId,
  userId: UserId,
  text: Schema.String,
  ts: Schema.Number
})
export type MessageEvent = Schema.Schema.Type<typeof MessageEvent>

export const TypingEvent = Schema.TaggedStruct("UserTyping", {
  userId: UserId,
  isTyping: Schema.Boolean
})
export type TypingEvent = Schema.Schema.Type<typeof TypingEvent>

export const UserJoinedEvent = Schema.TaggedStruct("UserJoined", {
  userId: UserId,
  ts: Schema.Number
})
export type UserJoinedEvent = Schema.Schema.Type<typeof UserJoinedEvent>

export const UserLeftEvent = Schema.TaggedStruct("UserLeft", {
  userId: UserId,
  ts: Schema.Number
})
export type UserLeftEvent = Schema.Schema.Type<typeof UserLeftEvent>

export const ErrorEvent = Schema.TaggedStruct("Error", {
  code: Schema.String,
  message: Schema.String
})
export type ErrorEvent = Schema.Schema.Type<typeof ErrorEvent>

export const AckEvent = Schema.TaggedStruct("Ack", {
  msgId: MessageId,
  ok: Schema.Boolean
})
export type AckEvent = Schema.Schema.Type<typeof AckEvent>

export const ServerMessage = Schema.Union(
  MessageEvent,
  TypingEvent,
  UserJoinedEvent,
  UserLeftEvent,
  ErrorEvent,
  AckEvent
)
export type ServerMessage = Schema.Schema.Type<typeof ServerMessage>
