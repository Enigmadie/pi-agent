# Homelab Context

Fill this file locally in `memory/pi5-context.md`. Do not commit private values.

Optional synced notes directory visible from the machine running the agent:
`/home/pi-agent/notes/obsidian-vault`

Project notes inside that synced directory:
`/home/pi-agent/notes/obsidian-vault/Projects/Homelab`

If notes are not synced to the server, leave Obsidian-specific tools unused and keep essential context in `memory/`.

Local infra repository:
`/path/to/local/infra-repo`

Infra repository on the server:
`/home/user/infra`

Server host:
`192.168.1.10`

SSH:
`ssh user@server`

Known local hostnames:
- `service.home`
- `grafana.home`
- `prometheus.home`

Current architecture:
- Docker runtime on the server.
- Reverse proxy routes services by Host and PathPrefix labels.
- Observability stack exposes metrics and dashboards.

Important safety notes:
- Document disks, partitions, and destructive actions here.
- Destructive storage operations must require explicit confirmation.
