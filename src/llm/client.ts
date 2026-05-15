import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, type ToolSet } from "ai";
import type { AppConfig } from "../config.js";
import type { AgentInput } from "../inputs/types.js";
import { buildSystemPrompt } from "../agent/system-prompt.js";
import type { RegisteredTool } from "../tools/registry.js";

export async function runAgent(
  config: AppConfig,
  input: AgentInput,
  staticContext: string,
  tools: Record<string, RegisteredTool>,
): Promise<string> {
  const result = await generateText({
    model: openai(config.OPENAI_MODEL),
    system: `${buildSystemPrompt(config)}\n\nMemory context:\n${staticContext}`,
    prompt: input.text,
    tools: tools as ToolSet,
    stopWhen: stepCountIs(5),
  });

  return result.text.trim() || "No response.";
}
