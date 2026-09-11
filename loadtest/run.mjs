#!/usr/bin/env node
// Load-test / benchmark harness for the Convex backend behind this Slack
// clone. Drives real virtual users (real sign-ups, real function calls)
// against a Convex deployment to see how much traffic it takes before
// latency/error rate falls over. See loadtest/README.md before running.

import path from "node:path";
import { fileURLToPath } from "node:url";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  Stats,
  call,
  loadEnvFile,
  parseArgs,
  sleep,
  writeJson,
} from "./lib.mjs";
import { pickScenario } from "./scenarios.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

loadEnvFile(path.join(rootDir, ".env.local"));

const args = parseArgs(process.argv.slice(2));

const opts = {
  url: args.url ?? process.env.NEXT_PUBLIC_CONVEX_URL,
  vus: Number(args.vus ?? 20),
  durationSec: Number(args.duration ?? 60),
  rampSec: Number(args.ramp ?? 10),
  thinkMinMs: Number(args["think-min"] ?? 200),
  thinkMaxMs: Number(args["think-max"] ?? 1200),
  channels: Number(args.channels ?? 3),
  workspaceName: args["workspace-name"] ?? "LoadTest",
  ai: Boolean(args.ai),
  upload: !args["no-upload"],
  calls: !args["no-calls"],
  yes: Boolean(args.yes),
  allowProd: Boolean(args["allow-prod"]),
  keep: Boolean(args.keep),
  out: args.out ?? null,
  password: "LoadTest!12345",
};

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!opts.url) {
  fail(
    "No Convex URL. Set NEXT_PUBLIC_CONVEX_URL in .env.local or pass --url=https://<deployment>.convex.cloud"
  );
}

const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
const isProd = deployment.startsWith("prod:");

if (isProd && !opts.allowProd) {
  fail(
    `CONVEX_DEPLOYMENT ("${deployment}") looks like a PRODUCTION deployment. ` +
      "Refusing to load-test it. Point .env.local at your dev deployment, or pass --allow-prod if you really mean it."
  );
}

const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function printBanner() {
  console.log("\n=== Convex load test ===");
  console.log(`target:        ${opts.url}${isProd ? "  (⚠ PRODUCTION)" : ""}`);
  console.log(`virtual users: ${opts.vus} (ramped over ${opts.rampSec}s)`);
  console.log(`duration:      ${opts.durationSec}s`);
  console.log(`think time:    ${opts.thinkMinMs}-${opts.thinkMaxMs}ms between actions`);
  console.log(`channels:      general + ${opts.channels} extra`);
  console.log(
    `features:      messaging, reactions, threads, DMs, drafts, activity, presence` +
      `${opts.calls ? ", calls/LiveKit" : ""}${opts.upload ? ", uploads" : ""}${
        opts.ai ? ", AI (real Gemini calls — costs money)" : ""
      }`
  );
  if (!opts.ai) console.log("               AI summarize/@ai mentions: OFF (pass --ai to include)");
  if (!opts.calls) console.log("               calls/LiveKit: OFF (pass --no-calls was set)");
  if (!opts.upload) console.log("               uploads: OFF (--no-upload was set)");
  console.log(`cleanup:       ${opts.keep ? "keep workspace after run" : "delete workspace after run"}`);
  console.log("");
}

printBanner();

if (!opts.yes) {
  console.log(
    "Dry run only — nothing was called. Re-run with --yes to actually execute this load test.\n" +
      "(This creates real accounts/data on the target deployment and, with --ai, makes real billed API calls.)"
  );
  process.exit(0);
}

async function setup(ctx) {
  const adminClient = new ConvexHttpClient(opts.url);
  adminClient.setDebug(false); // don't relay every server console.log into this process's stdout
  const adminEmail = `loadtest-admin-${runId}@example.test`;

  const authRes = await call(ctx, "auth.signIn(signUp)", () =>
    adminClient.action(api.auth.signIn, {
      provider: "password",
      params: {
        email: adminEmail,
        password: opts.password,
        name: "Load Admin",
        flow: "signUp",
      },
    })
  );
  if (!authRes?.tokens?.token) throw new Error("Admin sign-up failed");
  adminClient.setAuth(authRes.tokens.token);

  const workspaceId = await call(ctx, "workspaces.create", () =>
    adminClient.mutation(api.workspaces.create, {
      name: `${opts.workspaceName}-${runId}`,
    })
  );
  if (!workspaceId) throw new Error("Workspace creation failed");

  const workspace = await call(ctx, "workspaces.getById", () =>
    adminClient.query(api.workspaces.getById, { id: workspaceId })
  );
  if (!workspace) throw new Error("Could not read back created workspace");

  await call(ctx, "bot.ensureBotMember", () =>
    adminClient.mutation(api.bot.ensureBotMember, { workspaceId })
  );

  const initialChannels = await call(ctx, "channels.get", () =>
    adminClient.query(api.channels.get, { workspaceId })
  );
  const channels = (initialChannels ?? []).map((c) => ({ id: c._id, name: c.name }));

  for (let i = 0; i < opts.channels; i++) {
    const id = await call(ctx, "channels.create", () =>
      adminClient.mutation(api.channels.create, {
        name: `topic-${i + 1}`,
        workspaceId,
      })
    );
    if (id) channels.push({ id, name: `topic-${i + 1}` });
  }

  const adminMember = await call(ctx, "members.current", () =>
    adminClient.query(api.members.current, { workspaceId })
  );
  if (!adminMember) throw new Error("Could not resolve admin member");

  return {
    adminClient,
    workspaceId,
    joinCode: workspace.joinCode,
    channels,
    adminMemberId: adminMember._id,
  };
}

