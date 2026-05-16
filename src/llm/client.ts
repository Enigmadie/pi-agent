import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, type ToolSet } from "ai";
import type { AppConfig } from "../config.js";
import type { ConversationMessage } from "../db/client.js";
import type { AgentInput } from "../inputs/types.js";
import { buildSystemPrompt } from "../agent/system-prompt.js";
import type { RegisteredTool } from "../tools/registry.js";

export async function runAgent(
  config: AppConfig,
  input: AgentInput,
  staticContext: string,
  recentMessages: ConversationMessage[],
  tools: Record<string, RegisteredTool>,
): Promise<string> {
  const result = await generateText({
    model: openai(config.OPENAI_MODEL),
    system: `${buildSystemPrompt(config)}\n\nMemory context:\n${staticContext}\n\nRecent conversation:\n${formatRecentMessages(recentMessages)}`,
    prompt: input.text,
    tools: tools as ToolSet,
    stopWhen: stepCountIs(5),
  });

  return result.text.trim() || "No response.";
}

function formatRecentMessages(messages: ConversationMessage[]): string {
  if (messages.length === 0) {
    return "No recent messages.";
  }

  return messages
    .map((message) => `${message.role}: ${truncate(message.content, 1_000)}`)
    .join("\n");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
