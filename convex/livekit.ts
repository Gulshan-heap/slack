"use node";

import { ConvexError, v } from "convex/values";
import { AccessToken } from "livekit-server-sdk";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

/** LiveKit keys and secrets are base64url-ish: printable ASCII, no spaces. */
const CREDENTIAL_PATTERN = /^[\x21-\x7e]+$/;

/**
 * Catches a credential that was pasted from the dashboard's masked display
 * (a run of `•`) or that picked up quotes/whitespace. Without this the token
 * signs fine and LiveKit rejects it later with an opaque "invalid token".
 */
const assertUsableCredential = (name: string, value: string) => {
  if (!CREDENTIAL_PATTERN.test(value)) {
    throw new ConvexError(
      `${name} does not look like a LiveKit credential. If you copied it from the dashboard, use "Reveal secret" first — the masked dots are not the value.`
    );
  }
};

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
      throw new ConvexError(
        "LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL in the Convex environment."
      );
    }

    assertUsableCredential("LIVEKIT_API_KEY", apiKey);
    assertUsableCredential("LIVEKIT_API_SECRET", apiSecret);

    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      throw new ConvexError(
        `LIVEKIT_URL must start with wss:// (got "${url.slice(0, 8)}...").`
      );
    }

    // Authenticated: returns null unless the caller belongs to the workspace.
    const member: Doc<"members"> | null = await ctx.runQuery(
      api.members.current,
      { workspaceId: args.workspaceId }
    );

    if (!member) {
      throw new ConvexError("You are not a member of this workspace");
    }

    const call: Doc<"calls"> | null = await ctx.runQuery(
      internal.calls.getInternal,
      { callId: args.callId }
    );

    if (!call || call.workspaceId !== args.workspaceId) {
      throw new ConvexError("Call not found");
    }

    if (call.endedAt) {
      throw new ConvexError("This call has already ended");
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