async function runVirtualUser(index, ctx, opts, seed) {
  let client = seed?.client;
  let memberId = seed?.memberId;

  if (!client) {
    client = new ConvexHttpClient(opts.url);
    client.setDebug(false); // don't relay every server console.log into this process's stdout
    const email = `loadtest-${runId}-vu${index}@example.test`;

    const authRes = await call(ctx, "auth.signIn(signUp)", () =>
      client.action(api.auth.signIn, {
        provider: "password",
        params: {
          email,
          password: opts.password,
          name: `LoadBot ${index}`,
          flow: "signUp",
        },
      })
    );
    if (!authRes?.tokens?.token) return;
    client.setAuth(authRes.tokens.token);

    const joined = await call(ctx, "workspaces.joinByCode", () =>
      client.mutation(api.workspaces.joinByCode, { joinCode: ctx.joinCode })
    );
    if (!joined) return;

    const member = await call(ctx, "members.current", () =>
      client.query(api.members.current, { workspaceId: ctx.workspaceId })
    );
    if (!member) return;

    memberId = member._id;
    ctx.memberIds.push({ memberId, name: `LoadBot ${index}` });
  }

  const self = { memberId };

  while (ctx.running) {
    const scenario = pickScenario(ctx, opts);
    if (scenario) {
      await scenario.run(client, ctx, opts, self);
    }
    await sleep(Math.floor(Math.random() * (opts.thinkMaxMs - opts.thinkMinMs + 1)) + opts.thinkMinMs);
  }
}

function printProgress(ctx) {
  const { count, errors, elapsedSec } = ctx.stats.totals();
  const rps = elapsedSec > 0 ? (count / elapsedSec).toFixed(1) : "0.0";
  process.stdout.write(
    `\r[${elapsedSec.toFixed(0)}s] calls=${count} errors=${errors} rps=${rps}   `
  );
}

async function main() {
  const stats = new Stats();
  const ctx = {
    runId,
    stats,
    running: true,
    recentMessages: [],
    memberIds: [],
  };

  console.log("Setting up admin user + workspace...");
  const { adminClient, workspaceId, joinCode, channels, adminMemberId } = await setup(ctx);
  Object.assign(ctx, { workspaceId, joinCode, channels });
  ctx.memberIds.push({ memberId: adminMemberId, name: "Load Admin" });
  console.log(
    `Workspace ready: ${workspaceId} (${channels.length} channels). Spawning ${opts.vus} virtual users...\n`
  );

  let stopRequested = false;
  process.on("SIGINT", () => {
    if (stopRequested) process.exit(1);
    stopRequested = true;
    console.log("\nSIGINT received, stopping virtual users...");
    ctx.running = false;
  });

  const progressTimer = setInterval(() => printProgress(ctx), 2000);

  const startTime = Date.now();
  const vuPromises = [
    runVirtualUser(0, ctx, opts, { client: adminClient, memberId: adminMemberId }),
  ];

  const rampDelayMs = opts.vus > 1 ? (opts.rampSec * 1000) / (opts.vus - 1) : 0;
  for (let i = 1; i < opts.vus; i++) {
    if (stopRequested) break;
    await sleep(rampDelayMs);
    vuPromises.push(runVirtualUser(i, ctx, opts));
  }

  const stopAt = startTime + opts.durationSec * 1000;
  while (ctx.running && Date.now() < stopAt) {
    await sleep(200);
  }
  ctx.running = false;

  // Give in-flight iterations (mid think-time or mid-request) a moment to exit.
  await Promise.race([Promise.allSettled(vuPromises), sleep(opts.thinkMaxMs + 5000)]);

  clearInterval(progressTimer);
  process.stdout.write("\n\n");

  const rows = stats.summaryRows();
  console.log("=== Results ===");
  console.table(rows);

  const totals = stats.totals();
  console.log(
    `\nTotal calls: ${totals.count}  errors: ${totals.errors} (${
      totals.count ? ((totals.errors / totals.count) * 100).toFixed(2) : "0.00"
    }%)  wall time: ${totals.elapsedSec.toFixed(1)}s  throughput: ${(
      totals.count / Math.max(totals.elapsedSec, 1)
    ).toFixed(1)} req/s`
  );

  const outPath = opts.out ?? path.join(rootDir, "loadtest", "results", `${runId}.json`);
  writeJson(outPath, {
    runId,
    startedAt: new Date(startTime).toISOString(),
    config: { ...opts, password: undefined },
    workspaceId,
    totals,
    byAction: stats.toJSON(),
  });
  console.log(`Report written to ${path.relative(rootDir, outPath)}`);

  if (!opts.keep) {
    console.log("Cleaning up load-test workspace...");
    await call(ctx, "workspaces.remove", () =>
      adminClient.mutation(api.workspaces.remove, { id: workspaceId })
    );
    console.log(
      "Workspace deleted. Note: the load-test user accounts themselves, and a few " +
        "rows outside the workspace cascade (drafts/activity/calls/wellness rollups), are not " +
        "cleaned up automatically — see loadtest/README.md."
    );
  } else {
    console.log(`Workspace kept: ${workspaceId} (join code: ${joinCode})`);
  }
}

main().catch((err) => {
  console.error("\nLoad test failed:", err);
  process.exit(1);
});
