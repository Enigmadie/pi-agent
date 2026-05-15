import { Bot } from "grammy";
import type { AppConfig } from "../config.js";
import type { InputAdapter, InputHandler } from "./types.js";

export class TelegramInputAdapter implements InputAdapter {
  public readonly name = "telegram";
  private readonly bot: Bot;

  public constructor(private readonly config: AppConfig) {
    this.bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  }

  public async start(handler: InputHandler): Promise<void> {
    this.bot.catch((error) => {
      console.error("Telegram bot error", formatError(error.error));
    });

    this.bot.on("message:text", async (ctx) => {
      if (!this.isAllowedUser(ctx.from?.id)) {
        await ctx.reply("Access denied.");
        return;
      }

      try {
        const answer = await handler({
          source: "telegram",
          text: ctx.message.text,
          userId: String(ctx.from.id),
          chatId: String(ctx.chat.id),
          metadata: {
            messageId: ctx.message.message_id,
            username: ctx.from.username,
          },
        });

        await ctx.reply(answer);
      } catch (error) {
        console.error("Failed to handle Telegram text message", formatError(error));
        await ctx.reply("Не смог обработать запрос. Проверь логи pi-agent и доступ к LLM/API.");
      }
    });

    this.bot.on("message:voice", async (ctx) => {
      if (!this.isAllowedUser(ctx.from?.id)) {
        await ctx.reply("Access denied.");
        return;
      }

      try {
        const answer = await handler({
          source: "telegram",
          text: "[voice message received; transcription is not enabled yet]",
          userId: String(ctx.from.id),
          chatId: String(ctx.chat.id),
          attachments: [{ kind: "voice", fileId: ctx.message.voice.file_id }],
          metadata: {
            messageId: ctx.message.message_id,
            duration: ctx.message.voice.duration,
          },
        });

        await ctx.reply(answer);
      } catch (error) {
        console.error("Failed to handle Telegram voice message", formatError(error));
        await ctx.reply("Не смог обработать voice message. Проверь логи pi-agent и доступ к LLM/API.");
      }
    });

    await this.bot.start({
      onStart: (botInfo) => {
        console.log(`Telegram bot started as @${botInfo.username}`);
      },
    });
  }

  private isAllowedUser(userId: number | undefined): boolean {
    if (!userId) {
      return false;
    }

    const allowed = this.config.TELEGRAM_ALLOWED_USER_IDS;
    return allowed.length === 0 || allowed.includes(String(userId));
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
  }

  return String(error);
}
