# Assistant Context

This repository is `pi-agent`, a personal Telegram-first assistant for the user's Raspberry Pi 5 homelab.

Persistent context should live in local ignored files, not in Git:

- real local memory directory: `memory/`;
- public-safe examples: `memory.example/`;
- read `memory/pi5-context.md` when it exists for machine-specific paths and hostnames;
- Obsidian paths must be visible from the machine running the agent. On a Pi, use a synced notes directory or rely on `memory/` only.

Engineering constraints:

- Keep Telegram as an input adapter, not the core boundary.
- Do not add an arbitrary shell execution tool.
- Prefer explicit allowlisted tools with typed schemas.
- Read-only tools can run directly.
- Write/deploy/destructive actions must require confirmation.
- Record important actions in SQLite audit log and/or markdown memory.
- Do not commit private memory, tokens, chat history, IP addresses, hostnames, or usernames.
