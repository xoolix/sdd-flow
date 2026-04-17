#!/usr/bin/env bash
set -euo pipefail

# SDD — Spec Driven Development installer
# Usage: curl -fsSL https://raw.githubusercontent.com/wellbin/sdd-flow/main/install.sh | bash

SDD_DIR="$HOME/.sdd"
REPO_URL="https://github.com/wellbin/sdd-flow.git"

# ─── helpers ──────────────────────────────────────────────────────

log()  { printf "\033[0;34m▸\033[0m %s\n" "$*"; }
ok()   { printf "\033[0;32m✔\033[0m %s\n" "$*"; }
warn() { printf "\033[0;33m⚠\033[0m %s\n" "$*"; }
err()  { printf "\033[0;31m✖\033[0m %s\n" "$*" >&2; }

# ─── check prerequisites ─────────────────────────────────────────

if ! command -v git &>/dev/null; then
  err "git is required but not installed."
  exit 1
fi

# ─── install or update SDD ───────────────────────────────────────

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   SDD — Spec Driven Development CLI   ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

if [ -d "$SDD_DIR" ]; then
  log "SDD already installed at $SDD_DIR — updating..."
  git -C "$SDD_DIR" pull --ff-only
  ok "Updated to latest version"
else
  log "Cloning SDD to $SDD_DIR..."
  git clone "$REPO_URL" "$SDD_DIR"
  ok "Cloned successfully"
fi

# ─── add to PATH ─────────────────────────────────────────────────

SHELL_NAME="$(basename "$SHELL")"
SHELL_RC=""

case "$SHELL_NAME" in
  zsh)  SHELL_RC="$HOME/.zshrc" ;;
  bash)
    if [ -f "$HOME/.bash_profile" ]; then
      SHELL_RC="$HOME/.bash_profile"
    else
      SHELL_RC="$HOME/.bashrc"
    fi
    ;;
  *)    SHELL_RC="$HOME/.profile" ;;
esac

PATH_LINE='export PATH="$HOME/.sdd/bin:$PATH"'

if [ -f "$SHELL_RC" ] && grep -qF '.sdd/bin' "$SHELL_RC" 2>/dev/null; then
  ok "PATH already configured in $SHELL_RC"
else
  echo "" >> "$SHELL_RC"
  echo "# SDD — Spec Driven Development" >> "$SHELL_RC"
  echo "$PATH_LINE" >> "$SHELL_RC"
  ok "Added to PATH in $SHELL_RC"
fi

# ─── install global skills ───────────────────────────────────────

log "Installing core SDD skills to ~/.claude/skills/..."
export PATH="$SDD_DIR/bin:$PATH"
sdd init --global

# ─── check Engram ────────────────────────────────────────────────

echo ""
if command -v engram &>/dev/null; then
  ok "Engram detected: $(engram version 2>/dev/null || echo 'installed')"
else
  echo ""
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  Engram (persistent memory) is not installed.       │"
  echo "  │                                                     │"
  echo "  │  SDD works without it, but with Engram your AI      │"
  echo "  │  agent remembers decisions, gotchas, and context    │"
  echo "  │  across sessions.                                   │"
  echo "  │                                                     │"
  echo "  │  To install:                                        │"
  echo "  │                                                     │"
  echo "  │  macOS (Homebrew):                                  │"
  echo "  │    brew install gentleman-programming/tap/engram    │"
  echo "  │                                                     │"
  echo "  │  Linux / manual:                                    │"
  echo "  │    https://github.com/Gentleman-Programming/engram  │"
  echo "  │                                                     │"
  echo "  │  After installing:                                  │"
  echo "  │    engram setup claude-code                         │"
  echo "  │                                                     │"
  echo "  └─────────────────────────────────────────────────────┘"
  echo ""
fi

# ─── done ─────────────────────────────────────────────────────────

echo ""
ok "SDD installed!"
echo ""
log "Next steps:"
echo "  1. Restart your terminal (or run: source $SHELL_RC)"
echo "  2. Go to your project: cd your-project/"
echo "  3. Run: sdd init"
echo "  4. Open Claude Code and run: /init-project"
echo ""
log "To update later: cd ~/.sdd && git pull"
echo ""
