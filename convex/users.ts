import { v } from "convex/values";

import { auth } from "./auth";
import { mutation, query } from "./_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);

    if (userId === null) {
      return null;
    }

    return await ctx.db.get(userId);
  },
});

/**
 * Updates the signed-in user's display name and/or avatar. `image` takes a
 * freshly uploaded storage id (resolved to a URL here, since `users.image`
 * also holds OAuth avatar URLs) or null to fall back to the initials avatar.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);

    if (!userId) {
      throw new Error("Unauthorized");
    }

    const patch: { name?: string; image?: string | undefined } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();

      if (name.length < 2) {
        throw new Error("Name must be at least 2 characters");
      }

      patch.name = name;
    }

    if (args.image !== undefined) {
      if (args.image === null) {
        patch.image = undefined;
      } else {
        const url = await ctx.storage.getUrl(args.image);

        if (!url) {
          throw new Error("Uploaded image not found");
        }

        patch.image = url;
      }
    }

    await ctx.db.patch(userId, patch);

    return userId;
  },
});
