import * as vscode from 'vscode'
import { chatHtml } from './chatWebviewHtml'
import { runAgenticTurn, ChatEvent } from './aiChat'
import { ChatMessage } from './groq'
import { getConfig } from './config'
import { confirmDestructive } from './ui'

export const GROQ_KEY_SECRET = 'gitrescue.groqApiKey'

/**
 * The "Chat" webview in the GitRescue sidebar. Bridges the webview UI to the
 * agentic loop in aiChat.ts, stores the Groq key in SecretStorage, and gates
 * every mutating command through the existing two-step confirm.
 */
export class GitRescueChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView
  private history: ChatMessage[] = []

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly getRoot: () => string | undefined
  ) {}

  /** Called by the setGroqKey/clearGroqKey commands to refresh the UI. */
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
            await vscode.env.clipboard.writeText(msg.text.replace(/^git\s+/, 'git '))
            void vscode.window.showInformationMessage('GitRescue: command copied.')
          }
          break
        case 'ask':
          if (msg.text) await this.handleAsk(msg.text)
          break
      }
    })
  }

  private async handleAsk(text: string): Promise<void> {
    const view = this.view
    if (!view) return
    const emit = (event: ChatEvent) => view.webview.postMessage(event)

    const apiKey = await this.context.secrets.get(GROQ_KEY_SECRET)
    if (!apiKey) {
      emit({ type: 'error', message: 'No API key set.', kind: 'auth' })
      return
    }
    const root = this.getRoot()
    if (!root) {
      emit({ type: 'error', message: 'Open a folder with a git repository first.' })
      return
    }

    this.history = await runAgenticTurn({
      apiKey,
      model: getConfig().groqModel,
      workspaceRoot: root,
      history: this.history,
      userMessage: text,
      emit,
      confirm: (step1, step2) => confirmDestructive(step1, step2),
    })
  }
}

interface InboundMessage {
  type: 'ready' | 'openKeyPage' | 'saveKey' | 'copy' | 'ask'
  key?: string
  text?: string
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
