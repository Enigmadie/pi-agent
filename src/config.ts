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
  PI_HOST: z.string().default("127.0.0.1"),
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

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment config:\n${details}`);
  }

  return parsed.data;
}
