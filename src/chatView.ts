import * as vscode from 'vscode'
import { chatHtml } from './chatWebviewHtml'
import { answerTurn, runSuggestedCommand, recordRun } from './aiChat'
import { classifyProposedCommand } from './commandGuard'
import { ChatMessage } from './groq'
import { getConfig } from './config'
import { confirmDestructive } from './ui'

export const GROQ_KEY_SECRET = 'gitrescue.groqApiKey'

/**
 * The "Ask AI" webview. The model returns a structured answer (plain text +
 * suggested commands + terms); the webview renders it and shows a Run button
 * per command. Running a command goes back through runSuggestedCommand, which
 * gates it via commandGuard + two-step confirm.
 */
export class GitRescueChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView
  private history: ChatMessage[] = []

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly getRoot: () => string | undefined
  ) {}

  async refreshKeyState(): Promise<void> {
    if (!this.view) return
    const hasKey = !!(await this.context.secrets.get(GROQ_KEY_SECRET))
    this.view.webview.postMessage({ type: 'init', hasKey })
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view
    view.webview.options = { enableScripts: true, localResourceRoots: [] }
    const nonce = makeNonce()
    view.webview.html = chatHtml(nonce, view.webview.cspSource)

    view.webview.onDidReceiveMessage(async (msg: InboundMessage) => {
      switch (msg.type) {
        case 'ready':
          await this.refreshKeyState()
          break
        case 'openKeyPage':
          void vscode.env.openExternal(vscode.Uri.parse('https://console.groq.com/keys'))
          break
        case 'saveKey':
          if (msg.key) {
            await this.context.secrets.store(GROQ_KEY_SECRET, msg.key.trim())
            this.history = []
            view.webview.postMessage({ type: 'keySaved' })
          }
          break
        case 'copy':
          if (msg.text) {
            await vscode.env.clipboard.writeText(msg.text)
            void vscode.window.showInformationMessage('GitRescue: command copied.')
          }
          break
        case 'ask':
          if (msg.text) await this.handleAsk(msg.text)
          break
        case 'run':
          if (msg.command) await this.handleRun(msg.command, msg.explanation ?? '', msg.rowId ?? '')
          break
      }
    })
  }

  private async handleAsk(text: string): Promise<void> {
    const view = this.view
    if (!view) return
    const apiKey = await this.context.secrets.get(GROQ_KEY_SECRET)
    if (!apiKey) {
      view.webview.postMessage({ type: 'error', message: 'No API key set.', kind: 'auth' })
      return
    }
    const root = this.getRoot()
    if (!root) {
      view.webview.postMessage({ type: 'error', message: 'Open a folder with a git repository first.' })
      return
    }

    const result = await answerTurn({
      apiKey, model: getConfig().groqModel, workspaceRoot: root,
      history: this.history, userMessage: text,
    })
    this.history = result.history
    if (result.error) {
      view.webview.postMessage({ type: 'error', message: result.error.message, kind: result.error.kind })
      return
    }
    // Enrich each command with its safety class so the webview knows whether to
    // show a Run button (read/mutating) or copy-only (blocked) — without
    // duplicating commandGuard logic in the webview.
    const commands = result.answer.commands.map(c => ({
      ...c,
      klass: classifyProposedCommand(c.command.replace(/^git\s+/, '').split(/\s+/).filter(Boolean)),
    }))
    view.webview.postMessage({ type: 'answer', answer: { ...result.answer, commands } })
  }

  private async handleRun(command: string, explanation: string, rowId: string): Promise<void> {
    const view = this.view
    if (!view) return
    const root = this.getRoot()
    if (!root) {
      view.webview.postMessage({ type: 'runResult', rowId, ok: false, output: 'Open a git repository first.' })
      return
    }
    const result = await runSuggestedCommand(command, root, confirmDestructive, explanation)
    this.history = recordRun(this.history, command, result)
    view.webview.postMessage({ type: 'runResult', rowId, ok: result.ok, output: result.output, klass: result.klass })
  }
}

interface InboundMessage {
  type: 'ready' | 'openKeyPage' | 'saveKey' | 'copy' | 'ask' | 'run'
  key?: string
  text?: string
  command?: string
  explanation?: string
  rowId?: string
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
