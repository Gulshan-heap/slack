"use client";

import { useState } from "react";
import { Loader, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetTeamPulse } from "@/features/wellness/api/use-get-team-pulse";
import { useGetMyPulse } from "@/features/wellness/api/use-get-my-pulse";
import { useGenerateWellnessInsight } from "@/features/wellness/api/use-generate-wellness-insight";
import { SentimentTrendChart } from "@/features/wellness/components/sentiment-trend-chart";
import { RiskBadge } from "@/features/wellness/components/risk-badge";

const PulsePage = () => {
  const workspaceId = useWorkspaceId();
  const { data: currentMember, isLoading: memberLoading } = useCurrentMember({
    workspaceId,
  });
  const isAdmin = currentMember?.role === "admin";

  const { data: teamPulse, isLoading: teamLoading } = useGetTeamPulse({
    workspaceId,
    enabled: isAdmin,
  });
  const { data: myPulse, isLoading: myLoading } = useGetMyPulse({
    workspaceId,
  });

  const { generate, isPending: isGenerating } = useGenerateWellnessInsight();
  const [insight, setInsight] = useState<string | null>(null);

  const handleGenerate = async (scope: "team" | "mine") => {
    setInsight(null);
    const result = await generate({ workspaceId, scope }).catch(() => null);
    if (!result) {
      toast.error("Failed to generate insight");
      return;
    }
    setInsight(result);
  };

  if (memberLoading || (isAdmin && teamLoading) || (!isAdmin && myLoading)) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Team Pulse</h1>
          <p className="text-sm text-muted-foreground">
            A lightweight, real-time signal of team sentiment and activity
            patterns from the last 14 days — derived from message tone and
            late-night activity. Not a clinical assessment.
          </p>
        </div>

        {isAdmin && teamPulse ? (
          <>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Workspace sentiment trend</h2>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isGenerating}
                  onClick={() => handleGenerate("team")}
                >
                  <Sparkles className="size-4 mr-1.5" />
                  {isGenerating ? "Generating…" : "Generate AI insight"}
                </Button>
              </div>
              <SentimentTrendChart data={teamPulse.trend} />
            </div>

            <div className="rounded-lg border divide-y">
              <div className="p-4 pb-2">
                <h2 className="font-semibold">Team members</h2>
                <p className="text-xs text-muted-foreground">
                  Sorted by risk score, highest first.
                </p>
              </div>
              {teamPulse.members.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  No member activity yet.
                </p>
              )}
              {teamPulse.members.map((member) => (
                <div
                  key={member.memberId}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-x-3">
                    <Avatar className="size-8">
                      <AvatarImage src={member.image} />
                      <AvatarFallback className="bg-sky-500 text-white text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.messageCount} messages · avg sentiment{" "}
                        {member.avgSentiment.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <RiskBadge level={member.riskLevel} score={member.riskScore} />
                </div>
              ))}
            </div>
          </>
        ) : myPulse ? (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Your sentiment trend</h2>
              <Button
                size="sm"
                variant="outline"
                disabled={isGenerating}
                onClick={() => handleGenerate("mine")}
              >
                <Sparkles className="size-4 mr-1.5" />
                {isGenerating ? "Generating…" : "Generate AI insight"}
              </Button>
            </div>
            <SentimentTrendChart data={myPulse.trend} />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {myPulse.messageCount} messages in the last 14 days
              </p>
              <RiskBadge level={myPulse.riskLevel} score={myPulse.riskScore} />
            </div>
          </div>
        ) : null}

        {insight && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-x-1.5">
              <Sparkles className="size-4" />
              AI insight
            </h2>
            <p className="text-sm whitespace-pre-wrap">{insight}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PulsePage;
