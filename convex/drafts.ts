import { v } from "convex/values";

import { auth } from "./auth";
import { deltaToText } from "./wellness";
import { Id } from "./_generated/dataModel";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";

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

const findDraft = (
  ctx: QueryCtx | MutationCtx,
  args: {
    memberId: Id<"members">;
    channelId?: Id<"channels">;
    conversationId?: Id<"conversations">;
  }
) => {
  return ctx.db
    .query("drafts")
    .withIndex("by_member_id_channel_id_conversation_id", (q) =>
      q
        .eq("memberId", args.memberId)
        .eq("channelId", args.channelId)
        .eq("conversationId", args.conversationId)
    )
    .unique();
};

/**
 * The composer body saved for one channel/DM, or `null` when there is none.
 * Returns `null` (not undefined) so the client can tell "still loading" from
 * "loaded, nothing saved" and only mount the editor once it knows.
 */
export const get = query({
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

    const draft = await findDraft(ctx, {
      memberId: member._id,
      channelId: args.channelId,
      conversationId: args.conversationId,
    });

    return draft ? { body: draft.body, updatedAt: draft.updatedAt } : null;
  },
});

/**
 * Upserts the draft for one channel/DM. An empty body deletes the row, so
 * clearing the composer (or sending the message) also clears the draft.
 */
export const set = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) {
      throw new Error("Unauthorized");
    }

    const existing = await findDraft(ctx, {
      memberId: member._id,
      channelId: args.channelId,
      conversationId: args.conversationId,
    });

    if (deltaToText(args.body).length === 0) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }

      return null;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        body: args.body,
        updatedAt: Date.now(),
      });

      return existing._id;
    }

    return ctx.db.insert("drafts", {
      workspaceId: args.workspaceId,
      memberId: member._id,
      channelId: args.channelId,
      conversationId: args.conversationId,
      body: args.body,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("drafts") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const draft = await ctx.db.get(args.id);

    if (!draft) return null;

    const member = await getMember(ctx, draft.workspaceId, userId);

    if (!member || member._id !== draft.memberId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

/** Every draft you have in this workspace, newest edit first. */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) return [];

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) return [];

    const drafts = await ctx.db
      .query("drafts")
      .withIndex("by_member_id", (q) => q.eq("memberId", member._id))
      .collect();

    const items = [];

    for (const draft of drafts) {
      if (draft.workspaceId !== args.workspaceId) continue;

      const channel = draft.channelId
        ? await ctx.db.get(draft.channelId)
        : null;

      let dmMemberId: Id<"members"> | undefined;
      let dmName: string | undefined;
      let dmImage: string | undefined;

      if (draft.conversationId) {
        const conversation = await ctx.db.get(draft.conversationId);

        if (conversation) {
          dmMemberId =
            conversation.memberOneId === member._id
              ? conversation.memberTwoId
              : conversation.memberOneId;

          const dmMember = await ctx.db.get(dmMemberId);
          const dmUser = dmMember ? await ctx.db.get(dmMember.userId) : null;
          dmName = dmUser?.name ?? "Member";
          dmImage = dmUser?.image;
        }
      }

      // The channel or DM was deleted out from under the draft.
      if (draft.channelId && !channel) continue;
      if (draft.conversationId && !dmMemberId) continue;

      items.push({
        _id: draft._id,
        updatedAt: draft.updatedAt,
        preview: deltaToText(draft.body).slice(0, PREVIEW_LENGTH),
        channelId: draft.channelId,
        channelName: channel?.name,
        dmMemberId,
        dmName,
        dmImage,
      });
    }

    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
