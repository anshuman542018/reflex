import { env } from "cloudflare:workers";

function readRuntimeValue(name: string) {
  const workerValue = (env as unknown as Record<string, unknown>)[name];
  if (typeof workerValue === "string" && workerValue.trim()) return workerValue;

  if (typeof process !== "undefined") {
    const processValue = process.env[name];
    if (typeof processValue === "string" && processValue.trim()) return processValue;
  }

  return undefined;
}

export function getOpenAIKey() {
  return readRuntimeValue("OPENAI_API_KEY");
}

export function getOpenAIModel() {
  return readRuntimeValue("OPENAI_MODEL") ?? "gpt-5.6-sol";
}

export function hasOpenAIKey() {
  return Boolean(getOpenAIKey());
}
