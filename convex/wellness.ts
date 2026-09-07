import { v } from "convex/values";
import { auth } from "./auth";
import { action, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

const POSITIVE_WORDS = [
  "great", "good", "awesome", "love", "loved", "excellent", "thanks",
  "thank you", "happy", "excited", "amazing", "nice", "perfect", "fantastic",
  "glad", "appreciate", "yay", "congrats", "congratulations", "cool",
  "wonderful", "well done", "nailed it", "proud", "fun", "easy", "solved",
];

const NEGATIVE_WORDS = [
  "bad", "tired", "exhausted", "frustrated", "annoyed", "angry", "hate",
  "stressed", "overwhelmed", "burnout", "burnt out", "sad", "worried",
  "anxious", "upset", "terrible", "awful", "sorry", "difficult", "problem",
  "issue", "broken", "fail", "failed", "stuck", "overtime", "can't",
  "cant", "impossible", "hopeless", "quit", "give up", "too much", "behind",
];

export const deltaToText = (body: string): string => {
  try {
    const parsed = JSON.parse(body);
    const ops = parsed?.ops ?? [];
    return ops
      .map((op: { insert?: unknown }) =>
        typeof op.insert === "string" ? op.insert : ""
      )
      .join("")
      .trim();
  } catch {
    return body;
  }
};

export const scoreSentiment = (text: string): number => {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) score -= 1;
  }

  return Math.max(-1, Math.min(1, score / 3));
};

const NEGATIVE_THRESHOLD = -0.15;
const LATE_NIGHT_START_HOUR = 22;
const LATE_NIGHT_END_HOUR = 5;

export const recordMessageActivity = async (
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    memberId: Id<"members">;
    body: string;
    createdAt: number;
  }
) => {
  const text = deltaToText(args.body);
  const sentiment = scoreSentiment(text);

  const hour = new Date(args.createdAt).getUTCHours();
  const isLateNight = hour >= LATE_NIGHT_START_HOUR || hour < LATE_NIGHT_END_HOUR;
  const date = new Date(args.createdAt).toISOString().slice(0, 10);

  const existing = await ctx.db
    .query("memberActivityDaily")
    .withIndex("by_workspace_id_member_id_date", (q) =>
      q
        .eq("workspaceId", args.workspaceId)
        .eq("memberId", args.memberId)
        .eq("date", date)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      messageCount: existing.messageCount + 1,
      sentimentSum: existing.sentimentSum + sentiment,
      negativeCount:
        existing.negativeCount + (sentiment <= NEGATIVE_THRESHOLD ? 1 : 0),
      lateNightCount: existing.lateNightCount + (isLateNight ? 1 : 0),
    });
  } else {
    await ctx.db.insert("memberActivityDaily", {
      workspaceId: args.workspaceId,
      memberId: args.memberId,
      date,
      messageCount: 1,
      sentimentSum: sentiment,
      negativeCount: sentiment <= NEGATIVE_THRESHOLD ? 1 : 0,
      lateNightCount: isLateNight ? 1 : 0,
    });
  }

  return sentiment;
};

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

const lastNDates = (n: number) => {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

const riskFromStats = (stats: {
  messageCount: number;
  sentimentSum: number;
  negativeCount: number;
  lateNightCount: number;
}) => {
  if (stats.messageCount === 0) {
    return { avgSentiment: 0, negativeRatio: 0, lateNightRatio: 0, riskScore: 0, riskLevel: "low" as const };
  }

  const avgSentiment = stats.sentimentSum / stats.messageCount;
  const negativeRatio = stats.negativeCount / stats.messageCount;
  const lateNightRatio = stats.lateNightCount / stats.messageCount;

  const riskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (negativeRatio * 55 + lateNightRatio * 35 + Math.max(0, -avgSentiment) * 10) * 1
      )
    )
  );

  const riskLevel: "low" | "medium" | "high" =
    riskScore >= 55 ? "high" : riskScore >= 28 ? "medium" : "low";

  return { avgSentiment, negativeRatio, lateNightRatio, riskScore, riskLevel };
};

