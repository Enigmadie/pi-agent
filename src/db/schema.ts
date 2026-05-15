import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  source: text("source").notNull(),
  userId: text("user_id"),
  chatId: text("chat_id"),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
});

export const toolCalls = sqliteTable("tool_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  toolName: text("tool_name").notNull(),
  risk: text("risk", { enum: ["read", "write", "dangerous"] }).notNull(),
  input: text("input").notNull(),
  output: text("output").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  durationMs: integer("duration_ms").notNull(),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  state: text("state", { enum: ["pending", "approved", "rejected", "expired"] }).notNull(),
  action: text("action").notNull(),
  payload: text("payload").notNull(),
});
