import fs from "node:fs";
import path from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randomChoice = (arr) => arr[randInt(0, arr.length - 1)];

/** Loads KEY=value pairs from a .env-style file into process.env without overwriting existing vars. */
export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Minimal `--key=value` / `--flag` CLI parser — no dependency needed for a one-off script. */
export function parseArgs(argv) {
  const out = {};

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const body = raw.slice(2);
    const eq = body.indexOf("=");

    if (eq === -1) {
      out[body] = true;
    } else {
      out[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }

  return out;
}

export function weightedPick(items) {
  if (items.length === 0) return undefined;

  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }

  return items[items.length - 1];
}

/** Runs `fn`, timing it and recording success/failure under `name` in `ctx.stats`. Never throws. */
export async function call(ctx, name, fn) {
  const t0 = performance.now();

  try {
    const result = await fn();
    ctx.stats.record(name, performance.now() - t0, true);
    return result;
  } catch (err) {
    ctx.stats.record(name, performance.now() - t0, false, err);
    return undefined;
  }
}

export class Stats {
  constructor() {
    this.byAction = new Map();
    this.startedAt = Date.now();
  }

  record(name, ms, ok, err) {
    let bucket = this.byAction.get(name);

    if (!bucket) {
      bucket = {
        count: 0,
        errors: 0,
        totalMs: 0,
        min: Infinity,
        max: 0,
        samples: [],
        errorSamples: [],
      };
      this.byAction.set(name, bucket);
    }

    bucket.count += 1;
    bucket.totalMs += ms;
    if (ms < bucket.min) bucket.min = ms;
    if (ms > bucket.max) bucket.max = ms;

    bucket.samples.push(ms);
    if (bucket.samples.length > 5000) bucket.samples.splice(0, 1000);

    if (!ok) {
      bucket.errors += 1;
      if (bucket.errorSamples.length < 5) {
        bucket.errorSamples.push(String(err?.message ?? err).slice(0, 200));
      }
    }
  }

  totals() {
    let count = 0;
    let errors = 0;

    for (const bucket of this.byAction.values()) {
      count += bucket.count;
      errors += bucket.errors;
    }

    return { count, errors, elapsedSec: (Date.now() - this.startedAt) / 1000 };
  }

  static percentile(samples, p) {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  }

  summaryRows() {
    const rows = [];

    for (const [name, b] of [...this.byAction.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      rows.push({
        action: name,
        count: b.count,
        errors: b.errors,
        "err%": b.count ? ((b.errors / b.count) * 100).toFixed(1) : "0.0",
        "avg ms": (b.totalMs / b.count).toFixed(0),
        p50: Stats.percentile(b.samples, 50).toFixed(0),
        p95: Stats.percentile(b.samples, 95).toFixed(0),
        p99: Stats.percentile(b.samples, 99).toFixed(0),
        min: b.min === Infinity ? 0 : b.min.toFixed(0),
        max: b.max.toFixed(0),
      });
    }

    return rows;
  }

  toJSON() {
    const json = {};

    for (const [name, b] of this.byAction.entries()) {
      json[name] = {
        count: b.count,
        errors: b.errors,
        avgMs: b.count ? b.totalMs / b.count : 0,
        p50: Stats.percentile(b.samples, 50),
        p95: Stats.percentile(b.samples, 95),
        p99: Stats.percentile(b.samples, 99),
        min: b.min === Infinity ? 0 : b.min,
        max: b.max,
        sampleErrors: b.errorSamples,
      };
    }

    return json;
  }
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
