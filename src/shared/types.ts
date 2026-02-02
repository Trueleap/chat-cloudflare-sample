import { Schema } from "effect"

import type * as Ids from "../domain/ids"
import type * as Schemas from "../domain/schemas"
import type * as Errors from "../domain/errors"
import type * as WsMessages from "../domain/ws-messages"

export type RoomId = Schema.Schema.Type<typeof Ids.RoomId>
export type UserId = Schema.Schema.Type<typeof Ids.UserId>
export type MessageId = Schema.Schema.Type<typeof Ids.MessageId>

export type Message = Schema.Schema.Type<typeof Schemas.Message>
export type CreateMessageInput = Schema.Schema.Type<typeof Schemas.CreateMessageInput>
export type RoomSettings = Schema.Schema.Type<typeof Schemas.RoomSettings>

export type RoomNotFoundError = Errors.RoomNotFoundError
export type MessageNotFoundError = Errors.MessageNotFoundError
export type RateLimitedError = Errors.RateLimitedError
export type StorageError = Errors.StorageError
export type SyncError = Errors.SyncError
export type ParseError = Errors.ParseError

export type SendMessageRequest = Schema.Schema.Type<typeof WsMessages.SendMessageRequest>
export type TypingRequest = Schema.Schema.Type<typeof WsMessages.TypingRequest>
export type JoinRoomRequest = Schema.Schema.Type<typeof WsMessages.JoinRoomRequest>
export type ClientMessage = Schema.Schema.Type<typeof WsMessages.ClientMessage>

export type MessageEvent = Schema.Schema.Type<typeof WsMessages.MessageEvent>
export type TypingEvent = Schema.Schema.Type<typeof WsMessages.TypingEvent>
export type UserJoinedEvent = Schema.Schema.Type<typeof WsMessages.UserJoinedEvent>
export type UserLeftEvent = Schema.Schema.Type<typeof WsMessages.UserLeftEvent>
export type ErrorEvent = Schema.Schema.Type<typeof WsMessages.ErrorEvent>
export type AckEvent = Schema.Schema.Type<typeof WsMessages.AckEvent>
export type ServerMessage = Schema.Schema.Type<typeof WsMessages.ServerMessage>

export interface OnlineUsersResponse {
  users: UserId[]
  count: number
}

export interface MessagesResponse {
  messages: Array<{
    id: string
    userId: string
    text: string
    ts: number
  }>
}

export interface HealthResponse {
  status: string
  ts: number
}

export const isMessageEvent = (msg: ServerMessage): msg is MessageEvent =>
  msg._tag === "Message"

export const isTypingEvent = (msg: ServerMessage): msg is TypingEvent =>
  msg._tag === "UserTyping"

export const isUserJoinedEvent = (msg: ServerMessage): msg is UserJoinedEvent =>
  msg._tag === "UserJoined"

export const isUserLeftEvent = (msg: ServerMessage): msg is UserLeftEvent =>
  msg._tag === "UserLeft"

export const isErrorEvent = (msg: ServerMessage): msg is ErrorEvent =>
  msg._tag === "Error"

export const isAckEvent = (msg: ServerMessage): msg is AckEvent =>
  msg._tag === "Ack"

const RoomIdSchema = Schema.String.pipe(Schema.brand("@Chat/RoomId"))
const UserIdSchema = Schema.String.pipe(Schema.brand("@Chat/UserId"))
const MessageIdSchema = Schema.UUID.pipe(Schema.brand("@Chat/MessageId"))

export const RoomId = Schema.decodeSync(RoomIdSchema)
export const UserId = Schema.decodeSync(UserIdSchema)
export const MessageId = Schema.decodeSync(MessageIdSchema)
