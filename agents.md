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

### Don't Over useState (TkDodo)
If it can be computed from state/props, it's NOT state:

```typescript
// BAD: derived state in useState + useEffect
const [data, setData] = useState(null)
const [categories, setCategories] = useState([])

useEffect(() => {
  if (data) setCategories(computeCategories(data))
}, [data])

// GOOD: derive during render
const [data, setData] = useState(null)
const categories = data ? computeCategories(data) : []
```

**Rule**: If a setter is only used in an effect, eliminate that state.

### You Might Not Need an Effect (React Docs)

**Two cases where you don't need Effects:**
1. Transforming data for rendering → calculate during render
2. Handling user events → use event handlers

```typescript
// BAD: redundant state + effect
const [visibleTodos, setVisibleTodos] = useState([])
useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter))
}, [todos, filter])

// GOOD: derive during render
const visibleTodos = getFilteredTodos(todos, filter)

// GOOD: expensive? use useMemo (measure first!)
const visibleTodos = useMemo(
  () => getFilteredTodos(todos, filter),
  [todos, filter]
)
```

**Reset state with key, not useEffect:**
```typescript
// BAD
useEffect(() => { setComment('') }, [userId])

// GOOD
<Profile userId={userId} key={userId} />
```

**Store IDs, derive objects:**
```typescript
// BAD: reset selection when items change
const [selection, setSelection] = useState(null)
useEffect(() => { setSelection(null) }, [items])

// GOOD: store ID, derive selection
const [selectedId, setSelectedId] = useState(null)
const selection = items.find(item => item.id === selectedId) ?? null
```

**Event logic in handlers, not Effects:**
```typescript
// BAD: event-specific logic in effect
useEffect(() => {
  if (product.isInCart) showNotification('Added!')
}, [product])

// GOOD: in event handler
function handleBuyClick() {
  addToCart(product)
  showNotification('Added!')
}
```

**Don't chain Effects:**
```typescript
// BAD: effect chains
useEffect(() => { setGoldCount(c => c + 1) }, [card])
useEffect(() => { setRound(r => r + 1) }, [goldCount])
useEffect(() => { setIsGameOver(true) }, [round])

// GOOD: calculate in render + update in handler
const isGameOver = round > 5
function handlePlaceCard(nextCard) {
  setCard(nextCard)
  if (nextCard.gold) {
    // all state updates in one place
  }
}
```

**Data fetching → TanStack Query:**
```typescript
// BAD: useEffect with race conditions
useEffect(() => {
  fetchResults(query).then(setResults)
}, [query])

// GOOD: TanStack Query handles caching, races, revalidation
const { data } = useQuery({
  queryKey: ['search', query],
  queryFn: () => fetchResults(query)
})
```

**When to actually use useEffect:**
- Syncing with external systems (DOM APIs, WebSocket, subscriptions)
- Analytics on mount
- NOT for: derived state, data fetching, event handling, state sync

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
