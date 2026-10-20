#!/bin/sh
# Installs boxmaid and merman-cli (pinned, checksum-verified) and the mermaid-ascii mod.
# Usage: curl -fsSL https://raw.githubusercontent.com/BukeLy/claude-mermaid-ascii/main/install.sh | sh
set -eu

BIN="${MERMAID_ASCII_BIN:-$HOME/.local/bin}"
BOXMAID_URL=https://github.com/rickthegreatest/boxmaid/releases/download/v0.1.1
MERMAN_URL=https://github.com/Latias94/merman/releases/download/v0.9.1

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)
    box=boxmaid_0.1.1_darwin_arm64.tar.gz
    box_sha=c2e40f97b07fbd82d8566db45dcd19935ca656f2148708d0a7887070e0a11d13
    mer=merman-cli-aarch64-apple-darwin
    mer_sha=aa42b3c532cc0b7415bdb0f8e2f12d76a597aa12b373dc490c27a725a2984ce6 ;;
  Darwin/x86_64)
    box=boxmaid_0.1.1_darwin_amd64.tar.gz
    box_sha=f038f3aa93af629f346a1d4779d4828cdc6598a8cd95fa35e4831e5364df6a9d
    mer=merman-cli-x86_64-apple-darwin
    mer_sha=2502a7082b8b92cbb7b854abeddf7b25f016bcdbfe8a27ec429ac9f9f7fffd92 ;;
  Linux/x86_64)
    box=boxmaid_0.1.1_linux_amd64.tar.gz
    box_sha=32e1ca3e9e92efe1e66a7df136d7de996fabc5691ba9506e824250760232216e
    mer=merman-cli-x86_64-unknown-linux-gnu
    mer_sha=d74bee4c1123c6c681dcecf4eb0abd64add2fef846faa319c62afb5e09184d87 ;;
  Linux/aarch64 | Linux/arm64)
    box=boxmaid_0.1.1_linux_arm64.tar.gz
    box_sha=91fe677af9e5c82aa7631325cab5ace81847bb2441bb7d38944fb1c75df9eac8
    mer=merman-cli-aarch64-unknown-linux-gnu
    mer_sha=5a22adc366913509b445e1ef0b51e67781b5a2ec422003e9ba951909433b0b78 ;;
  *)
    echo "mermaid-ascii: no prebuilt renderers for $(uname -s)/$(uname -m)" >&2
    exit 1 ;;
esac

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# fetch <url> <sha256> <file>: download into $tmp and refuse a file whose hash differs.
fetch() {
  curl -fsSL "$1" -o "$tmp/$3"
  if command -v sha256sum >/dev/null; then
    actual=$(sha256sum "$tmp/$3" | cut -d' ' -f1)
  else
    actual=$(shasum -a 256 "$tmp/$3" | cut -d' ' -f1)
  fi
  if [ "$actual" != "$2" ]; then
    echo "mermaid-ascii: checksum mismatch for $3" >&2
    exit 1
  fi
}

mkdir -p "$BIN" "$tmp/box" "$tmp/mer"

fetch "$BOXMAID_URL/$box" "$box_sha" "$box"
tar -xzf "$tmp/$box" -C "$tmp/box"
install -m 755 "$tmp/box/boxmaid" "$BIN/boxmaid"

fetch "$MERMAN_URL/$mer.tar.xz" "$mer_sha" "$mer.tar.xz"
tar -xJf "$tmp/$mer.tar.xz" -C "$tmp/mer"
install -m 755 "$tmp/mer/$mer/merman-cli" "$BIN/merman-cli"

echo "Installed boxmaid and merman-cli to $BIN"

# Fails harmlessly when the marketplace was added by an earlier run; install says so if it is missing.
claude plugin marketplace add BukeLy/claude-mermaid-ascii || true
claude plugin install mermaid-ascii@bukely-mods

case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo "Add $BIN to your PATH, then restart Claude Code: the mod runs boxmaid by name." ;;
esac
