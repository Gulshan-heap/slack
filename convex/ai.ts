import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { GoogleGenerativeAI } from "@google/generative-ai";

type TranscriptEntry = { author: string; text: string; isBot: boolean };
type AiContext = { transcript: TranscriptEntry[]; roster: string[] };

/** How many recent messages the assistant reads before replying. */
const REPLY_CONTEXT_SIZE = 15;
/** Upper bound on messages folded into one summary. */
const MAX_SUMMARY_MESSAGES = 200;
const DEFAULT_SUMMARY_MESSAGES = 60;

const MODEL = "models/gemini-2.5-flash";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `Ada Lovelace` -> `AdaLovelace`, matching what the editor's picker inserts. */
const toHandle = (name: string) => name.replace(/\s+/g, "");

const generate = async (prompt: string) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in Convex env");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent(prompt);

  return (await result.response).text()?.trim() ?? "";
};

const formatTranscript = (transcript: TranscriptEntry[]) =>
  transcript
    .map(({ author, text, isBot }) => `${author}${isBot ? " (you)" : ""}: ${text}`)
    .join("\n");

/**
 * Turns the model's plain-text answer into a Quill delta, tagging any
 * `@Handle` that matches a real workspace member so it renders as a mention
 * chip the same way a human-typed mention does.
 */
const buildMentionDelta = (text: string, handles: string[]) => {
  const body = text.replace(/\n+$/, "");
  const ops: { insert: string; attributes?: Record<string, string> }[] = [];

  const sorted = [...handles]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  const pattern = sorted.length
    ? new RegExp(`@(?:${sorted.join("|")})(?![\\w.-])`, "gi")
    : null;

  let cursor = 0;

  if (pattern) {
    for (const match of body.matchAll(pattern)) {
      const start = match.index ?? 0;

      if (start > cursor) {
        ops.push({ insert: body.slice(cursor, start) });
      }

      ops.push({ insert: match[0], attributes: { mention: "member" } });
      cursor = start + match[0].length;
    }
  }

  if (cursor < body.length) {
    ops.push({ insert: body.slice(cursor) });
  }

  ops.push({ insert: "\n" });

  return JSON.stringify({ ops });
};

export const reply = action({
  args: {
    prompt: v.string(),
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    parentMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    console.log("🤖 AI action started:", args.prompt);

    try {
      const { transcript, roster }: AiContext = await ctx.runQuery(
        internal.messages.contextForAi,
        {
          workspaceId: args.workspaceId,
          channelId: args.channelId,
          conversationId: args.conversationId,
          parentMessageId: args.parentMessageId,
          limit: REPLY_CONTEXT_SIZE,
        }
      );

      const handles = roster.map(toHandle);

      const systemPrompt = `
You are an intelligent, friendly, and helpful AI assistant inside a Slack-style
workspace. People summon you by mentioning @ai in a channel, a thread, or a
direct message with you.

Your goals:
- Answer questions, solve problems, explain concepts, debug code, summarize
  text, and brainstorm ideas.
- Be concise by default, but give more detail when the question needs it.
- Use simple, clear language. Be polite, positive, and natural.

Behavior rules:
- Reply in plain text only. No JSON, no markdown, no code fences unless the
  user explicitly asks for code.
- Do not include emojis unless the user used them first.
- Never repeat the "@ai" trigger back in your answer.
- If you do not know something, say so honestly instead of guessing.
- If a request is unsafe or harmful, politely refuse and suggest a safe
  alternative.

Mentioning people:
- These are the members of this workspace, written as the handle you must use:
  ${handles.length ? handles.map((handle) => `@${handle}`).join(", ") : "(nobody else yet)"}
- Mention someone only when it genuinely helps — you are pointing a question at
  the right person, or handing off work. Never mention people just to greet
  them, and never invent a handle that is not on the list above.

Recent conversation (oldest first), for context only:
${formatTranscript(transcript) || "(no earlier messages)"}

Now respond to the newest message.
User: ${args.prompt}
`.trim();

      const text = await generate(systemPrompt);
      const answer = text || "🤖 I couldn't reply.";

      console.log("🤖 Gemini replied");

      await ctx.runMutation(api.messages.insertBotMessage, {
        body: buildMentionDelta(answer, handles),
        workspaceId: args.workspaceId,
        channelId: args.channelId,
        conversationId: args.conversationId,
        parentMessageId: args.parentMessageId,
      });

      console.log("🤖 Bot message inserted");
    } catch (err) {
      console.error("❌ AI action failed:", err);
    }
  },
});

/**
 * Condenses the recent messages of a channel, DM, or thread into bullet
 * points. Returns the summary to the caller instead of posting it, so reading
 * a summary never spams the conversation.
 */
export const summarize = action({
  args: {
    workspaceId: v.id("workspaces"),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    parentMessageId: v.optional(v.id("messages")),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ summary: string; messageCount: number }> => {
    const member: Doc<"members"> | null = await ctx.runQuery(
      api.members.current,
      { workspaceId: args.workspaceId }
    );

    if (!member) {
      throw new Error("Unauthorized");
    }

    const limit = Math.min(
      Math.max(args.limit ?? DEFAULT_SUMMARY_MESSAGES, 1),
      MAX_SUMMARY_MESSAGES
    );

    const { transcript }: AiContext = await ctx.runQuery(
      internal.messages.contextForAi,
      {
        workspaceId: args.workspaceId,
        channelId: args.channelId,
        conversationId: args.conversationId,
        parentMessageId: args.parentMessageId,
        limit,
      }
    );

    if (transcript.length === 0) {
      return { summary: "", messageCount: 0 };
    }

    if (transcript.length < 3) {
      return {
        summary: "",
        messageCount: transcript.length,
      };
    }

    const prompt = `
Summarize the following workspace conversation for someone catching up.

Rules:
- Output 3 to 6 bullet points, one per line, each starting with "- ".
- Lead with decisions, action items, and open questions; drop small talk.
- Name who said what when it matters ("Ada asked ...", "Grace will ...").
- Plain text only. No headings, no markdown bold, no preamble, no closing line.
- If something was left unresolved, say so in the last bullet.

Conversation (oldest first, ${transcript.length} messages):
${formatTranscript(transcript)}
`.trim();

    try {
      const summary = await generate(prompt);

      return { summary, messageCount: transcript.length };
    } catch (err) {
      console.error("❌ AI summary failed:", err);
      throw new Error("Failed to summarize the conversation");
    }
  },
});
