import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { AppConfig } from "../config.js";
import { messages, toolCalls } from "./schema.js";

export type InsertMessage = {
  source: string;
  userId?: string;
  chatId?: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export type InsertToolCall = {
  toolName: string;
  risk: "read" | "write" | "dangerous";
  input: string;
  output: string;
  ok: boolean;
  durationMs: number;
};

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export function createDatabaseClient(config: AppConfig) {
  const sqlite = new Database(config.AGENT_DB_PATH);
  const db = drizzle(sqlite);

  return {
    async initialize(): Promise<void> {
      sqlite.exec(`
        create table if not exists messages (
          id integer primary key autoincrement,
          created_at text not null,
          source text not null,
          user_id text,
          chat_id text,
          role text not null,
          content text not null
        );

        create table if not exists tool_calls (
          id integer primary key autoincrement,
          created_at text not null,
          tool_name text not null,
          risk text not null,
          input text not null,
          output text not null,
          ok integer not null,
          duration_ms integer not null
        );

        create table if not exists approvals (
          id text primary key,
          created_at text not null,
          updated_at text not null,
          state text not null,
          action text not null,
          payload text not null
        );
      `);
    },
    async insertMessage(input: InsertMessage): Promise<void> {
      await db.insert(messages).values({
        createdAt: new Date().toISOString(),
        source: input.source,
        userId: input.userId,
        chatId: input.chatId,
        role: input.role,
        content: input.content,
      });
    },
    async insertToolCall(input: InsertToolCall): Promise<void> {
      await db.insert(toolCalls).values({
        createdAt: new Date().toISOString(),
        toolName: input.toolName,
        risk: input.risk,
        input: input.input,
        output: input.output,
        ok: input.ok,
        durationMs: input.durationMs,
      });
    },
  };
}
