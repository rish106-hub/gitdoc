// Rules-based intent classifier for the NL router. Deterministic, offline, token-free
// (that IS the pitch). An LLM is never in this decision path. Maps a plain-English
// phrase to ONE audited handler id, or refuses. Safety rules baked in:
//   - destructive handlers always require confirmation (never 1-click from NL)
//   - low confidence never auto-routes to a destructive handler
//   - if the phrase looks like a git error, it's classified as 'error' (→ explainer),
//     not an intent, so beginners can paste either into one box (outside-voice P1).

import { matchError } from './errorMap'

export type ClassKind = 'intent' | 'error' | 'unknown'

export interface Classification {
  kind: ClassKind
  handlerId?: string
  /** 0..1 — how sure we are about an intent match. */
  confidence: number
  /** True when the matched handler is destructive OR confidence is low. */
  needsConfirm: boolean
}

interface IntentRule {
  handlerId: string
  destructive: boolean
  // any pattern hit = candidate; more specific patterns first
  patterns: RegExp[]
}

// Ordered: earlier rules win ties. Destructive intents are marked so they always confirm.
const INTENT_RULES: IntentRule[] = [
  {
    handlerId: 'h5-undo-last-commit',
    destructive: true,
    patterns: [/\bundo\b.*\bcommit\b/i, /\brevert\b.*\blast\b/i, /\btake back\b.*\bcommit\b/i, /\buncommit\b/i],
  },
  {
    handlerId: 'h9-force-push',
    destructive: true,
    patterns: [/\bforce\b.*\bpush\b/i, /\bpush\b.*\bforce\b/i, /\boverwrite\b.*\bremote\b/i],
  },
  {
    handlerId: 'h4-local-changes-overwrite',
    destructive: true, // has a destructive branch (discard); router routes to the handler which gates it
    patterns: [/\bdiscard\b.*\bchanges\b/i, /\bthrow away\b.*\bchanges\b/i, /\breset\b.*\bhard\b/i, /\bstash\b.*\bchanges\b/i],
  },
  {
    handlerId: 'h8-branch-diverged',
    destructive: false,
    patterns: [/\bdiverged\b/i, /\bbehind\b.*\bremote\b/i, /\bcatch up\b.*\bremote\b/i, /\bpull\b.*\brebase\b/i, /\bsync\b.*\bremote\b/i],
  },
  {
    handlerId: 'h1-detached-head',
    destructive: false,
    patterns: [/\bdetached\b/i, /\bsave\b.*\bbranch\b/i, /\bcreate\b.*\bbranch\b.*\bhere\b/i, /\bmake\b.*\bbranch\b/i],
  },
  {
    handlerId: 'h2-merge-conflict',
    destructive: false,
    patterns: [/\bfinish\b.*\bmerge\b/i, /\bcomplete\b.*\bmerge\b/i, /\bresolve\b.*\bmerge\b/i],
  },
  {
    handlerId: 'h3-rebase-in-progress',
    destructive: false,
    patterns: [/\bcontinue\b.*\brebase\b/i, /\babort\b.*\brebase\b/i, /\bfinish\b.*\brebase\b/i],
  },
  {
    handlerId: 'h7-cherry-pick-in-progress',
    destructive: false,
    patterns: [/\bcherry.?pick\b/i],
  },
]

const ERROR_MARKERS = [/^fatal:/im, /^error:/im, /\bCONFLICT\b/, /\brejected\b/i, /would be overwritten/i, /not a git repository/i]

function looksLikeError(text: string): boolean {
  if (matchError(text)) return true
  return ERROR_MARKERS.some(re => re.test(text))
}

/**
 * Classify a plain-English phrase. Error-looking text → 'error' (route to explainer).
 * Otherwise match an intent. Unmatched → 'unknown' (caller shows a command as text).
 */
export function classify(input: string): Classification {
  const text = input.trim()
  if (!text) return { kind: 'unknown', confidence: 0, needsConfirm: false }

  if (looksLikeError(text)) {
    return { kind: 'error', confidence: 1, needsConfirm: false }
  }

  const matches: Array<{ rule: IntentRule; hits: number }> = []
  for (const rule of INTENT_RULES) {
    const hits = rule.patterns.filter(re => re.test(text)).length
    if (hits > 0) matches.push({ rule, hits })
  }

  if (matches.length === 0) {
    return { kind: 'unknown', confidence: 0, needsConfirm: false }
  }

  // Highest hit count wins; ties broken by rule order (first in list).
  matches.sort((a, b) => b.hits - a.hits)
  const best = matches[0]
  const ambiguous = matches.length > 1 && matches[1].hits === best.hits

  // Confidence: a real gradation, still pure regex-hit counting (no scoring model,
  // no LLM). Base 0.5, plus credit for how many distinct patterns in the winning
  // rule matched, plus credit for the margin over the runner-up. A true tie pins
  // to 0.5. Capped at 0.95 — we never claim certainty from regex alone.
  //   1 hit, no rival      -> 0.7   (single strong match, auto-routes)
  //   2 hits, no rival     -> 0.9
  //   2 hits vs 1-hit rival-> 0.8   (clear winner, not a tie)
  //   tie                  -> 0.5   (ambiguous, always confirms)
  const margin = matches.length > 1 ? best.hits - matches[1].hits : best.hits
  const raw = 0.5 + 0.1 * Math.min(best.hits, 3) + 0.1 * Math.min(margin, 2)
  const confidence = ambiguous ? 0.5 : Math.min(0.95, raw)

  return {
    kind: 'intent',
    handlerId: best.rule.handlerId,
    confidence,
    // Destructive OR ambiguous/low-confidence → confirm. Never silently auto-run.
    needsConfirm: best.rule.destructive || ambiguous || confidence < 0.7,
  }
}
