import * as vscode from 'vscode'
import { initTelemetry, readLog, clearLog } from './telemetry'
import { startDetection, runHandlers } from './detection'
import { handlers, undoLastCommit, forcePush } from './handlers'
import { createStatusBar, getOutputChannel, showError } from './ui'

function currentWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
}

export function activate(context: vscode.ExtensionContext): void {
  initTelemetry(context)
  context.subscriptions.push(createStatusBar())

  // Detection only runs when there's a workspace to watch. Commands, however,
  // are always registered so the extension is never dead on arrival.
  const workspaceRoot = currentWorkspaceRoot()
  if (workspaceRoot) {
    context.subscriptions.push(...startDetection(context, workspaceRoot))
  }

  const register = (id: string, fn: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn))

  // Runs a command that needs a workspace, surfacing a clear error if none is open.
  const withWorkspace = (fn: (root: string) => unknown) => () => {
    const root = currentWorkspaceRoot()
    if (!root) {
      showError('Open a folder with a git repository first.')
      return
    }
    return fn(root)
  }

  register('gitdoc.viewFixes', async () => {
    const items = handlers
      .filter(h => !h.commandOnly)
      .map(h => ({
        label: h.id,
        description: h.destructive ? 'destructive' : h.advisory ? 'advisory' : 'safe',
      }))
    await vscode.window.showQuickPick(items, {
      placeHolder: 'GitDoc: active auto-detection handlers',
    })
  })

  register('gitdoc.undoLastCommit', withWorkspace(root => undoLastCommit.handle({ workspaceRoot: root })))
  register('gitdoc.forcePush', withWorkspace(root => forcePush.handle({ workspaceRoot: root })))
  register('gitdoc.checkNow', withWorkspace(root => runHandlers({ workspaceRoot: root })))

  register('gitdoc.viewLog', async () => {
    const entries = readLog()
    const ch = getOutputChannel()
    ch.clear()
    if (entries.length === 0) {
      ch.appendLine('GitDoc activity log is empty.')
    } else {
      ch.appendLine(`GitDoc activity log (${entries.length} entries):`)
      entries.forEach(e => ch.appendLine(`  ${e.ts}  ${e.handlerId}  [${e.outcome}]`))
    }
    ch.show()
  })

  register('gitdoc.clearLog', async () => {
    const answer = await vscode.window.showWarningMessage(
      'Clear the GitDoc activity log?',
      { modal: true },
      'Clear',
      'Cancel'
    )
    if (answer === 'Clear') {
      clearLog()
      vscode.window.showInformationMessage('GitDoc: activity log cleared.')
    }
  })
}

export function deactivate(): void {
  // disposables cleaned up via context.subscriptions
}
