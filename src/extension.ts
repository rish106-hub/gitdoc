import * as vscode from 'vscode'
import { initTelemetry } from './telemetry'
import { startDetection } from './detection'
import { handlers, undoLastCommit, forcePush } from './handlers'

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) return

  const workspaceRoot = workspaceFolders[0].uri.fsPath

  initTelemetry(context)

  const disposables = startDetection(context, workspaceRoot)
  context.subscriptions.push(...disposables)

  // View all handlers via command palette
  context.subscriptions.push(
    vscode.commands.registerCommand('gitdoc.viewFixes', async () => {
      const items = handlers
        .filter(h => !h.commandOnly)
        .map(h => ({
          label: h.id,
          description: h.destructive ? 'destructive' : h.advisory ? 'advisory' : 'safe',
        }))
      await vscode.window.showQuickPick(items, {
        placeHolder: 'GitDoc: active handlers',
        canPickMany: false,
      })
    })
  )

  // Manual command: undo last commit
  context.subscriptions.push(
    vscode.commands.registerCommand('gitdoc.undoLastCommit', async () => {
      await undoLastCommit.handle({ workspaceRoot })
    })
  )

  // Manual command: force push
  context.subscriptions.push(
    vscode.commands.registerCommand('gitdoc.forcePush', async () => {
      await forcePush.handle({ workspaceRoot })
    })
  )
}

export function deactivate(): void {
  // disposables cleaned up via context.subscriptions
}
