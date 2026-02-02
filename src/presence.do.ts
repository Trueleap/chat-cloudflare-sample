const NUM_SHARDS = 4
const PRESENCE_TTL_MS = 60000
const CLEANUP_INTERVAL_MS = 30000

export const getShardId = (roomId: string, userId: string): string => {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  const shardIndex = Math.abs(hash) % NUM_SHARDS
  return `${roomId}:presence:${shardIndex}`
}

export const getAllShardIds = (roomId: string): string[] =>
  Array.from({ length: NUM_SHARDS }, (_, i) => `${roomId}:presence:${i}`)

interface PresenceEntry {
  odJoinedAt: number
  lastSeen: number
}

export class PresenceDO implements DurableObject {
  private presence: Map<string, PresenceEntry> = new Map()

  constructor(private readonly ctx: DurableObjectState) {
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Record<string, PresenceEntry>>("presence")
      if (stored) {
        this.presence = new Map(Object.entries(stored))
        this.cleanupStale()
      }
    })
  }

  private async persist() {
    await this.ctx.storage.put("presence", Object.fromEntries(this.presence))
  }

  private cleanupStale() {
    const now = Date.now()
    let changed = false
    for (const [userId, entry] of this.presence) {
      if (now - entry.lastSeen > PRESENCE_TTL_MS) {
        this.presence.delete(userId)
        changed = true
      }
    }
    if (changed) {
      this.persist()
    }
  }

  private scheduleCleanup() {
    this.ctx.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS)
  }

  async alarm(): Promise<void> {
    this.cleanupStale()
    if (this.presence.size > 0) {
      this.scheduleCleanup()
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/join") {
      const { userId } = await request.json<{ userId: string }>()
      const now = Date.now()

      const existing = this.presence.get(userId)
      this.presence.set(userId, {
        odJoinedAt: existing?.odJoinedAt ?? now,
        lastSeen: now
      })

      await this.persist()
      this.scheduleCleanup()

      return Response.json({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/heartbeat") {
      const { userId } = await request.json<{ userId: string }>()
      const now = Date.now()

      const existing = this.presence.get(userId)
      if (existing) {
        existing.lastSeen = now
        await this.persist()
      }

      return Response.json({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/leave") {
      const { userId } = await request.json<{ userId: string }>()

      this.presence.delete(userId)
      await this.persist()

      return Response.json({ ok: true })
    }

    if (request.method === "GET" && url.pathname === "/online") {
      this.cleanupStale()
      const users = Array.from(this.presence.keys())
      return Response.json({ users, count: users.length })
    }

    if (request.method === "GET" && url.pathname === "/count") {
      this.cleanupStale()
      return Response.json({ count: this.presence.size })
    }

    return Response.json({ error: "Not found" }, { status: 404 })
  }
}
