import * as vscode from 'vscode'
import { handlers } from './handlers'
import { entryForHandler } from './errorMap'
import { GitContext } from './types'

type NodeKind = 'action' | 'status' | 'section'

class GitDocNode extends vscode.TreeItem {
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
 * The GitDoc sidebar. Two sections:
 *  - Actions: Ask GitDoc (NL), Explain an error, Check now, Activity log
 *  - Status: what GitDoc detects in the repo right now (with a click-to-fix)
 * Status is recomputed on refresh() (wired to the same git change signal as detection).
 */
export class GitDocTreeProvider implements vscode.TreeDataProvider<GitDocNode> {
  private _onDidChange = new vscode.EventEmitter<GitDocNode | undefined>()
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
        if (await Promise.resolve(h.detect(ctx))) found.push(h.id)
      } catch {
        // ignore — detection is best-effort for the panel
      }
    }
    this.detected = found
  }

  getTreeItem(node: GitDocNode): vscode.TreeItem {
    return node
  }

  getChildren(node?: GitDocNode): GitDocNode[] {
    if (!node) {
      return [
        new GitDocNode('Actions', 'section'),
        new GitDocNode('Status', 'section'),
      ]
    }
    if (node.label === 'Actions') {
      return [
        new GitDocNode('Ask GitDoc…', 'action', {
          icon: 'comment-discussion',
          command: 'gitdoc.ask',
          tooltip: 'Describe what you want, or paste a git error',
        }),
        new GitDocNode('Explain a git error', 'action', {
          icon: 'question',
          command: 'gitdoc.explainError',
        }),
        new GitDocNode('Check repository now', 'action', {
          icon: 'refresh',
          command: 'gitdoc.checkNow',
        }),
        new GitDocNode('Activity log', 'action', {
          icon: 'output',
          command: 'gitdoc.viewLog',
        }),
      ]
    }
    // Status section
    if (this.detected.length === 0) {
      return [new GitDocNode('No git problems detected', 'status', { icon: 'check', description: 'all clear' })]
    }
    return this.detected.map(id => {
      const entry = entryForHandler(id)
      return new GitDocNode(entry?.title ?? id, 'status', {
        icon: 'warning',
        description: 'click to fix',
        tooltip: entry?.whatItMeans,
        command: 'gitdoc.checkNow',
      })
    })
  }
}
