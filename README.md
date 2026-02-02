# Durable Effect Chat

Real-time chat application built with Cloudflare Workers, Durable Objects, and Effect-TS.

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **State**: Durable Objects + WebSocket Hibernation API
- **Framework**: Effect-TS (services, schemas, error handling)
- **Validation**: @effect/schema

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4
- **State**: TanStack Query v5
- **Fonts**: Space Grotesk, JetBrains Mono

> **Note:** This sample intentionally does not integrate `@effect/platform` HTTP layer to keep complexity minimal. HTTP routing uses simple pattern matching (e.g., `if (url.pathname === "/room" && request.method === "GET")`) instead of Effect's typed router. In production, HTTP would typically be handled via `@effect/platform` HttpRouter or a dedicated API gateway, with Durable Objects focused purely on stateful WebSocket/storage logic.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────────┤
│  Worker (index.ts)                                              │
│  └── Routes requests to Durable Objects + CORS                  │
├─────────────────────────────────────────────────────────────────┤
│  ChatRoom DO                            │  PresenceDO           │
│  ├── WebSocket hibernation              │  ├── 4 shards/room    │
│  ├── Message broadcast                  │  ├── User TTL (60s)   │
│  ├── History (last 100)                 │  ├── Heartbeat        │
│  └── Rate limiting                      │  └── Cleanup alarm    │
└─────────────────────────────────────────────────────────────────┘
```

### Durable Objects

**ChatRoom DO** - One per room
- WebSocket connections with hibernation API
- Message history in DO storage
- Broadcasts to all connected clients
- Per-user rate limiting

**Presence DO** - Sharded (4 per room)
- Tracks online users with 60s TTL
- Shard key: `${roomId}:presence:${hash(userId) % 4}`
- HTTP: `/join`, `/leave`, `/heartbeat`, `/online`, `/count`
- Background alarm cleans expired users every 30s

### Effect-TS Services

| Service | Purpose |
|---------|---------|
| `DOContext` | DO state, env, storage access |
| `Storage` | Type-safe DO storage |
| `WSHub` | WebSocket management |
| `RateLimiter` | Per-user rate limiting |
| `MessageHandler` | WS message processing |
| `Sync` | Broadcast to connections |
| `PresenceClient` | HTTP client for presence |

## Project Structure

```
src/
├── index.ts              # Worker entry
├── chat-room.do.ts       # Chat Durable Object
├── presence.do.ts        # Presence Durable Object
├── domain/
│   ├── ids.ts            # Branded IDs
│   ├── schemas.ts        # Domain schemas
│   ├── errors.ts         # Tagged errors
│   └── ws-messages.ts    # WS message schemas
├── services/
│   ├── do-context.ts     # DO context tags
│   ├── storage.ts        # Storage service
│   ├── ws-hub.ts         # Connection hub
│   ├── rate-limiter.ts   # Rate limiting
│   ├── sync.ts           # Message sync
│   ├── presence-client.ts# Presence HTTP client
│   └── message-handler.ts# Message handling
└── shared/
    └── types.ts          # Shared FE/BE types

frontend/src/
├── App.tsx
├── index.css             # Tailwind v4 theme
├── components/
│   ├── ui/               # Design primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── ...
│   └── chat/             # Chat components
│       ├── message.tsx
│       ├── room-list.tsx
│       └── online-users.tsx
├── hooks/
│   └── use-chat.ts       # WebSocket + Query hook
└── lib/
    └── utils.ts          # cn() utility
```

## Development

```bash
pnpm install
cd frontend && pnpm install

# Backend
pnpm dev

# Frontend
cd frontend && pnpm dev
```

## Deployment

```bash
# Backend
pnpm run deploy

# Frontend
cd frontend && pnpm build
CLOUDFLARE_ACCOUNT_ID=<id> npx wrangler pages deploy dist --project-name=durable-effect-chat-ui
```

## API

### WebSocket Messages

**Client → Server**
```typescript
{ "_tag": "SendMessage", "msgId": "uuid", "text": "Hello!" }
{ "_tag": "Typing", "isTyping": true }
```

**Server → Client**
```typescript
{ "_tag": "Message", "msgId": "uuid", "userId": "alice", "text": "Hello!", "ts": 1234567890 }
{ "_tag": "UserTyping", "userId": "alice", "isTyping": true }
{ "_tag": "UserJoined", "userId": "alice", "ts": 1234567890 }
{ "_tag": "Error", "code": "RATE_LIMITED", "message": "Rate limited" }
```

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/room/:id` | WebSocket upgrade |
| GET | `/room/:id/online` | Online users |
| GET | `/room/:id/messages` | Message history |

## Design System

| Token | Value |
|-------|-------|
| Paper | `#F7F7F5` |
| Forest | `#1A3C2B` |
| Grid | `#3A3A38` |
| Radius | 0-2px |
| Shadows | None |
| Lines | 1px hairlines |

## License

MIT
