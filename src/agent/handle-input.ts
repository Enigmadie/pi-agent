import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { runAgent } from "../llm/client.js";
import { createToolRegistry } from "../tools/registry.js";
import { createIotApprovalGrant, IOT_APPROVAL_GRANT_MS, turnOffIotDevice, turnOnIotDevice } from "../tools/iot.js";
import { appendApprovedMemory, MEMORY_APPEND_ACTION, MEMORY_REPLACE_ACTION, replaceApprovedMemory } from "../tools/memory.js";
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

  const helpAnswer = buildHelpAnswer(input.text);
  if (helpAnswer) {
    await db.insertMessage({
      source: input.source,
      userId: input.userId,
      chatId: input.chatId,
      role: "assistant",
      content: helpAnswer,
    });

    return helpAnswer;
  }

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
    approval.action === MEMORY_APPEND_ACTION ||
    approval.action === MEMORY_REPLACE_ACTION,
  );
  if (!pending) {
    return undefined;
  }

  if (pending.action === MEMORY_APPEND_ACTION || pending.action === MEMORY_REPLACE_ACTION) {
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
  const payload = JSON.parse(pending.payload) as {
    path: string;
    content?: string;
    find?: string;
    replaceWith?: string;
    reason: string;
  };

  if (decision === "reject") {
    await db.updateApprovalState({ id: pending.id, state: "rejected" });
    return `Ок, не записываю memory/${payload.path}.`;
  }

  if (payload.find !== undefined && payload.replaceWith !== undefined) {
    await replaceApprovedMemory(config, { path: payload.path, find: payload.find, replaceWith: payload.replaceWith });
    await db.updateApprovalState({ id: pending.id, state: "approved" });
    return `Обновил memory/${payload.path}.`;
  }

  if (payload.content === undefined) {
    await db.updateApprovalState({ id: pending.id, state: "expired" });
    return `Не смог применить memory/${payload.path}: approval payload неполный.`;
  }

  await appendApprovedMemory(config, { path: payload.path, content: payload.content });
  await db.updateApprovalState({ id: pending.id, state: "approved" });
  return `Записал в memory/${payload.path}.`;
}

function buildHelpAnswer(text: string): string | undefined {
  const normalized = text.trim().toLowerCase();
  const compact = normalized.replace(/[?!.]+$/g, "").trim();
  const helpIntents = [
    "что ты умеешь",
    "что умеешь",
    "помощь",
    "help",
    "/help",
    "как тобой пользоваться",
    "какие команды",
    "какие команды тебе задавать",
    "что можно спросить",
  ];

  if (!helpIntents.some((intent) => compact.includes(intent))) {
    return undefined;
  }

  return [
    "Можно писать обычным языком. Полезные форматы:",
    "- `найди в обсидиане AmneziaWG`",
    "- `прочитай Operations/Pi Agent Operations Map.md`",
    "- `покажи открытые PR в Enigmadie/pi-agent`",
    "- `проверь GitHub Actions для Enigmadie/iot-dashboard`",
    "- `покажи устройства IoT`",
    "- `выключи plug_plant` -> я попрошу подтверждение",
    "- `запомни: plug_plant это розетка растения` -> я предложу запись в memory и попрошу подтверждение",
    "- `plug_plant больше не розетка растения, теперь это розетка увлажнителя` -> я должен предложить исправление старой memory-записи",
    "Write/deploy/destructive actions требуют подтверждения. Current facts из интернета без live source не выдумываю.",
  ].join("\n");
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
