import { v } from "convex/values";

import { auth } from "./auth";
import { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, QueryCtx } from "./_generated/server";

const getMember = async (
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">
) => {
  return ctx.db
    .query("members")
    .withIndex("by_workspace_id_user_id", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .unique();
};

/**
 * The one live call for a channel or DM, if any. Queried by the index on
 * `endedAt` so a finished call never matches.
 */
const findActiveCall = async (
  ctx: QueryCtx,
  args: {
    channelId?: Id<"channels">;
    conversationId?: Id<"conversations">;
  }
) => {
  if (args.channelId) {
    return ctx.db
      .query("calls")
      .withIndex("by_channel_id_ended_at", (q) =>
        q.eq("channelId", args.channelId).eq("endedAt", undefined)
      )
      .first();
  }

  if (args.conversationId) {
    return ctx.db
      .query("calls")
      .withIndex("by_conversation_id_ended_at", (q) =>
        q.eq("conversationId", args.conversationId).eq("endedAt", undefined)
      )
      .first();
  }

  return null;
};

const populateParticipants = async (ctx: QueryCtx, call: Doc<"calls">) => {
  const participants = [];

  for (const memberId of call.activeMemberIds) {
    const member = await ctx.db.get(memberId);
    const user = member ? await ctx.db.get(member.userId) : null;

    if (member && user) {
      participants.push({
        memberId: member._id,
        name: user.name ?? "Member",
        image: user.image,
      });
    }
  }

  return participants;
};

/**
 * Raw call row for the token action, which has already checked that the
 * caller belongs to the workspace before asking for it.
 */
export const getInternal = internalQuery({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.callId);
  },
});

/** The live call for one channel or DM, with its participants resolved. */
export const getActive = query({
  args: {
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) return null;

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) return null;

    const call = await findActiveCall(ctx, args);

    if (!call) return null;

    return {
      ...call,
      participants: await populateParticipants(ctx, call),
    };
  },
});

/** Every live call in the workspace, so the UI can ring/badge elsewhere. */
export const listActive = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) return [];

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) return [];

    const calls = await ctx.db
      .query("calls")
      .withIndex("by_workspace_id_ended_at", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("endedAt", undefined)
      )
      .collect();

    const withParticipants = [];

    for (const call of calls) {
      withParticipants.push({
        ...call,
        participants: await populateParticipants(ctx, call),
      });
    }

    return withParticipants;
  },
});

/**
 * Joins the live call for this channel/DM, starting one if there isn't one.
 * Idempotent, so a reconnect or a second tab does not create a duplicate.
 */
export const join = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized");
    }

    if (!args.channelId && !args.conversationId) {
      throw new Error("A call needs a channel or a conversation");
    }

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) {
      throw new Error("Unauthorized");
    }

    const existing = await findActiveCall(ctx, args);

    if (existing) {
      if (!existing.activeMemberIds.includes(member._id)) {
        await ctx.db.patch(existing._id, {
          activeMemberIds: [...existing.activeMemberIds, member._id],
        });
      }

      return { callId: existing._id, room: existing.room };
    }

    // The suffix keeps a fresh LiveKit room per call, so a stale server-side
    // room can never leak participants into the next huddle.
    const target = args.channelId ?? args.conversationId;
    const room = `${args.workspaceId}_${target}_${Date.now().toString(36)}`;

    const callId = await ctx.db.insert("calls", {
      workspaceId: args.workspaceId,
      channelId: args.channelId,
      conversationId: args.conversationId,
      room,
      startedByMemberId: member._id,
      activeMemberIds: [member._id],
    });

    return { callId, room };
  },
});

/** Leaves a call, ending it once the last participant is gone. */
export const leave = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const call = await ctx.db.get(args.callId);

    if (!call || call.endedAt) return;

    const member = await getMember(ctx, call.workspaceId, userId);

    if (!member) {
      throw new Error("Unauthorized");
    }

    const remaining = call.activeMemberIds.filter((id) => id !== member._id);

    await ctx.db.patch(call._id, {
      activeMemberIds: remaining,
      ...(remaining.length === 0 ? { endedAt: Date.now() } : {}),
    });
  },
});
