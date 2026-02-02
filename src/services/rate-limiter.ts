import { Effect, HashMap, Option, Ref } from "effect"
import { RateLimitedError } from "../domain/errors"
import { UserId } from "../domain/ids"

interface RateLimitEntry {
  readonly count: number
  readonly resetAt: number
}

const makeEntry = (now: number): RateLimitEntry => ({ count: 1, resetAt: now + 1000 })

const incrementEntry = (entry: RateLimitEntry, now: number): RateLimitEntry =>
  now > entry.resetAt ? makeEntry(now) : { ...entry, count: entry.count + 1 }

export class RateLimiter extends Effect.Service<RateLimiter>()("RateLimiter", {
  accessors: true,
  effect: Effect.gen(function*() {
    const limitsRef = yield* Ref.make(HashMap.empty<UserId, RateLimitEntry>())

    const check = (userId: UserId, maxPerSecond = 10) =>
      Ref.modify(limitsRef, (limits) => {
        const now = Date.now()
        const existing = HashMap.get(limits, userId)
        const entry = Option.match(existing, {
          onNone: () => makeEntry(now),
          onSome: (e) => incrementEntry(e, now)
        })
        const newLimits = HashMap.set(limits, userId, entry)

        if (entry.count > maxPerSecond) {
          const error = new RateLimitedError({
            userId,
            retryAfterMs: entry.resetAt - now,
            message: `Rate limited. Try again in ${entry.resetAt - now}ms`
          })
          return [Option.some(error), newLimits] as const
        }

        return [Option.none(), newLimits] as const
      }).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.void,
            onSome: Effect.fail
          })
        )
      )

    const reset = (userId: UserId) =>
      Ref.update(limitsRef, HashMap.remove(userId))

    const clear = Ref.set(limitsRef, HashMap.empty<UserId, RateLimitEntry>())

    return { check, reset, clear }
  })
}) {}
