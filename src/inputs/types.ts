export type AgentInputSource = "telegram" | "cli" | "cron" | "github-webhook";

export type AgentAttachment = {
  kind: "voice" | "audio" | "image" | "document";
  fileId?: string;
  path?: string;
  mimeType?: string;
};

export type AgentInput = {
  source: AgentInputSource;
  text: string;
  userId?: string;
  chatId?: string;
  attachments?: AgentAttachment[];
  metadata?: Record<string, unknown>;
};

export type InputHandler = (input: AgentInput) => Promise<string>;

export interface InputAdapter {
  name: string;
  start(handler: InputHandler): Promise<void>;
}
