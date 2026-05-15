# Check Runners

Document runner service names locally in `memory/runbooks/check-runners.md`.

Read-only checks:

1. Check systemd active state for runner services.
2. Check recent GitHub Actions runs for the relevant repository.
3. If a runner is inactive, report it and ask before restart.
