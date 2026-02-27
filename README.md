# ccrl - Claude Code Remote Launcher

A Slack bot that launches [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) remote sessions from Slack. Pick a repository from the App Home tab or run `/ccrl` in any channel, and get a Remote Control URL back — no terminal needed.

## How It Works

### From App Home (recommended on mobile)

1. Open the CCRL app and go to the **Home** tab
2. Tap **🚀 Launch Claude Code**
3. Select a repository from the configured list
4. Optionally check "Create new worktree" to work in an isolated git worktree
5. Click **Launch** — the bot sends the Remote Control URL to your DM
6. Open the URL in your browser to connect to the Claude Code session

### From a Slack channel

1. Type `/ccrl` in a Slack channel
2. Select a repository from the configured list
3. Optionally check "Create new worktree" to work in an isolated git worktree
4. Click **Launch** — the bot posts the Remote Control URL to the thread
5. Open the URL in your browser to connect to the Claude Code session

## Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed and authenticated (`claude` must be in your PATH)
- A Slack workspace where you can install apps
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [direnv](https://direnv.net/) for environment variable management

## Slack App Setup

Create a new Slack app at [api.slack.com/apps](https://api.slack.com/apps):

1. **Create App** → "From scratch" → give it a name and pick your workspace

2. **Enable Socket Mode** under "Settings → Socket Mode" → generate an App-Level Token with `connections:write` scope → copy it (this is your `SLACK_APP_TOKEN`)

3. **Add a Slash Command** under "Features → Slash Commands":
   - Command: `/ccrl`
   - Short description: `Launch Claude Code remotely`

4. **Enable App Home** under "Features → App Home":
   - Turn on **Home Tab**

5. **Subscribe to Bot Events** under "Features → Event Subscriptions":
   - Enable Events and add `app_home_opened`

6. **Add Bot Token Scopes** under "OAuth & Permissions → Scopes → Bot Token Scopes":
   - `chat:write`
   - `commands`
   - `im:write` (for sending DMs when launched from App Home)

7. **Install App** to your workspace → copy the Bot User OAuth Token (this is your `SLACK_BOT_TOKEN`)

## Installation

```bash
git clone https://github.com/yuya-takeyama/ccrl.git
cd ccrl
pnpm install
pnpm build
```

## Configuration

### Environment Variables

Copy `.envrc.example` to `.envrc` and fill in your tokens:

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
```

Then allow direnv to load it:

```bash
direnv allow
```

### Directory Configuration

Create `ccrl.config.json` in the project root (see `ccrl.config.example.json`):

```json
{
  "directories": [
    { "label": "my-app", "path": "/path/to/my-app" },
    { "label": "another-project", "path": "/path/to/another-project" }
  ]
}
```

Alternatively, set the `CCRL_DIRS` environment variable with the same JSON array:

```bash
CCRL_DIRS='[{"label":"my-app","path":"/path/to/my-app"}]'
```

`ccrl.config.json` takes precedence over `CCRL_DIRS`.

## Running

```bash
# Development (with hot reload)
pnpm dev

# Production (compiled)
pnpm start
```

The bot runs persistently using Slack's Socket Mode — no public endpoint or ngrok required.

## Git Worktree Support

When you check "Create new worktree" in the modal, ccrl creates a new git worktree under `.cc-slack-worktrees/` in the repository with a timestamped branch name (`claude-session-YYYY-MM-DDTHH-MM-SS`). This lets you run multiple isolated Claude Code sessions on the same repo simultaneously.

---

## For Developers

### Tech Stack

- **Runtime**: Node.js 24+
- **Language**: TypeScript (strict)
- **Slack framework**: [@slack/bolt](https://slack.dev/bolt-js/)
- **Test runner**: [Vitest](https://vitest.dev/)
- **Linter/Formatter**: [Biome](https://biomejs.dev/)
- **Package manager**: pnpm

### Project Structure

```
src/
  index.ts      # Slack app entry point (command, event & view handlers)
  config.ts     # Configuration loader
  launcher.ts   # Git worktree creation & claude remote-control spawner
  modal.ts      # Slack modal UI builder
  home.ts       # App Home tab view builder
  config.test.ts
```

### Scripts

```bash
pnpm dev        # Run with tsx (no build step)
pnpm build      # Compile TypeScript → dist/
pnpm start      # Run compiled output
pnpm test       # Run unit tests
pnpm lint       # Biome lint check
pnpm typecheck  # Type check without emitting
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `pnpm lint && pnpm typecheck && pnpm test`
5. Open a pull request

## License

MIT — see [LICENSE](LICENSE)
