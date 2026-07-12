import * as vscode from 'vscode'
import { handlers } from './handlers'
import { detectCached } from './detection'
import { entryForHandler } from './errorMap'
import { GitContext } from './types'

type NodeKind = 'action' | 'status' | 'section'

class GitRescueNode extends vscode.TreeItem {
  constructor(
    label: string,
    kind: NodeKind,
    opts: { icon?: string; command?: string; description?: string; tooltip?: string } = {}
  ) {
    super(
      label,
      kind === 'section'
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    )
    if (opts.icon) this.iconPath = new vscode.ThemeIcon(opts.icon)
    if (opts.description) this.description = opts.description
    if (opts.tooltip) this.tooltip = opts.tooltip
    if (opts.command) {
      this.command = { command: opts.command, title: label }
    }
    this.contextValue = kind
  }
}

/**
 * The GitRescue sidebar. Two sections:
 *  - Actions: Ask GitRescue (NL), Explain an error, Check now, Activity log
 *  - Status: what GitRescue detects in the repo right now (with a click-to-fix)
 * Status is recomputed on refresh() (wired to the same git change signal as detection).
 */
export class GitRescueTreeProvider implements vscode.TreeDataProvider<GitRescueNode> {
  private _onDidChange = new vscode.EventEmitter<GitRescueNode | undefined>()
  readonly onDidChangeTreeData = this._onDidChange.event

  private detected: string[] = []

  constructor(private workspaceRoot: () => string | undefined) {}

  refresh(): void {
    void this.recomputeStatus().then(() => this._onDidChange.fire(undefined))
  }

  private async recomputeStatus(): Promise<void> {
    const root = this.workspaceRoot()
    if (!root) {
      this.detected = []
      return
    }
    const ctx: GitContext = { workspaceRoot: root }
    const found: string[] = []
    for (const h of handlers) {
      if (h.commandOnly) continue
      try {
        // Reuse the current detection generation's cached results (populated by
        // runHandlers), only computing handlers it short-circuited past.
        if (await detectCached(h, ctx)) found.push(h.id)
      } catch {
        // ignore — detection is best-effort for the panel
      }
    }
    this.detected = found
  }

  getTreeItem(node: GitRescueNode): vscode.TreeItem {
    return node
  }

  getChildren(node?: GitRescueNode): GitRescueNode[] {
    if (!node) {
      return [
        new GitRescueNode('Actions', 'section'),
        new GitRescueNode('Status', 'section'),
      ]
    }
    if (node.label === 'Actions') {
      return [
        new GitRescueNode('Ask GitRescue…', 'action', {
          icon: 'comment-discussion',
          command: 'gitrescue.ask',
          tooltip: 'Describe what you want, or paste a git error',
        }),
        new GitRescueNode('Explain a git error', 'action', {
          icon: 'question',
          command: 'gitrescue.explainError',
        }),
        new GitRescueNode('Check repository now', 'action', {
          icon: 'refresh',
          command: 'gitrescue.checkNow',
        }),
        new GitRescueNode('Activity log', 'action', {
          icon: 'output',
          command: 'gitrescue.viewLog',
        }),
      ]
    }
    // Status section
    if (this.detected.length === 0) {
      return [new GitRescueNode('No git problems detected', 'status', { icon: 'check', description: 'all clear' })]
    }
    return this.detected.map(id => {
      const entry = entryForHandler(id)
      return new GitRescueNode(entry?.title ?? id, 'status', {
        icon: 'warning',
        description: 'click to fix',
        tooltip: entry?.whatItMeans,
        command: 'gitrescue.checkNow',
      })
    })
  }
}
