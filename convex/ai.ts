import { action } from "./_generated/server";
import { v } from "convex/values";
import Groq from "groq-sdk";
import { api } from "./_generated/api";


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export const reply = action({
  args: {
    prompt: v.string(),
    conversationId: v.id("conversations"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {

    const chat = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: "You are a helpful Slack assistant." },
        { role: "user", content: args.prompt },
      ],
      max_tokens: 200,
    });

    const reply =
      chat.choices[0]?.message?.content ?? "🤖 I couldn't reply.";

    await ctx.runMutation(api.messages.insertBotMessage, {
  body: reply,
  conversationId: args.conversationId,
  workspaceId: args.workspaceId,
});

  },
});
