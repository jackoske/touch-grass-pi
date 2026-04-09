# touch-grass 🌿

A [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) extension that tracks your session time and reminds you to take breaks — because vibe coding with AI agents is genuinely addictive, and you **will** forget to eat.

## Why this exists

Agentic coding tools are incredible — but they make it dangerously easy to lose track of time. You look up and it's been 4 hours. Your coffee is cold. You haven't moved. The sun has set.

This extension sits in your status bar watching the clock, and periodically interrupts you with a reminder that the outside world still exists. Touch some grass. Drink some water. Eat a meal. The diff will still be there.

## What it does

- **Animated status bar timer** — a live progress bar fills up as your next break approaches, shifting from green to yellow to red. You can always see how long you've been in the zone.
- **Automatic break reminders** — every 45 minutes (configurable), a toast notification fires with a randomised nudge message and native OS desktop notification support.
- **Animated overlay** — `/grass-now` opens a full fluid-smoke ASCII animation overlay with a countdown timer. Hard to ignore.

## Install

1. Copy `touch-grass.ts` to your pi extensions directory:
   ```bash
   cp touch-grass.ts ~/.pi/agent/extensions/
   ```

2. Add it to your `settings.json` (see `settings.json.example`):
   ```json
   {
     "extensions": ["~/.pi/agent/extensions/touch-grass.ts"]
   }
   ```

3. Start a pi session — the timer will appear in your status bar immediately.

## Commands

| Command | Description |
|---|---|
| `/grass` | Show session time, next break countdown, and how many reminders you've dismissed |
| `/grass-now` | Open the animated break reminder overlay right now |
| `/grass-set N` | Change the break interval to N minutes (default: 45) |

## Configuration

The defaults are set at the top of `touch-grass.ts`:

```ts
const DEFAULT_BREAK_MINS = 45; // how often to remind you
const DISMISS_SECS = 15;       // how long the overlay stays before auto-dismissing
```

Change them to suit your attention span (or lack thereof).

## OS notifications

Break reminders also fire a native desktop notification via OSC 777, supported by Ghostty, iTerm2, WezTerm, and other modern terminals. No setup needed.

---

*Yes, this was built during a long vibe coding session. The irony is noted.*
