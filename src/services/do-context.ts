import { Context } from "effect"

export interface Env {
  CHAT_ROOM: DurableObjectNamespace
  PRESENCE: DurableObjectNamespace
  HYPERDRIVE?: {
    exec: (query: string) => Promise<unknown>
    batch: (queries: Array<{ query: string; params: unknown[] }>) => Promise<unknown>
  }
  DB?: D1Database
}

export class DOState extends Context.Tag("DOState")<DOState, DurableObjectState>() {}

export class DOEnv extends Context.Tag("DOEnv")<DOEnv, Env>() {}
