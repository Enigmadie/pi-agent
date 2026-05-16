import { randomUUID } from "node:crypto";
import http from "node:http";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { createLoggedTool, type RegisteredTool } from "./registry.js";

export const IOT_APPROVAL_GRANT_ACTION = "iot.command_grant";
export const IOT_APPROVAL_GRANT_MS = 60_000;

const deviceSchema = z.object({
  deviceId: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_.:-]+$/)
    .describe("iot-hub device id, for example plug_plant"),
});

type IotHubResponse = {
  statusCode: number;
  body: string;
};

export function createIotTools(
  config: AppConfig,
  db: DatabaseClient,
): Record<string, RegisteredTool> {
  return {
    iot_list_devices: createLoggedTool({
      name: "iot_list_devices",
      description: "Read iot-hub device list through Traefik.",
      inputSchema: z.object({}),
      risk: "read",
      db,
      execute: async () => requestIotHub(config, "GET", "/api/devices"),
    }),
    iot_request_turn_off_device: createLoggedTool({
      name: "iot_request_turn_off_device",
      description:
        "Turn an IoT device off if a recent IoT approval grant is active; otherwise create a pending approval.",
      inputSchema: deviceSchema,
      risk: "write",
      db,
      execute: async ({ deviceId }) => {
        if (await hasActiveIotApprovalGrant(db)) {
          const result = await turnOffIotDevice(config, deviceId);
          return {
            deviceId,
            executed: true,
            statusCode: result.statusCode,
            body: result.body,
            message: `Команда на выключение ${deviceId} отправлена без повторного подтверждения: действует недавнее разрешение.`,
          };
        }

        const id = randomUUID();
        await db.createApproval({
          id,
          action: "iot.turn_off_device",
          payload: JSON.stringify({ deviceId }),
        });

        return {
          approvalId: id,
          deviceId,
          executed: false,
          message: `Нужно подтверждение. Ответь "да" или "подтверждаю", чтобы выключить ${deviceId}.`,
        };
      },
    }),
    iot_request_turn_on_device: createLoggedTool({
      name: "iot_request_turn_on_device",
      description:
        "Turn an IoT device on if a recent IoT approval grant is active; otherwise create a pending approval.",
      inputSchema: deviceSchema,
      risk: "write",
      db,
      execute: async ({ deviceId }) => {
        if (await hasActiveIotApprovalGrant(db)) {
          const result = await turnOnIotDevice(config, deviceId);
          return {
            deviceId,
            executed: true,
            statusCode: result.statusCode,
            body: result.body,
            message: `Команда на включение ${deviceId} отправлена без повторного подтверждения: действует недавнее разрешение.`,
          };
        }

        const id = randomUUID();
        await db.createApproval({
          id,
          action: "iot.turn_on_device",
          payload: JSON.stringify({ deviceId }),
        });

        return {
          approvalId: id,
          deviceId,
          executed: false,
          message: `Нужно подтверждение. Ответь "да" или "подтверждаю", чтобы включить ${deviceId}.`,
        };
      },
    }),
  };
}

export async function turnOffIotDevice(config: AppConfig, deviceId: string): Promise<IotHubResponse> {
  return requestIotHub(config, "POST", `/api/devices/${encodeURIComponent(deviceId)}/turn-off`);
}

export async function turnOnIotDevice(config: AppConfig, deviceId: string): Promise<IotHubResponse> {
  return requestIotHub(config, "POST", `/api/devices/${encodeURIComponent(deviceId)}/turn-on`);
}

export async function createIotApprovalGrant(db: DatabaseClient): Promise<void> {
  await db.createApprovalRecord({
    id: randomUUID(),
    action: IOT_APPROVAL_GRANT_ACTION,
    state: "approved",
    payload: JSON.stringify({ expiresAt: new Date(Date.now() + IOT_APPROVAL_GRANT_MS).toISOString() }),
  });
}

async function hasActiveIotApprovalGrant(db: DatabaseClient): Promise<boolean> {
  const grants = await db.listApprovalsByAction({ action: IOT_APPROVAL_GRANT_ACTION, limit: 5 });
  const now = Date.now();

  return grants.some((grant) => {
    if (grant.state !== "approved") {
      return false;
    }

    try {
      const payload = JSON.parse(grant.payload) as { expiresAt?: string };
      return payload.expiresAt ? Date.parse(payload.expiresAt) > now : false;
    } catch {
      return false;
    }
  });
}

async function requestIotHub(config: AppConfig, method: "GET" | "POST", path: string): Promise<IotHubResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: config.PI_HOST,
        port: 80,
        path,
        method,
        headers: {
          Host: "iot.home",
          Accept: "application/json",
        },
        timeout: 10_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("iot-hub request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}
