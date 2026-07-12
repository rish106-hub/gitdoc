import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vscode', () => {
  class TreeItem {
    label: string
    collapsibleState: number
    iconPath?: unknown
    description?: string
    tooltip?: string
    command?: unknown
    contextValue?: string
    constructor(label: string, collapsibleState: number) {
      this.label = label
      this.collapsibleState = collapsibleState
    }
  }
  class ThemeIcon { constructor(public id: string) {} }
  class EventEmitter { event = vi.fn(); fire = vi.fn() }
  return {
    TreeItem,
    ThemeIcon,
    EventEmitter,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  }
})

// vi.mock factories are hoisted above module-level vars, so spies they reference
// must be created via vi.hoisted.
const { detectCached, handlerDetect } = vi.hoisted(() => ({
  detectCached: vi.fn(),
  handlerDetect: vi.fn(),
}))

// treeView routes every detect() through detection.detectCached (the shared,
// generation-tagged cache). Mock it so we control results and can prove treeView
// uses the shared path rather than calling handler.detect() itself.
vi.mock('../../src/detection', () => ({
  detectCached: (h: { id: string }, c: unknown) => detectCached(h, c),
}))

vi.mock('../../src/handlers', () => ({
  handlers: [
    { id: 'h1-detached-head', commandOnly: false, detect: handlerDetect, handle: async () => {} },
    { id: 'h5-undo-last-commit', commandOnly: true, detect: handlerDetect, handle: async () => {} },
    { id: 'h8-branch-diverged', commandOnly: false, detect: handlerDetect, handle: async () => {} },
  ],
}))

vi.mock('../../src/errorMap', () => ({
  entryForHandler: (id: string) => ({ title: `Title ${id}`, whatItMeans: `Means ${id}` }),
}))

import { GitRescueTreeProvider } from '../../src/treeView'

type Node = { label: string; command?: { command: string }; description?: string }

beforeEach(() => vi.resetAllMocks())

function children(p: GitRescueTreeProvider, section?: Node): Node[] {
  return p.getChildren(section as never) as unknown as Node[]
}

describe('GitRescueTreeProvider structure', () => {
  const p = new GitRescueTreeProvider(() => '/repo')

  it('root has Actions and Status sections', () => {
    const roots = children(p)
    expect(roots.map(n => n.label)).toEqual(['Actions', 'Status'])
  })

  it('Actions section wires the expected commands', () => {
    const actions = children(p, { label: 'Actions' })
    const cmds = actions.map(n => n.command?.command)
    expect(cmds).toContain('gitrescue.ask')
    expect(cmds).toContain('gitrescue.explainError')
    expect(cmds).toContain('gitrescue.checkNow')
    expect(cmds).toContain('gitrescue.viewLog')
  })

  it('empty status shows the all-clear node', () => {
    const status = children(p, { label: 'Status' })
    expect(status[0].label).toBe('No git problems detected')
  })
})

describe('recomputeStatus (via refresh)', () => {
  it('lists detected handlers, skips command-only, uses the shared cache', async () => {
    // h1 detected, h8 not; h5 is command-only and must never be queried.
    detectCached.mockImplementation((h: { id: string }) =>
      Promise.resolve(h.id === 'h1-detached-head')
    )
    const p = new GitRescueTreeProvider(() => '/repo')
    p.refresh()
    await vi.waitFor(() => {
      const status = children(p, { label: 'Status' })
      expect(status.map(n => n.label)).toEqual(['Title h1-detached-head'])
    })

    const queriedIds = detectCached.mock.calls.map(c => (c[0] as { id: string }).id)
    expect(queriedIds).not.toContain('h5-undo-last-commit') // command-only skipped
    expect(handlerDetect).not.toHaveBeenCalled() // never bypasses the shared cache
  })

  it('swallows a throwing detect and reports empty', async () => {
    detectCached.mockRejectedValue(new Error('boom'))
    const p = new GitRescueTreeProvider(() => '/repo')
    p.refresh()
    await vi.waitFor(() => expect(detectCached).toHaveBeenCalled())
    await vi.waitFor(() => {
      const status = children(p, { label: 'Status' })
      expect(status[0].label).toBe('No git problems detected')
    })
  })

  it('reports empty when there is no workspace root', async () => {
    const p = new GitRescueTreeProvider(() => undefined)
    p.refresh()
    await Promise.resolve()
    const status = children(p, { label: 'Status' })
    expect(status[0].label).toBe('No git problems detected')
    expect(detectCached).not.toHaveBeenCalled()
  })
})
