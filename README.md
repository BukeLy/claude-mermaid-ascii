# mermaid-ascii

A Claude Code mod that draws ```` ```mermaid ```` blocks in Claude's replies as
Unicode box-drawing diagrams in the terminal.

## Quick start

macOS or Linux, in a shell:

```sh
curl -fsSL https://raw.githubusercontent.com/BukeLy/claude-mermaid-ascii/main/install.sh | sh
```

Or paste this to Claude Code:

```
Install the mermaid-ascii mod: read https://raw.githubusercontent.com/BukeLy/claude-mermaid-ascii/main/install.sh, then run `curl -fsSL https://raw.githubusercontent.com/BukeLy/claude-mermaid-ascii/main/install.sh | sh` and tell me what it printed.
```

Then start a new Claude Code session and ask Claude for a Mermaid diagram.

The script installs [boxmaid](https://github.com/rickthegreatest/boxmaid) and
[merman-cli](https://github.com/Latias94/merman) (pinned versions, SHA-256 checked)
to `~/.local/bin`, then installs the mod.

## What it runs

The mod sends each Mermaid block, as standard input, to the local `boxmaid` and, if
boxmaid refuses it, `merman-cli`, and shows their output in place of the block in
the terminal. It makes no network requests. The stored message keeps the Mermaid
source; a block neither tool can draw within the terminal width stays as source.
