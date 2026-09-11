import { api } from "../convex/_generated/api.js";
import { call, randInt, randomChoice, sleep, weightedPick } from "./lib.mjs";

const SENTENCES = [
  "Quick sync on the release checklist.",
  "Can someone review my PR when free?",
  "Great work on the demo today!",
  "I'm a bit stuck on the flaky test, any ideas?",
  "Standup notes are in the doc.",
  "Deploy went smoothly, no incidents.",
  "Anyone up for a coffee break?",
  "Let's revisit the roadmap next week.",
  "Thanks for the quick turnaround!",
  "This is taking longer than expected.",
  "Pushed a fix, please pull latest.",
  "Meeting moved to 3pm, see you there.",
];

const EMOJI = ["👍", "❤️", "😂", "🎉", "👀", "🔥"];

// A tiny 1x1 transparent PNG — enough bytes to exercise the real upload path
// without shipping a real asset into the repo.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const randomSentence = () => randomChoice(SENTENCES);

const toDelta = (text) => JSON.stringify({ ops: [{ insert: `${text}\n` }] });

/** Keeps a bounded pool of recently created messages so reactions/threads have something real to target. */
function pushRecent(ctx, entry) {
  ctx.recentMessages.push(entry);
  if (ctx.recentMessages.length > 200) {
    ctx.recentMessages.splice(0, 50);
  }
}

