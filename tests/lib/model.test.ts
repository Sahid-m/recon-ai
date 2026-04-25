import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('getModel', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a model object when AI_PROVIDER=openai', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai')
    vi.stubEnv('AI_MODEL', 'gpt-4o')
    const { getModel } = await import('../../lib/model')
    const model = getModel()
    expect(model).toBeDefined()
  })

  it('returns a model object when AI_PROVIDER=anthropic', async () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic')
    vi.stubEnv('AI_MODEL', 'claude-3-5-sonnet-20241022')
    const { getModel } = await import('../../lib/model')
    const model = getModel()
    expect(model).toBeDefined()
  })
})
