# pi-agent

Small personal assistant for a Raspberry Pi 5 homelab.

The agent is designed around adapters and allowlisted tools:

- inputs: Telegram now, voice/CLI/cron/webhooks later;
- LLM: Vercel AI SDK with OpenAI provider;
- memory: local markdown files plus optional synced notes context;
- audit: SQLite;
- tools: explicit read-only tools first, write actions later behind confirmations.

## Architecture

```text
src/
├─ inputs/      # Telegram, future voice/CLI/cron adapters
├─ outputs/     # output helpers
├─ agent/       # input handling and context assembly
├─ llm/         # LLM client
├─ tools/       # GitHub, infra, Obsidian tools
├─ policy/      # approvals and permission rules
├─ memory/      # markdown memory helpers
└─ db/          # SQLite schema and client
```

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env`:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USER_IDS=123456789
OPENAI_API_KEY=...
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Start compiled service:

```bash
npm start
```

## Current Tools

Read-only tools:

- `github_actions_status(repo)`
- `github_prs(repo)`
- `github_issues(repo)`
- `infra_docker_ps()`
- `infra_compose_ps(stack)`
- `infra_systemd_status(service)`
- `infra_http_check(url, host?)`
- `obsidian_search(query, limit)`
- `obsidian_read_note(path)`

No arbitrary shell tool exists. Commands are fixed by code.

## Memory

Stable private context lives in `memory/`. This directory is ignored by Git.

Commit only public-safe examples in `memory.example/`. Keep machine-specific values out of Git:

- private paths;
- IP addresses and hostnames;
- usernames;
- tokens;
- chat history;
- audit databases;
- personal Obsidian notes.

Initial setup:

```bash
cp -R memory.example memory
```

Then edit `memory/*.md` locally with real paths and homelab context.

`memory/` is the agent's own local memory and should exist on the machine running the agent.

Obsidian is optional. If the agent runs on a Pi, `OBSIDIAN_VAULT_PATH` must point to notes available on the Pi, for example:

```text
/home/pi-agent/notes/obsidian-vault
```

Possible sync options:

- Git repo with a private notes subset;
- Syncthing;
- rsync from the Mac;
- no Obsidian sync at first, only `memory/`.

Do not set `OBSIDIAN_VAULT_PATH` to a Mac-local path unless the agent runs on that Mac.

## Pi Deployment

Copy the repo to the Pi, install dependencies, create `.env`, build, then install a systemd unit based on `systemd/pi-agent.service`.

The provided systemd unit is an example. Adjust `User`, `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` for the target machine.

The MVP assumes the agent runs on the same machine where Docker/systemd checks should run. If running on Mac, infra tools check the Mac, except Compose cwd points to `PI_INFRA_PATH` and will likely not exist.

## Voice Later

Telegram voice messages are accepted but not transcribed yet. The intended pipeline is:

```text
Telegram voice -> download .ogg/.opus -> transcribe -> AgentInput.text -> normal agent flow
```

Possible transcribers:

- OpenAI transcription API for MVP;
- `whisper.cpp` for local Pi transcription later;
- Vosk for lightweight offline transcription with lower quality.
