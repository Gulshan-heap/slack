import { mutation } from "./_generated/server";
import { auth } from "./auth";
import { v } from "convex/values";

/**
 * 🔹 Central bot profile
 */
export const BOT_PROFILE = {
  name: "Slack AI",
  image: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
};

/**
 * Internal helper — get or create bot user.
 */
async function getOrCreateBotUser(ctx: any) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_isBot", (q: any) => q.eq("isBot", true))
    .first();

  if (existing) return existing;

  const botUserId = await ctx.db.insert("users", {
    name: BOT_PROFILE.name,
    isBot: true,
    image: BOT_PROFILE.image,
  });

  return await ctx.db.get(botUserId);
}

/**
 * Ensures bot is member of workspace.
 */
export const ensureBotMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const botUser = await getOrCreateBotUser(ctx);
    if (!botUser) throw new Error("Bot creation failed");

    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_workspace_id_user_id", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", botUser._id)
      )
      .unique();

    if (existingMember) return existingMember._id;

    const memberId = await ctx.db.insert("members", {
      workspaceId: args.workspaceId,
      userId: botUser._id,
      role: "member",
    });

    return memberId;
  },
});

/**
 * Optional boot hook
 */
export const createBotUserOnce = mutation({
  args: {},
  handler: async (ctx) => {
    const botUser = await getOrCreateBotUser(ctx);
    return botUser?._id;
  },
});
