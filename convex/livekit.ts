"use node";

import { v } from "convex/values";
import { AccessToken } from "livekit-server-sdk";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

/**
 * Mints a short-lived LiveKit access token for one call.
 *
 * Runs in Convex's Node runtime because `livekit-server-sdk` signs the JWT
 * with node crypto. Requires `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and
 * `LIVEKIT_URL` in the Convex deployment environment.
 */
export const createToken = action({
  args: {
    workspaceId: v.id("workspaces"),
    callId: v.id("calls"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ token: string; url: string; room: string }> => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !url) {
      throw new Error(
        "LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL in the Convex environment."
      );
    }

    // Authenticated: returns null unless the caller belongs to the workspace.
    const member: Doc<"members"> | null = await ctx.runQuery(
      api.members.current,
      { workspaceId: args.workspaceId }
    );

    if (!member) {
      throw new Error("Unauthorized");
    }

    const call: Doc<"calls"> | null = await ctx.runQuery(
      internal.calls.getInternal,
      { callId: args.callId }
    );

    if (!call || call.workspaceId !== args.workspaceId) {
      throw new Error("Call not found");
    }

    if (call.endedAt) {
      throw new Error("This call has already ended");
    }

    const user: Doc<"users"> | null = await ctx.runQuery(api.users.current, {});

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: member._id,
      name: user?.name ?? "Member",
      ttl: "2h",
    });

    accessToken.addGrant({
      room: call.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await accessToken.toJwt(),
      url,
      room: call.room,
    };
  },
});