export const getTeamPulse = query({
  args: { workspaceId: v.id("workspaces"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const currentMember = await getMember(ctx, args.workspaceId, userId);
    if (!currentMember || currentMember.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const days = args.days ?? 14;
    const dates = new Set(lastNDates(days));

    const [members, rows] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
        .collect(),
      ctx.db
        .query("memberActivityDaily")
        .withIndex("by_workspace_id_date", (q) => q.eq("workspaceId", args.workspaceId))
        .collect(),
    ]);

    const relevantRows = rows.filter((r) => dates.has(r.date));

    const byDate = new Map<
      string,
      { messageCount: number; sentimentSum: number }
    >();
    for (const date of dates) byDate.set(date, { messageCount: 0, sentimentSum: 0 });
    for (const row of relevantRows) {
      const entry = byDate.get(row.date);
      if (entry) {
        entry.messageCount += row.messageCount;
        entry.sentimentSum += row.sentimentSum;
      }
    }

    const trend = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        avgSentiment: v.messageCount > 0 ? v.sentimentSum / v.messageCount : 0,
        messageCount: v.messageCount,
      }));

    const byMember = new Map<
      Id<"members">,
      { messageCount: number; sentimentSum: number; negativeCount: number; lateNightCount: number }
    >();
    for (const row of relevantRows) {
      const entry = byMember.get(row.memberId) ?? {
        messageCount: 0,
        sentimentSum: 0,
        negativeCount: 0,
        lateNightCount: 0,
      };
      entry.messageCount += row.messageCount;
      entry.sentimentSum += row.sentimentSum;
      entry.negativeCount += row.negativeCount;
      entry.lateNightCount += row.lateNightCount;
      byMember.set(row.memberId, entry);
    }

    const members_ = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        if (!user || user.isBot) return null;

        const stats = byMember.get(member._id) ?? {
          messageCount: 0,
          sentimentSum: 0,
          negativeCount: 0,
          lateNightCount: 0,
        };

        return {
          memberId: member._id,
          name: user.name ?? "Member",
          image: user.image,
          ...stats,
          ...riskFromStats(stats),
        };
      })
    );

    return {
      trend,
      members: members_
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .sort((a, b) => b.riskScore - a.riskScore),
    };
  },
});

export const getMyPulse = query({
  args: { workspaceId: v.id("workspaces"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const currentMember = await getMember(ctx, args.workspaceId, userId);
    if (!currentMember) throw new Error("Unauthorized");

    const days = args.days ?? 14;
    const dates = new Set(lastNDates(days));

    const rows = await ctx.db
      .query("memberActivityDaily")
      .withIndex("by_member_id_date", (q) => q.eq("memberId", currentMember._id))
      .collect();

    const relevantRows = rows.filter((r) => dates.has(r.date));

    const byDate = new Map<string, { messageCount: number; sentimentSum: number }>();
    for (const date of dates) byDate.set(date, { messageCount: 0, sentimentSum: 0 });
    for (const row of relevantRows) {
      const entry = byDate.get(row.date);
      if (entry) {
        entry.messageCount += row.messageCount;
        entry.sentimentSum += row.sentimentSum;
      }
    }

    const trend = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        avgSentiment: v.messageCount > 0 ? v.sentimentSum / v.messageCount : 0,
        messageCount: v.messageCount,
      }));

    const totals = relevantRows.reduce(
      (acc, row) => ({
        messageCount: acc.messageCount + row.messageCount,
        sentimentSum: acc.sentimentSum + row.sentimentSum,
        negativeCount: acc.negativeCount + row.negativeCount,
        lateNightCount: acc.lateNightCount + row.lateNightCount,
      }),
      { messageCount: 0, sentimentSum: 0, negativeCount: 0, lateNightCount: 0 }
    );

    return { trend, ...totals, ...riskFromStats(totals) };
  },
});

export const generateWellnessInsight = action({
  args: {
    workspaceId: v.id("workspaces"),
    scope: v.union(v.literal("team"), v.literal("mine")),
  },
  handler: async (ctx, args): Promise<string> => {
    const pulse: {
      trend: Array<{ date: string; avgSentiment: number; messageCount: number }>;
      members?: Array<{
        name: string;
        messageCount: number;
        avgSentiment: number;
        negativeRatio: number;
        lateNightRatio: number;
        riskScore: number;
        riskLevel: string;
      }>;
    } = args.scope === "mine"
      ? { trend: (await ctx.runQuery(api.wellness.getMyPulse, { workspaceId: args.workspaceId })).trend }
      : await ctx.runQuery(api.wellness.getTeamPulse, { workspaceId: args.workspaceId });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in Convex env");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const summary = pulse.members
      ? pulse.members
          .map(
            (m) =>
              `${m.name}: ${m.messageCount} messages, avg sentiment ${m.avgSentiment.toFixed(2)}, ${Math.round(m.negativeRatio * 100)}% negative, ${Math.round(m.lateNightRatio * 100)}% late-night, risk ${m.riskLevel} (${m.riskScore})`
          )
          .join("\n")
      : pulse.trend
          .map((t) => `${t.date}: ${t.messageCount} messages, avg sentiment ${t.avgSentiment.toFixed(2)}`)
          .join("\n");

    const prompt = `You are a workplace wellness assistant. Based on this team activity/sentiment data (sentiment ranges -1 negative to +1 positive, derived from chat message tone and late-night activity), write a short (4-6 sentence) plain-text summary of team wellbeing and burnout risk, with one concrete actionable suggestion for a manager. Be measured and non-alarmist - this is a lightweight heuristic signal, not a clinical assessment. Do not use markdown formatting.

Data:
${summary}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    return text || "Not enough data yet to generate an insight.";
  },
});

export const heartbeat = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const member = await getMember(ctx, args.workspaceId, userId);
    if (!member) return null;

    await ctx.db.patch(member._id, { lastSeen: Date.now() });
    return null;
  },
});
