import { mutation } from "./_generated/server";
import { auth } from "./auth";
import { v } from "convex/values";

export const setupBotForWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // find or create bot user
    let botUser = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("isBot"), true))
      .unique();

    if (!botUser) {
      const botUserId = await ctx.db.insert("users", {
        name: "SlackBot",
        isBot: true,
        image: "/bot.png",
      });
      botUser = await ctx.db.get(botUserId);
    }

    if (!botUser) throw new Error("Bot creation failed");

    // add bot as workspace member
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_workspace_id_user_id", q =>
        q.eq("workspaceId", args.workspaceId).eq("userId", botUser!._id)
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

export const createBotUserOnce = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("isBot"), true))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      name: "SlackBot",
      isBot: true,
      image: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
    });
  },
});
