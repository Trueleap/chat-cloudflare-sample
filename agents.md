# Agent Rules

Coding standards enforced in this project.

## Code Quality

### No Comments
- Code should be self-documenting
- Use descriptive names instead of comments
- Extract complex logic into well-named functions

### No Type Assertions
- Never use `as` type assertions
- Use `Schema.decodeSync` for runtime validation
- Use type guards when narrowing is needed

### Strict Types
- No `any` types
- No non-null assertions (`!`)
- Enable strict mode in tsconfig
- Use branded types for domain IDs

### Reusable Types
- Define types in `shared/types.ts` for FE/BE sharing
- Use Effect Schema for validation + type derivation
- Prefer type composition over duplication

## Effect-TS Patterns

### You Don't Need Effect
Don't wrap everything in Effect. Use plain functions when:
- Synchronous with no errors to track
- Simple transformations
- No dependency injection needed

Use Effect when you need:
- Typed error channel (recoverable vs defects)
- Dependency injection via services
- Resource management (acquire/release)
- Retries, timeouts, concurrency control
- Composition of async operations

```typescript
// BAD: unnecessary Effect
const add = (a: number, b: number) => Effect.succeed(a + b)

// GOOD: plain function
const add = (a: number, b: number) => a + b

// GOOD: Effect for actual needs (errors, DI, async)
const fetchUser = (id: string) => Effect.gen(function* () {
  const http = yield* HttpClient
  const response = yield* http.get(`/users/${id}`)
  return yield* response.json
})
```

### Services
```typescript
export class MyService extends Effect.Service<MyService>()("MyService", {
  accessors: true,
  effect: Effect.gen(function* () {
    // implementation
  }),
}) {}
```

### Tagged Errors
```typescript
export class MyError extends Schema.TaggedError<MyError>()("MyError", {
  field: Schema.String,
}) {}
```

### Branded IDs
```typescript
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = Schema.Schema.Type<typeof UserId>
```

## Frontend Patterns

### Component Structure
- UI primitives in `components/ui/`
- Feature components in `components/{feature}/`
- Hooks in `hooks/`
- Utils in `lib/`

### Styling
- Tailwind CSS v4 with CSS variables
- CVA for variant management
- No inline styles
- Design tokens in `index.css`

### State Management
- TanStack Query for server state
- Local state with useState
- No global state libraries needed

### You Might Not Need useState/useEffect
Derive state during render, don't sync with useEffect:

```typescript
// BAD: syncing state with useEffect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// GOOD: derive during render
const fullName = `${firstName} ${lastName}`

// BAD: resetting state on prop change
useEffect(() => {
  setSelection(null)
}, [items])

// GOOD: use key to reset component
<List items={items} key={listId} />

// BAD: fetching in useEffect
useEffect(() => {
  fetch('/api/data').then(setData)
}, [])

// GOOD: use TanStack Query
const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData })
```

When to use useEffect:
- Syncing with external systems (DOM, subscriptions, WebSocket)
- NOT for: derived state, data fetching, event handling

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| Paper | `#F7F7F5` | Backgrounds |
| Forest | `#1A3C2B` | Primary actions |
| Grid | `#3A3A38` | Text, borders |

### Typography
- Headers: Space Grotesk
- Labels/Code: JetBrains Mono
- Body: System sans-serif

### Spacing
- 1px hairline borders
- 0-2px border radius
- No shadows
- Consistent padding scale

## File Naming
- Lowercase with hyphens: `my-component.tsx`
- Index files for barrel exports
- `.do.ts` suffix for Durable Objects

## Git
- Conventional commits
- No commented code in commits
- Squash related changes
