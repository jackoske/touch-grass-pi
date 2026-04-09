/**
 * Touch Grass 🌿
 *
 * Adds an animated session timer to the status bar and reminds you to take breaks.
 * Features a fluid-smoke ASCII animation (inspired by pretext-demos/fluid-smoke)
 * that plays on break reminders.
 *
 * Commands:
 *   /grass         — show session time and next break countdown
 *   /grass-now     — open the animated break reminder overlay right now
 *   /grass-set N   — set break reminder interval to N minutes
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_BREAK_MINS = 45;
const DISMISS_SECS = 15;
const SIM_ROWS = 7;

// Character palette ordered light → dense (from fluid-smoke.js technique)
const CHARSET = " ·.:,;!=+*#@%";

const BREAK_MESSAGES = [
  "🌿 Touch some grass, friend!",
  "🚶 Get up, walk around!",
  "☀️  Step outside for a minute!",
  "💧 Drink some water, stretch!",
  "🐦 Go look at a bird or something!",
  "🧘 Your eyes need a rest!",
  "🌳 The trees miss you!",
  "🦋 The outside world awaits!",
  "🌊 Breathe some fresh air!",
  "🌻 Skill issue: forgot to touch grass!",
  "🎯 Touch grass% speedrun — GO!",
  "🌱 Even skill trees need watering!",
  "🐸 The frogs are calling out there!",
  "🌄 There's a whole sky above you!",
];

// Status bar animation chars — ordered light to dense, for the bouncy fill
const FILL_CHARS = " ·:=+*#@";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Strip ANSI escape codes and estimate visible terminal width (rough, handles emoji) */
function visLen(s: string): number {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  let len = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0) ?? 0;
    // Emoji / wide CJK: count as 2 columns
    if (cp > 0x2E7F) len += 2;
    else len += 1;
  }
  return len;
}

function centerPad(s: string, width: number): string {
  const vis = visLen(s);
  const left = Math.max(0, Math.floor((width - vis) / 2));
  const right = Math.max(0, width - vis - left);
  return " ".repeat(left) + s + " ".repeat(right);
}

function padRight(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - visLen(s)));
}

// ── Fluid smoke simulation ───────────────────────────────────────────────────
// Adapted from the pretext-demos fluid-smoke.js technique:
// - Layered sine/cosine velocity field
// - Density advection via bilinear interpolation
// - Emitters from bottom row (rising "grass smoke")
// - Density → character mapping by visual brightness order
// ─────────────────────────────────────────────────────────────────────────────

class FluidSim {
  cols: number;
  rows: number;
  density: Float32Array;
  temp: Float32Array;
  t = 0;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.density = new Float32Array(cols * rows);
    this.temp = new Float32Array(cols * rows);
  }

  private sample(x: number, y: number): number {
    const { cols, rows } = this;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const get = (cx: number, cy: number) => {
      const bx = ((cx % cols) + cols) % cols;
      const by = Math.max(0, Math.min(rows - 1, cy));
      return this.density[by * cols + bx]!;
    };
    return get(x0, y0) * (1-fx)*(1-fy)
         + get(x0+1, y0) * fx*(1-fy)
         + get(x0, y0+1) * (1-fx)*fy
         + get(x0+1, y0+1) * fx*fy;
  }

  step() {
    const { cols, rows } = this;
    const t = this.t;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = c / cols, ny = r / rows;
        // Layered velocity field — same multi-frequency technique as fluid-smoke.js
        const vx = Math.sin(ny * 6.28 + t * 0.3) * 1.5
                 + Math.cos((nx + ny) * 12.5 + t * 0.55) * 0.5
                 + Math.sin(nx * 25 + ny * 18 + t * 0.8) * 0.15;
        const vy = Math.cos(nx * 6.28 + t * 0.4) * 0.8
                 + Math.sin((nx - ny) * 9 + t * 0.45) * 0.35
                 - 0.7; // upward drift (grass rising)
        this.temp[r * cols + c] = this.sample(c - vx*0.35, r - vy*0.35) * 0.97;
      }
    }
    this.density.set(this.temp);

    // Emit from bottom (sine-wave grass emitters — vary strength by column + time)
    for (let c = 0; c < cols; c++) {
      const strength = (Math.sin(c * 0.55 + t * 2.1) + 1) / 2 * 0.45 + 0.08;
      const idx = (rows - 1) * cols + c;
      this.density[idx] = Math.min(1, this.density[idx]! + strength);
    }

    this.t += 0.065;
  }

  /** Render to ANSI-colored string lines using green gradient */
  renderLines(targetCols: number): string[] {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = "";
      for (let c = 0; c < targetCols; c++) {
        const col = Math.min(c, this.cols - 1);
        const d = this.density[r * this.cols + col]!;
        const ci = Math.min(CHARSET.length - 1, Math.floor(d * CHARSET.length));
        const ch = CHARSET[ci]!;
        // Green gradient: dim olive at low density → bright grass green → lime at peak
        const g = Math.floor(55 + d * 190);
        const b = Math.floor(d * 45);
        line += `\x1b[38;2;20;${g};${b}m${ch}`;
      }
      line += "\x1b[0m";
      lines.push(line);
    }
    return lines;
  }
}