const SCENARIOS = [
  {
    name: "messages.create(channel)",
    weight: 22,
    run: async (client, ctx) => {
      const channel = randomChoice(ctx.channels);
      const id = await call(ctx, "messages.create(channel)", () =>
        client.mutation(api.messages.create, {
          body: toDelta(randomSentence()),
          workspaceId: ctx.workspaceId,
          channelId: channel.id,
        })
      );
      if (id) pushRecent(ctx, { messageId: id, channelId: channel.id });
    },
  },
  {
    name: "messages.get(channel)",
    weight: 18,
    run: async (client, ctx) => {
      const channel = randomChoice(ctx.channels);
      await call(ctx, "messages.get(channel)", () =>
        client.query(api.messages.get, {
          channelId: channel.id,
          paginationOpts: { numItems: 20, cursor: null },
        })
      );
    },
  },
  {
    name: "reactions.toggle",
    weight: 12,
    needsRecent: true,
    run: async (client, ctx) => {
      const target = randomChoice(ctx.recentMessages);
      await call(ctx, "reactions.toggle", () =>
        client.mutation(api.reactions.toggle, {
          messageId: target.messageId,
          value: randomChoice(EMOJI),
        })
      );
    },
  },
  {
    name: "messages.create(thread)",
    weight: 8,
    needsRecent: true,
    run: async (client, ctx) => {
      const parent = randomChoice(ctx.recentMessages);
      const args = {
        body: toDelta(randomSentence()),
        workspaceId: ctx.workspaceId,
        parentMessageId: parent.messageId,
        ...(parent.channelId ? { channelId: parent.channelId } : {}),
      };
      const id = await call(ctx, "messages.create(thread)", () =>
        client.mutation(api.messages.create, args)
      );
      if (id) {
        pushRecent(ctx, {
          messageId: id,
          channelId: parent.channelId,
          conversationId: parent.conversationId,
        });
      }
    },
  },
  {
    name: "conversations+messages.create(dm)",
    weight: 10,
    needsOtherMember: true,
    run: async (client, ctx, opts, self) => {
      const others = ctx.memberIds.filter((m) => m.memberId !== self.memberId);
      if (others.length === 0) return;

      const other = randomChoice(others);
      const conversationId = await call(ctx, "conversations.createOrGet", () =>
        client.mutation(api.conversations.createOrGet, {
          memberId: other.memberId,
          workspaceId: ctx.workspaceId,
        })
      );
      if (!conversationId) return;

      const id = await call(ctx, "messages.create(dm)", () =>
        client.mutation(api.messages.create, {
          body: toDelta(randomSentence()),
          workspaceId: ctx.workspaceId,
          conversationId,
        })
      );
      if (id) pushRecent(ctx, { messageId: id, conversationId });
    },
  },
  {
    name: "drafts.set",
    weight: 5,
    run: async (client, ctx) => {
      const channel = randomChoice(ctx.channels);
      await call(ctx, "drafts.set", () =>
        client.mutation(api.drafts.set, {
          workspaceId: ctx.workspaceId,
          channelId: channel.id,
          body: toDelta(randomSentence()),
        })
      );
    },
  },
  {
    name: "channels.get",
    weight: 5,
    run: async (client, ctx) => {
      await call(ctx, "channels.get", () =>
        client.query(api.channels.get, { workspaceId: ctx.workspaceId })
      );
    },
  },
  {
    name: "members.get",
    weight: 4,
    run: async (client, ctx) => {
      await call(ctx, "members.get", () =>
        client.query(api.members.get, { workspaceId: ctx.workspaceId })
      );
    },
  },
  {
    name: "activity.list+unreadCount",
    weight: 5,
    run: async (client, ctx) => {
      await call(ctx, "activity.list", () =>
        client.query(api.activity.list, { workspaceId: ctx.workspaceId })
      );
      await call(ctx, "activity.unreadCount", () =>
        client.query(api.activity.unreadCount, { workspaceId: ctx.workspaceId })
      );
    },
  },
  {
    name: "wellness.heartbeat",
    weight: 4,
    run: async (client, ctx) => {
      await call(ctx, "wellness.heartbeat", () =>
        client.mutation(api.wellness.heartbeat, { workspaceId: ctx.workspaceId })
      );
    },
  },
  {
    name: "calls.huddle(join+token+leave)",
    weight: 3,
    flag: "calls",
    run: async (client, ctx) => {
      const channel = randomChoice(ctx.channels);
      const joined = await call(ctx, "calls.join", () =>
        client.mutation(api.calls.join, {
          workspaceId: ctx.workspaceId,
          channelId: channel.id,
        })
      );
      if (!joined) return;

      await call(ctx, "livekit.createToken", () =>
        client.action(api.livekit.createToken, {
          workspaceId: ctx.workspaceId,
          callId: joined.callId,
        })
      );

      await sleep(randInt(300, 1200));

      await call(ctx, "calls.leave", () =>
        client.mutation(api.calls.leave, { callId: joined.callId })
      );
    },
  },
  {
    name: "upload+messages.create(image)",
    weight: 3,
    flag: "upload",
    run: async (client, ctx) => {
      const uploadUrl = await call(ctx, "upload.generateUploadUrl", () =>
        client.mutation(api.upload.generateUploadUrl, {})
      );
      if (!uploadUrl) return;

      const bytes = Buffer.from(TINY_PNG_BASE64, "base64");
      const storageId = await call(ctx, "upload.postFile", async () => {
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: bytes,
        });
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        const json = await res.json();
        return json.storageId;
      });
      if (!storageId) return;

      const channel = randomChoice(ctx.channels);
      const id = await call(ctx, "messages.create(image)", () =>
        client.mutation(api.messages.create, {
          body: toDelta("Sharing a screenshot"),
          workspaceId: ctx.workspaceId,
          channelId: channel.id,
          image: storageId,
        })
      );
      if (id) pushRecent(ctx, { messageId: id, channelId: channel.id });
    },
  },
  {
    name: "ai.summarize",
    weight: 1,
    flag: "ai",
    run: async (client, ctx) => {
      const channel = randomChoice(ctx.channels);
      await call(ctx, "ai.summarize", () =>
        client.action(api.ai.summarize, {
          workspaceId: ctx.workspaceId,
          channelId: channel.id,
          limit: 20,
        })
      );
    },
  },
  {
    name: "messages.create(@ai mention)",
    weight: 1,
    flag: "ai",
    run: async (client, ctx) => {
      const channel = randomChoice(ctx.channels);
      const id = await call(ctx, "messages.create(@ai mention)", () =>
        client.mutation(api.messages.create, {
          body: toDelta(`@ai ${randomSentence()}`),
          workspaceId: ctx.workspaceId,
          channelId: channel.id,
        })
      );
      if (id) pushRecent(ctx, { messageId: id, channelId: channel.id });
    },
  },
];

export function pickScenario(ctx, opts) {
  const available = SCENARIOS.filter((s) => {
    if (s.needsRecent && ctx.recentMessages.length === 0) return false;
    if (s.needsOtherMember && ctx.memberIds.length < 2) return false;
    if (s.flag && !opts[s.flag]) return false;
    return true;
  });

  return weightedPick(available);
}

export { toDelta };
