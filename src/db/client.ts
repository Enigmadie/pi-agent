import Database from "better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { AppConfig } from "../config.js";
import { approvals, messages, toolCalls } from "./schema.js";

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

export type ConversationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PendingApprovalRecord = {
  id: string;
  action: string;
  payload: string;
};

export type ApprovalRecord = PendingApprovalRecord & {
  state: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  updatedAt: string;
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
    async listRecentMessages(input: {
      source: string;
      chatId?: string;
      userId?: string;
      limit: number;
    }): Promise<ConversationMessage[]> {
      const filters = [eq(messages.source, input.source)];
      if (input.chatId) {
        filters.push(eq(messages.chatId, input.chatId));
      } else if (input.userId) {
        filters.push(eq(messages.userId, input.userId));
      }

      const rows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(and(...filters))
        .orderBy(desc(messages.id))
        .limit(input.limit);

      return rows.reverse();
    },
    async createApproval(input: { id: string; action: string; payload: string }): Promise<void> {
      const now = new Date().toISOString();
      await db.insert(approvals).values({
        id: input.id,
        createdAt: now,
        updatedAt: now,
        state: "pending",
        action: input.action,
        payload: input.payload,
      });
    },
    async createApprovalRecord(input: {
      id: string;
      action: string;
      payload: string;
      state: "pending" | "approved" | "rejected" | "expired";
    }): Promise<void> {
      const now = new Date().toISOString();
      await db.insert(approvals).values({
        id: input.id,
        createdAt: now,
        updatedAt: now,
        state: input.state,
        action: input.action,
        payload: input.payload,
      });
    },
    async listPendingApprovals(): Promise<PendingApprovalRecord[]> {
      return db
        .select({ id: approvals.id, action: approvals.action, payload: approvals.payload })
        .from(approvals)
        .where(eq(approvals.state, "pending"))
        .orderBy(desc(approvals.createdAt))
        .limit(5);
    },
    async updateApprovalState(input: {
      id: string;
      state: "approved" | "rejected" | "expired";
    }): Promise<void> {
      await db
        .update(approvals)
        .set({ state: input.state, updatedAt: new Date().toISOString() })
        .where(eq(approvals.id, input.id));
    },
    async listApprovalsByAction(input: { action: string; limit: number }): Promise<ApprovalRecord[]> {
      return db
        .select({
          id: approvals.id,
          action: approvals.action,
          payload: approvals.payload,
          state: approvals.state,
          createdAt: approvals.createdAt,
          updatedAt: approvals.updatedAt,
        })
        .from(approvals)
        .where(eq(approvals.action, input.action))
        .orderBy(desc(approvals.createdAt))
        .limit(input.limit);
    },
  };
}
