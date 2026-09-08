import { v } from "convex/values";

import { auth } from "./auth";
import { deltaToText } from "./wellness";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";

const FEED_LIMIT = 50;
/** A mention only counts if the recipient can actually open the message. */
const PREVIEW_LENGTH = 180;

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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `Ada Lovelace` -> `AdaLovelace`, matching what the editor's picker inserts. */
const toHandle = (name: string) => name.replace(/\s+/g, "");

type ActivitySource = {
  workspaceId: Id<"workspaces">;
  messageId: Id<"messages">;
  actorMemberId: Id<"members">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  parentMessageId?: Id<"messages">;
};

/**
 * Members who can see a message: everyone in the workspace for a channel,
 * just the two participants for a DM.
 */
const audienceFor = async (
  ctx: MutationCtx,
  source: ActivitySource
): Promise<Id<"members">[] | null> => {
  if (source.conversationId) {
    const conversation = await ctx.db.get(source.conversationId);

    if (!conversation) return [];

    return [conversation.memberOneId, conversation.memberTwoId];
  }

  // null means "no restriction" — any workspace member can read a channel.
  return null;
};

/**
 * Records one `mention` row per workspace member named in the body. Skips the
 * author, and in a DM skips anyone outside the conversation so nobody is
 * pinged about a message they cannot open.
 */
export const recordMentions = async (
  ctx: MutationCtx,
  args: ActivitySource & { body: string }
) => {
  const text = deltaToText(args.body);

  if (!text.includes("@")) return;

  const members = await ctx.db
    .query("members")
    .withIndex("by_workspace_id", (q) =>
      q.eq("workspaceId", args.workspaceId)
    )
    .collect();

  const audience = await audienceFor(ctx, args);

  const candidates: { member: Doc<"members">; handle: string }[] = [];

  for (const member of members) {
    if (member._id === args.actorMemberId) continue;
    if (audience && !audience.includes(member._id)) continue;

    const user = await ctx.db.get(member.userId);

    if (!user?.name || user.isBot) continue;

    candidates.push({ member, handle: toHandle(user.name) });
  }

  if (candidates.length === 0) return;

  for (const { member, handle } of candidates) {
    const pattern = new RegExp(`@${escapeRegExp(handle)}(?![\\w.-])`, "i");

    if (!pattern.test(text)) continue;

    await ctx.db.insert("activity", {
      workspaceId: args.workspaceId,
      memberId: member._id,
      actorMemberId: args.actorMemberId,
      type: "mention",
      messageId: args.messageId,
      channelId: args.channelId,
      conversationId: args.conversationId,
      parentMessageId: args.parentMessageId,
    });
  }
};

/** Tells the root author that someone replied in their thread. */
export const recordThreadReply = async (
  ctx: MutationCtx,
  args: ActivitySource & { parentMessageId: Id<"messages"> }
) => {
  const parent = await ctx.db.get(args.parentMessageId);

  if (!parent || parent.memberId === args.actorMemberId) return;

  await ctx.db.insert("activity", {
    workspaceId: args.workspaceId,
    memberId: parent.memberId,
    actorMemberId: args.actorMemberId,
    type: "thread_reply",
    messageId: args.messageId,
    channelId: args.channelId,
    conversationId: args.conversationId,
    parentMessageId: args.parentMessageId,
  });
};

/** Tells a message's author that someone reacted to it. */
export const recordReaction = async (
  ctx: MutationCtx,
  args: {
    message: Doc<"messages">;
    actorMemberId: Id<"members">;
    value: string;
  }
) => {
  if (args.message.memberId === args.actorMemberId) return;

  await ctx.db.insert("activity", {
    workspaceId: args.message.workspaceId,
    memberId: args.message.memberId,
    actorMemberId: args.actorMemberId,
    type: "reaction",
    messageId: args.message._id,
    channelId: args.message.channelId,
    conversationId: args.message.conversationId,
    parentMessageId: args.message.parentMessageId,
    value: args.value,
  });
};

/** Drops the feed rows for a deleted message, so the feed can't dangle. */
export const clearForMessage = async (
  ctx: MutationCtx,
  messageId: Id<"messages">
) => {
  const rows = await ctx.db
    .query("activity")
    .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
    .collect();

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
};

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) return [];

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) return [];

    const rows = await ctx.db
      .query("activity")
      .withIndex("by_member_id", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(FEED_LIMIT);

    const items = [];

    for (const row of rows) {
      const message = await ctx.db.get(row.messageId);

      // The message was deleted between the write and this read.
      if (!message) continue;

      const actor = await ctx.db.get(row.actorMemberId);
      const actorUser = actor ? await ctx.db.get(actor.userId) : null;

      const channel = row.channelId ? await ctx.db.get(row.channelId) : null;

      let dmMemberId: Id<"members"> | undefined;
      let dmName: string | undefined;

      if (row.conversationId) {
        const conversation = await ctx.db.get(row.conversationId);

        if (conversation) {
          dmMemberId =
            conversation.memberOneId === member._id
              ? conversation.memberTwoId
              : conversation.memberOneId;

          const dmMember = await ctx.db.get(dmMemberId);
          const dmUser = dmMember ? await ctx.db.get(dmMember.userId) : null;
          dmName = dmUser?.name ?? "Member";
        }
      }

      items.push({
        _id: row._id,
        type: row.type,
        value: row.value,
        readAt: row.readAt,
        createdAt: row._creationTime,
        actorName: actorUser?.name ?? "Someone",
        actorImage: actorUser?.image,
        preview: deltaToText(message.body).slice(0, PREVIEW_LENGTH),
        hasImage: !!message.image,
        hasAudio: !!message.audio,
        channelId: row.channelId,
        channelName: channel?.name,
        dmMemberId,
        dmName,
        parentMessageId: row.parentMessageId ?? message.parentMessageId,
        messageId: row.messageId,
      });
    }

    return items;
  },
});

export const unreadCount = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) return 0;

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) return 0;

    const unread = await ctx.db
      .query("activity")
      .withIndex("by_member_id_read_at", (q) =>
        q.eq("memberId", member._id).eq("readAt", undefined)
      )
      .take(FEED_LIMIT);

    return unread.length;
  },
});

export const markAllRead = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) {
      throw new Error("Unauthorized");
    }

    const unread = await ctx.db
      .query("activity")
      .withIndex("by_member_id_read_at", (q) =>
        q.eq("memberId", member._id).eq("readAt", undefined)
      )
      .collect();

    const readAt = Date.now();

    for (const row of unread) {
      await ctx.db.patch(row._id, { readAt });
    }

    return unread.length;
  },
});
