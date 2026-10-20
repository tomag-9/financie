#!/bin/sh
set -eu

mkdir -p /auth/claude-home/.claude /auth/codex-home/.codex /root

ln -sfn /auth/claude-home/.claude /root/.claude
ln -sfn /auth/claude-home/.claude.json /root/.claude.json
ln -sfn /auth/codex-home/.codex /root/.codex

exec "$@"
