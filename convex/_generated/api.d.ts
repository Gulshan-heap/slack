/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as bot from "../bot.js";
import type * as calls from "../calls.js";
import type * as channels from "../channels.js";
import type * as conversations from "../conversations.js";
import type * as drafts from "../drafts.js";
import type * as http from "../http.js";
import type * as livekit from "../livekit.js";
import type * as members from "../members.js";
import type * as messages from "../messages.js";
import type * as reactions from "../reactions.js";
import type * as threads from "../threads.js";
import type * as upload from "../upload.js";
import type * as users from "../users.js";
import type * as wellness from "../wellness.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  ai: typeof ai;
  auth: typeof auth;
  bot: typeof bot;
  calls: typeof calls;
  channels: typeof channels;
  conversations: typeof conversations;
  drafts: typeof drafts;
  http: typeof http;
  livekit: typeof livekit;
  members: typeof members;
  messages: typeof messages;
  reactions: typeof reactions;
  threads: typeof threads;
  upload: typeof upload;
  users: typeof users;
  wellness: typeof wellness;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
