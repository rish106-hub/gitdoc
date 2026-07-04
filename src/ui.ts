import * as vscode from 'vscode'

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
}

export function showError(message: string): void {
  vscode.window.showErrorMessage(`GitDoc: ${message}`)
}
