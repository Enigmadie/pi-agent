import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { runAgent } from "../llm/client.js";
import { createToolRegistry } from "../tools/registry.js";
import type { AgentInput } from "../inputs/types.js";
import { loadStaticContext } from "./context.js";

export async function handleAgentInput(
  config: AppConfig,
  db: DatabaseClient,
  input: AgentInput,
): Promise<string> {
  await db.insertMessage({
    source: input.source,
    userId: input.userId,
    chatId: input.chatId,
    role: "user",
    content: input.text,
  });

  const tools = createToolRegistry(config, db);
  const staticContext = await loadStaticContext(config);
  const answer = await runAgent(config, input, staticContext, tools);

  await db.insertMessage({
    source: input.source,
    userId: input.userId,
    chatId: input.chatId,
    role: "assistant",
    content: answer,
  });

  return answer;
}
