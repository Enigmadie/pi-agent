import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { runAgent } from "../llm/client.js";
import { createToolRegistry } from "../tools/registry.js";
import { createIotApprovalGrant, IOT_APPROVAL_GRANT_MS, turnOffIotDevice, turnOnIotDevice } from "../tools/iot.js";
import { appendApprovedMemory, MEMORY_APPEND_ACTION } from "../tools/memory.js";
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

  const approvalAnswer = await handlePendingApproval(config, db, input);
  if (approvalAnswer) {
    await db.insertMessage({
      source: input.source,
      userId: input.userId,
      chatId: input.chatId,
      role: "assistant",
      content: approvalAnswer,
    });

    return approvalAnswer;
  }

  const tools = createToolRegistry(config, db);
  const staticContext = await loadStaticContext(config);
  const recentMessages = await db.listRecentMessages({
    source: input.source,
    userId: input.userId,
    chatId: input.chatId,
    limit: 10,
  });
  const answer = await runAgent(config, input, staticContext, recentMessages, tools);

  await db.insertMessage({
    source: input.source,
    userId: input.userId,
    chatId: input.chatId,
    role: "assistant",
    content: answer,
  });

  return answer;
}

async function handlePendingApproval(
  config: AppConfig,
  db: DatabaseClient,
  input: AgentInput,
): Promise<string | undefined> {
  const decision = parseApprovalDecision(input.text);
  if (!decision) {
    return undefined;
  }

  const pending = (await db.listPendingApprovals()).find((approval) =>
    approval.action === "iot.turn_off_device" ||
    approval.action === "iot.turn_on_device" ||
    approval.action === MEMORY_APPEND_ACTION,
  );
  if (!pending) {
    return undefined;
  }

  if (pending.action === MEMORY_APPEND_ACTION) {
    return handleMemoryApproval(config, db, pending, decision);
  }

  const payload = JSON.parse(pending.payload) as { deviceId: string };
  const commandName = pending.action === "iot.turn_on_device" ? "включаю" : "выключаю";
  const commandDone = pending.action === "iot.turn_on_device" ? "включение" : "выключение";

  if (decision === "reject") {
    await db.updateApprovalState({ id: pending.id, state: "rejected" });
    return `Ок, не ${commandName} ${payload.deviceId}.`;
  }

  const result = pending.action === "iot.turn_on_device"
    ? await turnOnIotDevice(config, payload.deviceId)
    : await turnOffIotDevice(config, payload.deviceId);
  await db.updateApprovalState({ id: pending.id, state: result.statusCode >= 200 && result.statusCode < 300 ? "approved" : "expired" });

  if (result.statusCode >= 200 && result.statusCode < 300) {
    await createIotApprovalGrant(db);
    return `Команда на ${commandDone} ${payload.deviceId} отправлена. iot-hub ответил HTTP ${result.statusCode}. Следующие IoT on/off команды можно выполнить без повторного подтверждения в течение ${Math.round(IOT_APPROVAL_GRANT_MS / 1000)} секунд.`;
  }

  return `Не смог выполнить ${commandDone} ${payload.deviceId}. iot-hub ответил HTTP ${result.statusCode}: ${result.body}`;
}

async function handleMemoryApproval(
  config: AppConfig,
  db: DatabaseClient,
  pending: { id: string; payload: string },
  decision: "approve" | "reject",
): Promise<string> {
  const payload = JSON.parse(pending.payload) as { path: string; content: string; reason: string };

  if (decision === "reject") {
    await db.updateApprovalState({ id: pending.id, state: "rejected" });
    return `Ок, не записываю memory/${payload.path}.`;
  }

  await appendApprovedMemory(config, payload);
  await db.updateApprovalState({ id: pending.id, state: "approved" });
  return `Записал в memory/${payload.path}.`;
}

function parseApprovalDecision(text: string): "approve" | "reject" | undefined {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
  if (["да", "ага", "ок", "окей", "yes", "y", "confirm", "подтверждаю", "подтверди"].includes(normalized)) {
    return "approve";
  }

  if (["нет", "не", "no", "n", "cancel", "отмена", "отмени"].includes(normalized)) {
    return "reject";
  }

  return undefined;
}
