import { GitErrorEntry, matchError, entryForHandler } from './errorMap'
import { handlers } from './handlers'
import { GitContext } from './types'

export interface Explanation {
  title: string
  body: string
  /** Handler id to offer as a one-click fix, present ONLY when the live repo is in that state. */
  liveFixHandlerId?: string
  /** Command to show as copyable text when there's no live fix. */
  suggestedCommand?: string
  /** True when nothing in the map matched (caller logs a miss). */
  unmatched: boolean
}

function assembleBody(entry: GitErrorEntry): string {
  const lines = [
    `What this means: ${entry.whatItMeans}`,
    ``,
    `Why it happened: ${entry.why}`,
  ]
  return lines.join('\n')
}

/**
 * Explain a pasted/observed error string. If the entry has a fixHandlerId AND the
 * live repo is currently in that detected state, the fix is offered; otherwise we
 * only explain and suggest a command (never auto-run). This is the resolution to
 * "a pasted error has no repo state" — we confirm the state is real before offering.
 */
export async function explainError(
  text: string,
  ctx: GitContext
): Promise<Explanation> {
  const entry = matchError(text)
  if (!entry) {
    return {
      title: "I don't recognize this git error yet",
      body:
        "GitDoc doesn't have an explanation for this one. It's been noted so the " +
        'explanations can improve. In the meantime, check the exact wording of the ' +
        'error and what command you just ran.',
      unmatched: true,
    }
  }

  const liveFixHandlerId = entry.fixHandlerId
    ? await handlerDetectsLive(entry.fixHandlerId, ctx)
      ? entry.fixHandlerId
      : undefined
    : undefined

  return {
    title: entry.title,
    body: assembleBody(entry),
    liveFixHandlerId,
    suggestedCommand: liveFixHandlerId ? undefined : entry.suggestedCommand,
    unmatched: false,
  }
}

/** Explanation for an already auto-detected state — the fix is always live here. */
export function explainDetectedState(handlerId: string): Explanation | null {
  const entry = entryForHandler(handlerId)
  if (!entry) return null
  return {
    title: entry.title,
    body: assembleBody(entry),
    liveFixHandlerId: handlerId,
    unmatched: false,
  }
}

async function handlerDetectsLive(handlerId: string, ctx: GitContext): Promise<boolean> {
  const h = handlers.find(x => x.id === handlerId)
  if (!h) return false
  try {
    return await Promise.resolve(h.detect(ctx))
  } catch {
    return false
  }
}
