#!/usr/bin/env bash
set -euo pipefail

repo_dir=/home/godo/home-agent

git -C "$repo_dir" fetch --prune origin
git -C "$repo_dir" checkout main
git -C "$repo_dir" pull --ff-only origin main

cd "$repo_dir"
npm ci
npm run build

sudo systemctl restart home-agent.service
sleep 3
sudo systemctl is-active home-agent.service
