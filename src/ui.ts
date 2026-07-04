import * as vscode from 'vscode'
import { getConfig } from './config'

let outputChannel: vscode.OutputChannel | undefined

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('GitDoc')
  }
  return outputChannel
}

export async function confirm(message: string): Promise<boolean> {
  const answer = await vscode.window.showWarningMessage(message, { modal: true }, 'Yes', 'Cancel')
  return answer === 'Yes'
}

/**
 * Confirmation for non-destructive fixes. Honors gitdoc.confirmSafeFixes: when
 * the user turns it off, safe fixes apply without a prompt. Destructive fixes
 * never use this — they always go through confirmDestructive.
 */
export async function confirmSafe(message: string): Promise<boolean> {
  if (!getConfig().confirmSafeFixes) return true
  return confirm(message)
}

/** Renders an argv array as the exact shell command a user would type. */
export function previewCommand(args: string[]): string {
  return 'git ' + args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')
}

export async function confirmDestructive(
  step1: string,
  step2: string
): Promise<boolean> {
  const first = await vscode.window.showWarningMessage(step1, { modal: true }, 'Yes', 'Cancel')
  if (first !== 'Yes') return false
  const second = await vscode.window.showWarningMessage(step2, { modal: true }, 'Execute', 'Cancel')
  return second === 'Execute'
}

export async function quickPick(
  placeholder: string,
  items: vscode.QuickPickItem[]
): Promise<string | undefined> {
  const picked = await vscode.window.showQuickPick(items, { placeHolder: placeholder })
  return picked?.label
}

export function showInfo(message: string): void {
  vscode.window.showInformationMessage(`GitDoc: ${message}`)
  flashStatus('fix applied')
}

export function showError(message: string): void {
  vscode.window.showErrorMessage(`GitDoc: ${message}`)
}

let statusBar: vscode.StatusBarItem | undefined

export function createStatusBar(): vscode.StatusBarItem {
  if (!statusBar) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    statusBar.text = '$(git-branch) GitDoc'
    statusBar.tooltip = 'GitDoc is watching this repository. Click to see available fixes.'
    statusBar.command = 'gitdoc.viewFixes'
    statusBar.show()
  }
  return statusBar
}

/** Briefly reflect the last handler that ran in the status bar. */
export function flashStatus(text: string): void {
  if (!statusBar) return
  const original = statusBar.text
  statusBar.text = `$(check) GitDoc: ${text}`
  setTimeout(() => {
    if (statusBar) statusBar.text = original
  }, 4000)
}
