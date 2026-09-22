import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
});

export const chatModel = ollama(
  process.env.OLLAMA_MODEL ?? "qwen2.5:3b"
);