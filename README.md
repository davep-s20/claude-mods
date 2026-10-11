# claude-mods

Mods for Claude Code / the Claude desktop app, built on Claude Code's function-hooks plugin API (early access — the API can change between releases).

This repo is also a plugin **marketplace** (`.claude-plugin/marketplace.json`), so each mod under `mods/` can be installed by name.

## Mods

| Mod | What it does |
| --- | --- |
| [`agent-parade`](mods/agent-parade) | A side panel of animated avatars for the main agent and every subagent: what each is doing right now, its tokens and tools, and its report when it finishes. |

### agent-parade

- Opens automatically the first time a subagent is spawned, or on demand with `/parade`.
- **The main agent sits at the top** in a highlighted card with a crowned coral avatar: what you last asked, what it's doing right now, its turn count and session token and tool totals, and its last reply. Between turns it snoozes with "waiting for you". **Subagents are listed underneath.**
- Each agent gets its own little creature (colour, body shape and hat come from its id). While it works it bobs, blinks and **holds a prop for what it's doing**: a thought bubble while the model thinks, a hammer for shell commands, a pencil for edits, a book for reads, a magnifier for searches, a globe for web calls, a clipboard for to-dos, a wrench for MCP and other tools, and little helpers when it spawns agents of its own. It snoozes while waiting, throws a party when it finishes, and goes grey with a ✗ if it fails.
- Cards are compact by default (avatar, name, type and model, status, current action) so every agent fits in one view. **Details** expands the rest: **token usage** (in, out, cached, current context size), the number of model calls and tool calls, a **per-tool breakdown** (`Read ×4`, `Bash ×2`, …) the last few things it did, and its full report once it finishes.
- The header sums tokens and tool calls across all agents.
- When a new subagent starts, finished subagents are cleared away automatically, so the panel shows the current batch. **Clear finished** does the same by hand.
- Avatars are plain animated SVG images (not sandboxed frames, which blank whenever the panel redraws), so they stay smooth while agents change state.
- In a terminal session (which can't draw SVG) the avatars fall back to text faces like `(•ᴗ•)` and `(^‿^)`.

## Install it in the desktop app

The desktop app's Code tab doesn't accept `/plugin` commands, so install from a terminal once. Plugins installed at **user** scope load in desktop sessions too.

1. Add this folder as a marketplace (one-time):

   ```bash
   claude plugin marketplace add ~/Projects/claude-mods
   ```

2. Install the mod at user scope:

   ```bash
   claude plugin install agent-parade@claude-mods --scope user
   ```

3. Start a new session in the desktop app (or run `/reload-plugins` in an existing one). Type `/parade`, or just ask Claude to do something with subagents.

Because the marketplace is a local folder, the installed plugin is read **straight from this repo**: after editing a mod, run `/reload-plugins` in a session to pick up the change — no reinstall or version bump needed.

### Alternative: load without installing

Add the mod folder to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`; sessions the desktop app starts will load it from disk:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/Projects/claude-mods/mods/agent-parade",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
  }
}
```

`CLAUDE_CODE_PLUGIN_DIR_WATCH=1` makes long-lived desktop sessions hot-reload on save.

## Developing

```bash
claude plugin validate mods/agent-parade
```

```bash
claude plugin test mods/agent-parade
```

```bash
tsc -p mods/agent-parade
```

`tsc` works once the engine has loaded the mod at least once (it lays the API types into `.claude-plugin/types/` and a `tsconfig.json` beside them; both are git-ignored).

Layout of a mod:

```
mods/<name>/
  .claude-plugin/plugin.json   manifest
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           the hooks module (export const register: Register)
  types/index.d.ts             $.state contract
  tests/*.test.ts              run by `claude plugin test`
```
