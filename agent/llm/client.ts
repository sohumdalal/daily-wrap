import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config.ts';

export type Provider = 'anthropic' | 'openai';

export type GenerateInput = {
  system: string;
  user: string;
  provider?: Provider;
  model?: string;
  temperature?: number;
};

export type GenerateOutput = {
  provider: Provider;
  model: string;
  body: string;
};

export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  const provider = input.provider ?? config.llm.provider;
  if (provider === 'anthropic') return generateClaude(input);
  return generateOpenAI(input);
}

async function generateClaude(input: GenerateInput): Promise<GenerateOutput> {
  if (!config.llm.anthropicKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const client = new Anthropic({ apiKey: config.llm.anthropicKey });
  const model = input.model ?? config.llm.anthropicModel;
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: input.temperature ?? 0.7,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
  });
  const body = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return { provider: 'anthropic', model, body };
}

async function generateOpenAI(input: GenerateInput): Promise<GenerateOutput> {
  if (!config.llm.openaiKey) throw new Error('OPENAI_API_KEY is not configured');
  const client = new OpenAI({ apiKey: config.llm.openaiKey });
  const model = input.model ?? config.llm.openaiModel;
  const res = await client.chat.completions.create({
    model,
    temperature: input.temperature ?? 0.7,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
  });
  const body = res.choices[0]?.message?.content ?? '';
  return { provider: 'openai', model, body };
}
