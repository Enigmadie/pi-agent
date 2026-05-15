import { tool } from "ai";
import type { z } from "zod";
import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { createGithubTools } from "./github.js";
import { createInfraTools } from "./infra.js";
import { createObsidianTools } from "./obsidian.js";

export type ToolRisk = "read" | "write" | "dangerous";

export type RegisteredTool = ReturnType<typeof tool> & {
  risk?: ToolRisk;
};

export function createLoggedTool<TSchema extends z.ZodTypeAny>(args: {
  name: string;
  description: string;
  inputSchema: TSchema;
  risk: ToolRisk;
  db: DatabaseClient;
  execute: (input: z.infer<TSchema>) => Promise<unknown>;
}): RegisteredTool {
  const registered = tool({
    description: args.description,
    inputSchema: args.inputSchema,
    execute: async (input) => {
      const startedAt = Date.now();
      try {
        const result = await args.execute(input as z.infer<TSchema>);
        await args.db.insertToolCall({
          toolName: args.name,
          risk: args.risk,
          input: JSON.stringify(input),
          output: JSON.stringify(result),
          ok: true,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (error) {
        await args.db.insertToolCall({
          toolName: args.name,
          risk: args.risk,
          input: JSON.stringify(input),
          output: error instanceof Error ? error.message : String(error),
          ok: false,
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }
    },
  }) as unknown as RegisteredTool;

  registered.risk = args.risk;
  return registered;
}

export function createToolRegistry(
  config: AppConfig,
  db: DatabaseClient,
): Record<string, RegisteredTool> {
  return {
    ...createGithubTools(config, db),
    ...createInfraTools(config, db),
    ...createObsidianTools(config, db),
  };
}
