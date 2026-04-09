# Contributing to touch-grass 🌿

Thanks for wanting to help! This is a small, single-file extension so contributing is low friction.

## Ideas welcome

Things that would make this better:

- **New break messages** — the `BREAK_MESSAGES` array in `touch-grass.ts` is easy to extend. Funny, wholesome, or motivating — all welcome. Open a PR with a few and I'll merge it.
- **Configurable messages** — let users add their own nudges via `settings.json`
- **Sound support** — a subtle chime on break (terminal bell or OSC sequence)
- **Session stats** — `/grass-stats` showing total session time, number of breaks taken, longest streak
- **Pomodoro mode** — structured work/rest cycles instead of a flat interval
- **Better overlay animation** — the fluid sim is fun but there's plenty of room to improve it

## How to contribute

1. Fork the repo and clone it
2. Edit `touch-grass.ts` — it's a single file, no build step needed
3. Test it by dropping it into `~/.pi/agent/extensions/` and starting a pi session
4. Open a PR with a short description of what you changed and why

No need to open an issue first for small changes (new messages, bug fixes). For bigger ideas it's worth a quick discussion first so you don't waste time on something that won't fit.

## Code style

- Keep it as a single file — the whole point is that installation is just copying one `.ts` file
- No new dependencies
- Comments where the logic isn't obvious (the fluid sim especially appreciates them)

## Reporting bugs

Open an issue with:
- What happened vs what you expected
- Your pi version (`pi --version`)
- Your terminal emulator

---

Even just starring the repo or sharing it helps. Cheers 🌿
