export const config = {
  port: Number(process.env.PORT ?? 80),
  dataRoot: process.env.DATA_ROOT ?? '/data',
  appUrl: process.env.APP_URL ?? '',
  github: {
    token: process.env.GITHUB_TOKEN ?? '',
    username: process.env.GITHUB_USERNAME ?? '',
  },
  llm: {
    provider: (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
  },
};

export const isDev = config.port !== 80;
