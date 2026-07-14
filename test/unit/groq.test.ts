import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chatCompletion, GroqError } from '../../src/groq'

const realFetch = globalThis.fetch

function mockFetch(impl: () => Partial<Response> | Promise<Partial<Response>>) {
  globalThis.fetch = vi.fn(async () => impl() as unknown as Response) as unknown as typeof fetch
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { globalThis.fetch = realFetch })

const base = { apiKey: 'k', model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] }

describe('chatCompletion', () => {
  it('sends model + messages + tools and Bearer auth', async () => {
    const spy = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] }),
    } as unknown as Response))
    globalThis.fetch = spy as unknown as typeof fetch

    const reply = await chatCompletion({ ...base, tools: [] })
    expect(reply.content).toBe('hello')
    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('m')
    expect(body.messages).toHaveLength(1)
  })

  it('sends response_format when JSON mode is requested', async () => {
    const spy = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    } as unknown as Response))
    globalThis.fetch = spy as unknown as typeof fetch
    await chatCompletion({ ...base, responseFormat: { type: 'json_object' } })
    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string).response_format).toEqual({ type: 'json_object' })
  })

  it('returns tool_calls when present', async () => {
    mockFetch(() => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'run_git_command', arguments: '{}' } }] } }] }),
    }))
    const reply = await chatCompletion(base)
    expect(reply.tool_calls?.[0].function.name).toBe('run_git_command')
  })

  it('maps 401 to an auth GroqError', async () => {
    mockFetch(() => ({ ok: false, status: 401, text: async () => 'unauthorized' }))
    await expect(chatCompletion(base)).rejects.toMatchObject({ kind: 'auth', status: 401 })
  })

  it('maps 429 to a rate-limit GroqError', async () => {
    mockFetch(() => ({ ok: false, status: 429, text: async () => 'slow down' }))
    await expect(chatCompletion(base)).rejects.toMatchObject({ kind: 'rate-limit' })
  })

  it('maps other non-2xx to a server GroqError', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: async () => 'boom' }))
    await expect(chatCompletion(base)).rejects.toMatchObject({ kind: 'server', status: 500 })
  })

  it('maps a transport failure to a network GroqError', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    await expect(chatCompletion(base)).rejects.toMatchObject({ kind: 'network' })
  })

  it('flags a response with no message as bad-response', async () => {
    mockFetch(() => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }))
    await expect(chatCompletion(base)).rejects.toBeInstanceOf(GroqError)
  })
})