// ── Break reminder overlay ───────────────────────────────────────────────────

class GrassOverlay {
  private sim: FluidSim;
  private interval: ReturnType<typeof setInterval>;
  private countdown = DISMISS_SECS;
  private tui: { requestRender(): void };
  private done: () => void;

  readonly message: string;
  readonly elapsed: number;
  readonly breakCount: number;

  constructor(
    tui: { requestRender(): void },
    done: () => void,
    elapsed: number,
    breakCount: number,
    message: string,
  ) {
    this.tui = tui;
    this.done = done;
    this.elapsed = elapsed;
    this.breakCount = breakCount;
    this.message = message;
    this.sim = new FluidSim(60, SIM_ROWS);

    this.interval = setInterval(() => {
      this.sim.step();
      if (--this.countdown <= 0) {
        this.dispose();
        done();
        return;
      }
      tui.requestRender();
    }, 1000);
  }

  handleInput(_data: string): void {
    this.dispose();
    this.done();
  }

  render(width: number): string[] {
    const inner = Math.max(24, Math.min(width - 4, 70));
    const simCols = inner;

    // Resize sim if cols changed significantly
    if (Math.abs(this.sim.cols - simCols) > 2) {
      this.sim = new FluidSim(simCols, SIM_ROWS);
    }

    const hr = (ch = "─") => ch.repeat(inner);
    const border = (s: string) => `│ ${padRight(s, inner)} │`;
    const lines: string[] = [];

    // Top border
    lines.push(`╭${hr()}╮`);
    lines.push(border(""));

    // Title — big spaced letters feel impactful at single-line scale
    lines.push(border(centerPad("🌿  T O U C H   G R A S S  🌿", inner)));
    lines.push(border(""));

    // Fluid smoke field
    const smokeLines = this.sim.renderLines(simCols);
    for (const sl of smokeLines) {
      lines.push(`│ ${sl}\x1b[0m │`);
    }

    lines.push(border(""));

    // Session info
    lines.push(border(centerPad(`🕐  ${formatDuration(this.elapsed)} coding  •  reminder #${this.breakCount}`, inner)));
    lines.push(border(""));

    // Break message
    lines.push(border(centerPad(this.message, inner)));
    lines.push(border(""));

    // Countdown progress bar
    const barWidth = inner - 4;
    const filled = Math.round((this.countdown / DISMISS_SECS) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    lines.push(border(centerPad(`\x1b[32m${bar}\x1b[0m`, inner)));
    lines.push(border(centerPad(`\x1b[2mdismissing in ${this.countdown}s  •  any key to close\x1b[0m`, inner)));
    lines.push(border(""));

    lines.push(`╰${hr()}╯`);
    return lines;
  }

  invalidate(): void {}

  dispose(): void {
    clearInterval(this.interval);
  }
}

// ── Extension entry point ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let statusTick: ReturnType<typeof setInterval> | null = null;
  let breakTick: ReturnType<typeof setInterval> | null = null;
  let sessionStartMs = 0;
  let breakIntervalMins = DEFAULT_BREAK_MINS;
  let breakCount = 0;
  let frame = 0;
  let capturedCtx: ExtensionContext | null = null;

  // ── Status bar: progress-based bouncy fill animation ──────────────────────
  //
  // The bar shows how far you are through the current break interval.
  // At 5% → 5% of cells are filled. At 90% → 90% filled.
  // The filled cells are "alive" — each one independently bounces between
  // FILL_CHARS using two overlapping sine waves (one slow drift, one fast jitter),
  // so the fill wiggles and jumps rather than sitting static.
  // Color shifts green → yellow → red as the break approaches.

