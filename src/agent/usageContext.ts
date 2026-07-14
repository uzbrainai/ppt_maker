/**
 * Ambient context for API-usage logging.
 *
 * When the HTTP server serves an authenticated generation, it wraps the whole
 * `generateDeck` call in `runWithUsageContext({ userId })`. The instrumented
 * OpenAI / Tavily / image clients read `currentUserId()` to attribute the call
 * to that user, without having to plumb the id through every function signature.
 *
 * Unwrapped callers (CLI, tests) get `undefined` and the log row's user_id is
 * left NULL — the summary still counts the call, it just isn't tied to a user.
 */

import { AsyncLocalStorage } from "async_hooks";

interface Ctx {
  userId?: string;
}

const storage = new AsyncLocalStorage<Ctx>();

export function runWithUsageContext<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentUserId(): string | undefined {
  return storage.getStore()?.userId;
}
