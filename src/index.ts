import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { createDatabaseClient } from "./db/client.js";
import { handleAgentInput } from "./agent/handle-input.js";
import { TelegramInputAdapter } from "./inputs/telegram.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await mkdir(dirname(config.AGENT_DB_PATH), { recursive: true });

  const db = createDatabaseClient(config);
  await db.initialize();

  const telegram = new TelegramInputAdapter(config);
  await telegram.start((input) => handleAgentInput(config, db, input));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
