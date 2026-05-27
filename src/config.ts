import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ override: true, quiet: true });

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  AGENT_DB_PATH: z.string().default("./data/agent.db"),
  AGENT_MEMORY_DIR: z.string().default("./memory"),
  OBSIDIAN_VAULT_PATH: z.string().default("./memory/obsidian-vault"),
  PI5_NOTES_PATH: z.string().default("./memory/obsidian-vault/Projects/Pi 5 infrastructure"),
  EDGE_HOST: z.string().optional(),
  CORE_HOST: z.string().optional(),
  EDGE_SSH_TARGET: z.string().optional(),
  EDGE_INFRA_PATH: z.string().optional(),
  PI_HOST: z.string().default("127.0.0.1"),
  IOT_HUB_HOST: z.string().optional(),
  PI_SSH_TARGET: z.string().default("pi-user@pi-host"),
  PI_INFRA_PATH: z.string().default("/home/pi-user/infra"),
  SYSTEMD_ALLOWED_SERVICES: z
    .string()
    .default("docker,containerd")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
});

type EnvConfig = z.infer<typeof envSchema>;

export type AppConfig = EnvConfig & {
  EDGE_HOST: string;
  CORE_HOST: string;
  EDGE_SSH_TARGET: string;
  EDGE_INFRA_PATH: string;
  IOT_HUB_HOST: string;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment config:\n${details}`);
  }

  return {
    ...parsed.data,
    EDGE_HOST: parsed.data.EDGE_HOST ?? parsed.data.PI_HOST,
    CORE_HOST: parsed.data.CORE_HOST ?? parsed.data.IOT_HUB_HOST ?? parsed.data.PI_HOST,
    EDGE_SSH_TARGET: parsed.data.EDGE_SSH_TARGET ?? parsed.data.PI_SSH_TARGET,
    EDGE_INFRA_PATH: parsed.data.EDGE_INFRA_PATH ?? parsed.data.PI_INFRA_PATH,
    IOT_HUB_HOST: parsed.data.IOT_HUB_HOST ?? parsed.data.CORE_HOST ?? parsed.data.PI_HOST,
  };
}
