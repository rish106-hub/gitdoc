// Minimal Groq chat-completions client. Groq exposes an OpenAI-compatible API,
// so this is a thin `fetch` wrapper — no SDK dependency (keeps the extension
// dependency-free; esbuild bundles nothing extra). Never logs the API key.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  /** present on assistant messages that call tools */
  tool_calls?: ToolCall[]
  /** present on 'tool' messages — which call this responds to */
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AssistantReply {
  content: string | null
  tool_calls?: ToolCall[]
}

/** Typed error so the UI can react (e.g. re-prompt for the key on 401). */
export class GroqError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'network' | 'server' | 'bad-response',
    readonly status?: number
  ) {
    super(message)
    this.name = 'GroqError'
  }
}

export interface ChatOptions {
  apiKey: string
  model: string
  messages: ChatMessage[]
  tools?: ToolDef[]
  /** low temperature — this is a git assistant, not a creative writer */
  temperature?: number
  /** force a JSON object response (OpenAI/Groq JSON mode) */
  responseFormat?: { type: 'json_object' }
  signal?: AbortSignal
}

/**
 * One round-trip to Groq. Returns the assistant message (text and/or tool
 * calls). Maps transport/HTTP failures to a typed GroqError; the caller drives
 * the agentic loop (re-calling with tool results appended).
 */
export async function chatCompletion(opts: ChatOptions): Promise<AssistantReply> {
  let res: Response
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: opts.tools,
        temperature: opts.temperature ?? 0.2,
        response_format: opts.responseFormat,
      }),
      signal: opts.signal,
    })
  } catch (e) {
    throw new GroqError(`Could not reach Groq: ${(e as Error).message}`, 'network')
  }

  if (res.status === 401 || res.status === 403) {
    throw new GroqError('Groq rejected the API key (invalid or expired).', 'auth', res.status)
  }
  if (res.status === 429) {
    throw new GroqError('Groq rate limit reached. Wait a moment and try again.', 'rate-limit', 429)
  }
  if (!res.ok) {
    const detail = await safeText(res)
    throw new GroqError(`Groq request failed (${res.status}). ${detail}`, 'server', res.status)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new GroqError('Groq returned a response that was not valid JSON.', 'bad-response')
  }

  const msg = (data as GroqResponse)?.choices?.[0]?.message
  if (!msg) throw new GroqError('Groq response contained no message.', 'bad-response')
  return { content: msg.content ?? null, tool_calls: msg.tool_calls }
}

interface GroqResponse {
  choices?: Array<{ message?: AssistantReply }>
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text()
    return t.slice(0, 300)
  } catch {
    return ''
  }
}
