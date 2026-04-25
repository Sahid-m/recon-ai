import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'

export function getModel() {
  const provider = process.env.AI_PROVIDER ?? 'openai'
  const modelId = process.env.AI_MODEL ?? 'gpt-4o'

  if (provider === 'anthropic') {
    return createAnthropic()(modelId)
  }
  return createOpenAI()(modelId)
}
