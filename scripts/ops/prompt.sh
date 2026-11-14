#!/usr/bin/env bash
# Film helper: prints a command as a gold "$ " prompt line (the terminal palette), then runs it. No host/user in the prompt.
#   scripts/ops/prompt.sh <command...>
printf '\033[1;38;2;255;201;74m$ %s\033[0m\n' "$*"
exec "$@"
