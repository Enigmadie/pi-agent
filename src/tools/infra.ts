import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { createLoggedTool, type RegisteredTool } from "./registry.js";
import { runReadOnlyCommand } from "./shell.js";

const stackSchema = z.object({
  stack: z.enum(["core", "iot", "observability"]).describe("Compose stack name"),
});

const systemdSchema = z.object({
  service: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_.@-]+$/)
    .describe("Allowed systemd service name configured in SYSTEMD_ALLOWED_SERVICES"),
});

const httpCheckSchema = z.object({
  url: z.string().url(),
  host: z.string().optional().describe("Optional Host header for Traefik route checks"),
});

function composeFile(stack: "core" | "iot" | "observability"): string[] {
  if (stack === "core") {
    return [];
  }

  if (stack === "iot") {
    return ["-f", "compose.iot.yml"];
  }

  return ["-f", "compose.observability.yml"];
}

export function createInfraTools(
  config: AppConfig,
  db: DatabaseClient,
): Record<string, RegisteredTool> {
  return {
    infra_docker_ps: createLoggedTool({
      name: "infra_docker_ps",
      description: "Read running Docker containers on the current machine.",
      inputSchema: z.object({}),
      risk: "read",
      db,
      execute: async () => runReadOnlyCommand("docker", ["ps", "--format", "json"]),
    }),
    infra_compose_ps: createLoggedTool({
      name: "infra_compose_ps",
      description: "Read Docker Compose service status for an allowed stack.",
      inputSchema: stackSchema,
      risk: "read",
      db,
      execute: async ({ stack }) =>
        runReadOnlyCommand("docker", ["compose", ...composeFile(stack), "ps", "--format", "json"], {
          cwd: `${config.PI_INFRA_PATH}/docker`,
        }),
    }),
    infra_systemd_status: createLoggedTool({
      name: "infra_systemd_status",
      description: "Read active state for an allowed systemd service.",
      inputSchema: systemdSchema,
      risk: "read",
      db,
      execute: async ({ service }) => {
        if (!config.SYSTEMD_ALLOWED_SERVICES.includes(service)) {
          throw new Error(`Service is not allowlisted: ${service}`);
        }

        return runReadOnlyCommand("systemctl", ["is-active", service], { timeoutMs: 10_000 });
      },
    }),
    infra_http_check: createLoggedTool({
      name: "infra_http_check",
      description: "Perform a read-only HTTP HEAD/GET check with optional Host header.",
      inputSchema: httpCheckSchema,
      risk: "read",
      db,
      execute: async ({ url, host }) => {
        const args = ["-i", "--max-time", "10"];
        if (host) {
          args.push("-H", `Host: ${host}`);
        }
        args.push(url);
        return runReadOnlyCommand("curl", args, { timeoutMs: 15_000 });
      },
    }),
  };
}
