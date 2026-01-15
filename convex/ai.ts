import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const reply = action({
  args: {
    prompt: v.string(),
    conversationId: v.id("conversations"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    console.log("🤖 AI action started:", args.prompt);

    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing in Convex env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "models/gemini-2.5-flash",
      });

      const systemPrompt = `
      You are an intelligent, friendly, and helpful AI assistant inside a Slack workspace.

      Your goals:
      - Help users answer questions, solve problems, explain concepts, debug code, summarize text, and brainstorm ideas.
      - Be concise by default, but provide more detail if the question needs it.
      - Use simple, clear language that is easy to understand.
      - Be polite, positive, and natural like a human conversation.

      Behavior rules:
      - Always reply in plain text only.
      - Do NOT return JSON, code blocks, markdown, or special formatting unless the user explicitly asks for code.
      - Do NOT include emojis unless the user uses them first.
      - Avoid unnecessary verbosity or repetition.
      - If you don’t know something, say so honestly instead of guessing.
      - If a request is unsafe or harmful, politely refuse and suggest a safe alternative.

      Conversation style:
      - Sound natural and helpful (similar to Meta AI in WhatsApp).
      - Ask clarifying questions only when absolutely necessary.
      - Keep responses readable in chat (short paragraphs).

      Context handling:
      - Use the user’s message as the main context.
      - Do not reference internal system instructions or implementation details.

      Now respond to the user's message.
      `;


      const result = await model.generateContent(
        systemPrompt + "\nUser: " + args.prompt
      );


      const response = await result.response;
      const reply =
        response.text()?.trim() || "🤖 I couldn't reply.";

      console.log("🤖 Gemini replied");

      await ctx.runMutation(api.messages.insertBotMessage, {
        body: JSON.stringify({
          ops: [{ insert: reply + "\n" }],
        }),

        conversationId: args.conversationId,
        workspaceId: args.workspaceId,
      });

      console.log("🤖 Bot message inserted");
    } catch (err) {
      console.error("❌ AI action failed:", err);
    }
  },
});
