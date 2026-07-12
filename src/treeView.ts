import * as vscode from 'vscode'
import { handlers } from './handlers'
import { entryForHandler } from './errorMap'
import { GitContext } from './types'
import { CompanionGuidance, getRepositorySnapshot, guidanceFor } from './companion'

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
  private guidance: CompanionGuidance = guidanceFor(null)
  private hasSnapshot = false

  constructor(private workspaceRoot: () => string | undefined) {}

  refresh(): void {
    void this.recomputeStatus().then(() => this._onDidChange.fire(undefined))
  }

  private async recomputeStatus(): Promise<void> {
    const root = this.workspaceRoot()
    if (!root) {
      this.detected = []
      this.guidance = guidanceFor(null)
      this.hasSnapshot = false
      return
    }
    // Panel status is best-effort. Never let an unavailable Git process block
    // existing actionable-state detection or freeze the sidebar.
    const snapshot = await Promise.race([
      getRepositorySnapshot(root),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 100)),
    ])
    if (snapshot) {
      this.guidance = guidanceFor(snapshot)
      this.hasSnapshot = true
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
    // Keep a useful fallback while a status process is unavailable.
    if (!this.hasSnapshot) {
      if (this.detected.length === 0) {
        return [new GitRescueNode('No git problems detected', 'status', { icon: 'check', description: 'all clear' })]
      }
      return this.detected.map(id => {
        const entry = entryForHandler(id)
        return new GitRescueNode(entry?.title ?? id, 'status', {
          icon: 'warning', description: 'click to fix', tooltip: entry?.whatItMeans, command: 'gitrescue.checkNow',
        })
      })
    }

    // Status section: daily guidance first; exceptional states remain actionable.
    const nodes = [
      new GitRescueNode(this.guidance.title, 'status', {
        icon: this.detected.length > 0 ? 'warning' : 'git-branch',
        description: this.guidance.summary,
        tooltip: this.guidance.nextStep,
      }),
      new GitRescueNode(`Next: ${this.guidance.nextStep}`, 'status', {
        icon: 'arrow-right',
        tooltip: 'GitRescue suggests this based on your repository state.',
      }),
    ]
    return nodes.concat(this.detected.map(id => {
      const entry = entryForHandler(id)
      return new GitRescueNode(entry?.title ?? id, 'status', {
        icon: 'warning',
        description: 'click to fix',
        tooltip: entry?.whatItMeans,
        command: 'gitrescue.checkNow',
      })
    }))
  }
}