  function updateStatus() {
    if (!capturedCtx) return;
    frame++;

    const elapsed = Date.now() - sessionStartMs;
    const breakMs = breakIntervalMins * 60_000;
    const progress = (elapsed % breakMs) / breakMs; // 0 → 1
    const BAR = 22;
    const filledCells = Math.max(1, Math.round(progress * BAR));

    let bar = "";
    for (let i = 0; i < BAR; i++) {
      if (i < filledCells) {
        // Two sine waves at different frequencies create the "jump around" effect
        const slow = (Math.sin(i * 1.1 + frame * 0.3) + 1) / 2;
        const fast = (Math.sin(i * 3.7 + frame * 1.1 + i * 0.5) + 1) / 2;
        const d = slow * 0.55 + fast * 0.45;
        const ci = Math.min(FILL_CHARS.length - 1, Math.floor(d * FILL_CHARS.length));
        bar += FILL_CHARS[ci];
      } else {
        bar += " ";
      }
    }

    // Frontier pulse: the leading edge blinks so you can see the boundary
    const frontier = filledCells - 1;
    if (frontier >= 0 && frontier < BAR) {
      const pulse = Math.sin(frame * 1.4) > 0.2 ? "│" : "╎";
      bar = bar.slice(0, frontier) + pulse + bar.slice(frontier + 1);
    }

    // Color: green → yellow-orange → red as break approaches
    let r: number, g: number;
    if (progress < 0.65) {
      r = Math.floor(20 + progress * 60);
      g = 190;
    } else {
      const t = (progress - 0.65) / 0.35;
      r = Math.floor(80 + t * 175);
      g = Math.floor(190 - t * 130);
    }
    const color = `\x1b[38;2;${r};${g};20m`;

    const time = `\x1b[2m${formatDuration(elapsed)}\x1b[0m`;
    capturedCtx.ui.setStatus("touch-grass", `${color}${bar}\x1b[0m ${time}`);
  }

  // ── Break reminder ───────────────────────────────────────────────────────

  function scheduleBreak() {
    if (breakTick) clearInterval(breakTick);
    if (!capturedCtx) return;
    const ms = breakIntervalMins * 60_000;
    breakTick = setInterval(() => {
      breakCount++;
      const elapsed = Date.now() - sessionStartMs;
      const msg = randomItem(BREAK_MESSAGES);

      // In-TUI toast
      capturedCtx?.ui.notify(`${msg}  (${formatDuration(elapsed)} this session)`, "warning");

      // Native OS notification (Ghostty, iTerm2, WezTerm via OSC 777)
      process.stdout.write(
        `\x1b]777;notify;🌿 Touch Grass!;${msg} — ${formatDuration(elapsed)} coding\x07`
      );
    }, ms);
  }

  function cleanup() {
    if (statusTick) { clearInterval(statusTick); statusTick = null; }
    if (breakTick) { clearInterval(breakTick); breakTick = null; }
    capturedCtx?.ui.setStatus("touch-grass", undefined);
    capturedCtx = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    cleanup();
    capturedCtx = ctx;
    sessionStartMs = Date.now();
    breakCount = 0;
    frame = 0;

    updateStatus();
    statusTick = setInterval(updateStatus, 2_000); // animate every 2s
    scheduleBreak();
  });

  pi.on("session_shutdown", async () => {
    cleanup();
  });

  // ── Commands ─────────────────────────────────────────────────────────────

  pi.registerCommand("grass", {
    description: "Show session timer and break info",
    handler: async (_args, ctx) => {
      const elapsed = Date.now() - sessionStartMs;
      const breakMs = breakIntervalMins * 60_000;
      const nextBreakMs = breakMs - (elapsed % breakMs);
      ctx.ui.notify(
        `🌿 Session: ${formatDuration(elapsed)}  |  Next nudge: ${formatDuration(nextBreakMs)}  |  Interval: ${breakIntervalMins}m  |  Reminders sent: ${breakCount}`,
        "info",
      );
    },
  });

  pi.registerCommand("grass-set", {
    description: "Set break interval in minutes — /grass-set 30",
    handler: async (args, ctx) => {
      const mins = parseInt(args ?? "", 10);
      if (!args || isNaN(mins) || mins < 1) {
        ctx.ui.notify("Usage: /grass-set <minutes>  e.g. /grass-set 30", "error");
        return;
      }
      breakIntervalMins = mins;
      scheduleBreak();
      ctx.ui.notify(`🌿 Break reminder set to every ${mins} minutes!`, "info");
    },
  });

  pi.registerCommand("grass-now", {
    description: "Open animated break reminder overlay right now",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("No UI available", "error");
        return;
      }
      const elapsed = Date.now() - sessionStartMs;
      const msg = randomItem(BREAK_MESSAGES);

      await ctx.ui.custom(
        (tui, _theme, _keys, done) =>
          new GrassOverlay(tui, done, elapsed, breakCount, msg),
        {
          overlay: true,
          overlayOptions: {
            width: "60%",
            maxHeight: "90%",
            anchor: "center",
          },
        },
      );
    },
  });
}
