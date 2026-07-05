// NL router — plans what to do with a plain-English phrase or a pasted error.
// Pure and vscode-free so it is fully unit-testable; the extension command layer
// executes the plan (dialogs, handler dispatch) through the normal safety gates.

import { classify, Classification } from './classifier'

export type RouteAction = 'explain' | 'run-handler' | 'unknown'

export interface RoutePlan {
  action: RouteAction
  /** Present when action === 'run-handler'. Whitelist-checked by the executor. */
  handlerId?: string
  /** True when the executor must confirm before running (destructive/low-confidence). */
  needsConfirm: boolean
  /** User-facing message for 'unknown' (and context for confirms). */
  message: string
  classification: Classification
}

export function planRoute(input: string): RoutePlan {
  const c = classify(input)

  if (c.kind === 'error') {
    return {
      action: 'explain',
      needsConfirm: false,
      message: 'That looks like a git error — explaining it.',
      classification: c,
    }
  }

  if (c.kind === 'intent' && c.handlerId) {
    return {
      action: 'run-handler',
      handlerId: c.handlerId,
      needsConfirm: c.needsConfirm,
      message: '',
      classification: c,
    }
  }

  return {
    action: 'unknown',
    needsConfirm: false,
    message:
      "I couldn't match that to a safe action I know. Try rephrasing (e.g. \"undo my last commit\", " +
      '"my branch is behind", "save this as a branch"), or paste the exact git error and I\'ll explain it.',
    classification: c,
  }
}
