import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({ execFile: vi.fn() }))

const { FakeEventEmitter, FakeTreeItem } = vi.hoisted(() => {
  class FakeEventEmitter<T> {
    private listeners: Array<(e: T) => void> = []
    event = (fn: (e: T) => void) => {
      this.listeners.push(fn)
      return { dispose: () => {} }
    }
    fire(e: T): void {
      this.listeners.forEach(l => l(e))
    }
  }

  class FakeTreeItem {
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

  return { FakeEventEmitter, FakeTreeItem }
})

vi.mock('vscode', () => ({
  EventEmitter: FakeEventEmitter,
  TreeItem: FakeTreeItem,
  TreeItemCollapsibleState: { None: 0, Expanded: 2 },
  ThemeIcon: class {
    constructor(public id: string) {}
  },
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  workspace: { getConfiguration: vi.fn(() => ({ get: (_k: string, d: unknown) => d })) },
  extensions: { getExtension: vi.fn(() => undefined) },
}))

import { GitRescueTreeProvider } from '../../src/treeView'
import { handlers } from '../../src/handlers'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GitRescueTreeProvider — top level', () => {
  it('returns Actions and Status sections with no root node', () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    const roots = p.getChildren()
    expect(roots.map(n => n.label)).toEqual(['Actions', 'Status'])
  })
})

describe('GitRescueTreeProvider — Actions section', () => {
  it('lists all 4 actions wired to their commands', () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    const [actionsNode] = p.getChildren()
    const actions = p.getChildren(actionsNode)
    const commands = actions.map(a => (a.command as { command: string }).command)
    expect(commands).toEqual([
      'gitrescue.ask',
      'gitrescue.explainError',
      'gitrescue.checkNow',
      'gitrescue.viewLog',
    ])
  })
})

describe('GitRescueTreeProvider — Status section', () => {
  it('shows "no problems" when workspaceRoot is undefined (no repo open)', () => {
    const p = new GitRescueTreeProvider(() => undefined)
    const [, statusNode] = p.getChildren()
    const status = p.getChildren(statusNode)
    expect(status).toHaveLength(1)
    expect(status[0].label).toBe('No git problems detected')
  })

  it('shows "no problems" before refresh() has ever run, even with a repo open', () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    const [, statusNode] = p.getChildren()
    expect(p.getChildren(statusNode)[0].label).toBe('No git problems detected')
  })

  it('refresh() recomputes status by running every non-commandOnly detector and fires the change event', async () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    let fired = false
    p.onDidChangeTreeData(() => {
      fired = true
    })

    // Force one known handler to report "detected" without touching real git/fs.
    const spy = vi.spyOn(handlers[0], 'detect').mockResolvedValue(true)
    const others = handlers.slice(1).map(h => vi.spyOn(h, 'detect').mockResolvedValue(false))

    p.refresh()
    await vi.waitFor(() => expect(fired).toBe(true))

    const [, statusNode] = p.getChildren()
    const status = p.getChildren(statusNode)
    expect(status).toHaveLength(1)
    expect(status[0].label).not.toBe('No git problems detected')
    expect((status[0].command as { command: string }).command).toBe('gitrescue.checkNow')

    spy.mockRestore()
    others.forEach(s => s.mockRestore())
  })

  it('never fires a detector for a commandOnly handler during refresh (h5/h9 are command-only)', async () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    const commandOnlyHandlers = handlers.filter(h => h.commandOnly)
    expect(commandOnlyHandlers.length).toBeGreaterThan(0)

    const spies = commandOnlyHandlers.map(h => vi.spyOn(h, 'detect'))
    const otherSpies = handlers.filter(h => !h.commandOnly).map(h => vi.spyOn(h, 'detect').mockResolvedValue(false))

    let fired = false
    p.onDidChangeTreeData(() => {
      fired = true
    })
    p.refresh()
    await vi.waitFor(() => expect(fired).toBe(true))

    spies.forEach(s => expect(s).not.toHaveBeenCalled())

    spies.forEach(s => s.mockRestore())
    otherSpies.forEach(s => s.mockRestore())
  })

  it('a throwing detector is swallowed, never crashes refresh (best-effort panel)', async () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    const spies = handlers
      .filter(h => !h.commandOnly)
      .map(h => vi.spyOn(h, 'detect').mockRejectedValue(new Error('boom')))

    let fired = false
    p.onDidChangeTreeData(() => {
      fired = true
    })
    expect(() => p.refresh()).not.toThrow()
    await vi.waitFor(() => expect(fired).toBe(true))

    const [, statusNode] = p.getChildren()
    expect(p.getChildren(statusNode)[0].label).toBe('No git problems detected')

    spies.forEach(s => s.mockRestore())
  })
})

describe('GitRescueTreeProvider — stress', () => {
  it('handles 500 rapid refresh() calls without losing consistency or throwing', async () => {
    const p = new GitRescueTreeProvider(() => '/repo')
    const spies = handlers.filter(h => !h.commandOnly).map(h => vi.spyOn(h, 'detect').mockResolvedValue(false))

    let fireCount = 0
    p.onDidChangeTreeData(() => {
      fireCount++
    })

    for (let i = 0; i < 500; i++) p.refresh()
    await vi.waitFor(() => expect(fireCount).toBeGreaterThan(0))

    const [, statusNode] = p.getChildren()
    expect(p.getChildren(statusNode)[0].label).toBe('No git problems detected')

    spies.forEach(s => s.mockRestore())
  })
})
