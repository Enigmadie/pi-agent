# Allowed Actions

MVP default is read-only.

Allowed without confirmation:
- read local markdown notes;
- search local markdown notes;
- read GitHub Actions/PR/issues;
- read Docker status;
- read Compose status;
- read selected systemd service active state;
- perform HTTP checks for known local routes.

Require explicit confirmation before implementation:
- deploy services;
- restart runners;
- restart Docker containers;
- create or update GitHub issues/PRs;
- write notes or journal entries;
- edit files;
- run any command not represented by an allowlisted tool.

Never do automatically:
- format disks;
- delete data;
- expose services to the public internet;
- change firewall/router/DNS settings;
- merge PRs;
- push forcefully;
- run arbitrary shell commands from model output.
