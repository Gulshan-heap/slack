import { v } from "convex/values";

import { auth } from "./auth";
import { deltaToText } from "./wellness";
import { Doc, Id } from "./_generated/dataModel";
import { query, QueryCtx } from "./_generated/server";

/** How far back through your own messages we look for threads you're in. */
const SCAN_LIMIT = 200;
/** Bounds the per-root reply lookups this query fans out to. */
const ROOT_LIMIT = 40;
const PREVIEW_LENGTH = 220;
const AVATAR_LIMIT = 5;

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

const authorOf = async (ctx: QueryCtx, memberId: Id<"members">) => {
  const member = await ctx.db.get(memberId);
  const user = member ? await ctx.db.get(member.userId) : null;

  return { name: user?.name ?? "Someone", image: user?.image };
};

/**
 * The threads you're part of: every thread you started and every thread you
 * replied in, newest reply first.
 *
 * Threads aren't a table — a thread is a root message plus the messages
 * pointing at it via `parentMessageId`. So we walk your own recent messages
 * (index-backed), fold each one to its thread root, and keep the roots that
 * actually have replies.
 */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) return [];

    const member = await getMember(ctx, args.workspaceId, userId);

    if (!member) return [];

    const mine = await ctx.db
      .query("messages")
      .withIndex("by_member_id", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(SCAN_LIMIT);

    const rootIds: Id<"messages">[] = [];
    const seen = new Set<string>();

    for (const message of mine) {
      if (message.workspaceId !== args.workspaceId) continue;

      const rootId = message.parentMessageId ?? message._id;

      if (seen.has(rootId)) continue;

      seen.add(rootId);
      rootIds.push(rootId);

      if (rootIds.length >= ROOT_LIMIT) break;
    }

    const threads = [];

    for (const rootId of rootIds) {
      const root = await ctx.db.get(rootId);

      if (!root) continue;

      const replies = await ctx.db
        .query("messages")
        .withIndex("by_parent_message_id", (q) =>
          q.eq("parentMessageId", rootId)
        )
        .collect();

      // A message you sent that nobody replied to isn't a thread.
      if (replies.length === 0) continue;

      const lastReply = replies[replies.length - 1];

      const rootAuthor = await authorOf(ctx, root.memberId);
      const lastAuthor = await authorOf(ctx, lastReply.memberId);

      const participantIds = Array.from(
        new Set<Id<"members">>([
          root.memberId,
          ...replies.map((reply) => reply.memberId),
        ])
      ).slice(0, AVATAR_LIMIT);

      const participants = await Promise.all(
        participantIds.map(async (id) => {
          const { name, image } = await authorOf(ctx, id);

          return { memberId: id, name, image };
        })
      );

      const channel = root.channelId ? await ctx.db.get(root.channelId) : null;

      let dmMemberId: Id<"members"> | undefined;
      let dmName: string | undefined;

      if (root.conversationId) {
        const conversation: Doc<"conversations"> | null = await ctx.db.get(
          root.conversationId
        );

        if (conversation) {
          dmMemberId =
            conversation.memberOneId === member._id
              ? conversation.memberTwoId
              : conversation.memberOneId;

          dmName = (await authorOf(ctx, dmMemberId)).name;
        }
      }

      threads.push({
        rootMessageId: root._id,
        rootPreview: deltaToText(root.body).slice(0, PREVIEW_LENGTH),
        rootHasImage: !!root.image,
        rootHasAudio: !!root.audio,
        rootAuthorName: rootAuthor.name,
        rootAuthorImage: rootAuthor.image,
        rootCreatedAt: root._creationTime,
        isMine: root.memberId === member._id,
        replyCount: replies.length,
        lastReplyAt: lastReply._creationTime,
        lastReplyAuthorName: lastAuthor.name,
        lastReplyPreview: deltaToText(lastReply.body).slice(0, PREVIEW_LENGTH),
        participants,
        channelId: root.channelId,
        channelName: channel?.name,
        conversationId: root.conversationId,
        dmMemberId,
        dmName,
      });
    }

    return threads.sort((a, b) => b.lastReplyAt - a.lastReplyAt);
  },
});
